require("dotenv").config();
const _ = require("lodash");
const bcrypt = require("bcrypt");
const { User } = require("../model/user.model").user;
const propertiesToPick = require("../common/propertiesToPick.common");
const generateRandomAvatar = require("../utils/generateRandomAvatar.utils");
const {
  getFilterArguments,
  getJobCount,
  getJobCounts,
} = require("../utils/entry.utils");
const entryServices = require("./entry.services");
const { isIncentiveActive } = require("./incentive.services");
const { default: mongoose } = require("mongoose");

const { customerDefaultPassword } = process.env;

class UserService {
  //Create new user
  async createUser(user) {
    const salt = await bcrypt.genSalt(10);
    // for hashing the password that is saved the database for security reasons
    user.password = await bcrypt.hash(user.password, salt);

    return await user.save();
  }

  async validateUserIds(userIds) {
    if (userIds) {
      const users = await User.find({
        _id: { $in: userIds },
      });

      const foundIds = users.map((d) => d._id.toString());

      const missingIds = userIds.filter((id) => !foundIds.includes(id));

      return missingIds;
    }
    return [];
  }

  findDocumentsExcludingIDs = (userIds) => {
    return User.find({
      _id: { $nin: userIds },
      role: { $in: this.staffRoles },
      isDeleted: undefined,
    })
      .select("-password")
      .sort({ _id: -1 });
  };

  getStaffIdsAddedForManager(manager) {
    if (!manager.managerDetails) {
      manager.managerDetails = {};
    }

    const staffIds = manager.managerDetails.staffLocationsVisibleToManager;

    return staffIds ? staffIds : [];
  }

  async getUsersByIdArray(userIds) {
    const users = await User.find({
      _id: { $in: userIds },
    });

    const foundIds = users.map((d) => d._id.toString());

    const missingIds = userIds.filter((id) => !foundIds.includes(id));

    return { missingIds, users };
  }

  async fetchIdsOfStaffsWhoCanTakeAppointments() {
    const staffsWhoCanTakeAppointments = await User.find({
      $or: [
        { "staffDetails.assignedDealerships": undefined },
        { "staffDetails.assignedDealerships": { $eq: [] } },
      ],
      role: "staff",
      isDeleted: undefined,
    });

    return staffsWhoCanTakeAppointments.map((staff) => staff._id);
  }

  countStaffsWhoCanTakeAppointments() {
    return User.count({
      isDeleted: undefined,
      role: "staff",
      $or: [
        { "staffDetails.assignedDealerships": undefined },
        { "staffDetails.assignedDealerships": { $eq: [] } },
      ],
    });
  }

  createUserWithAvatar = async (req, user, departments) => {
    const { body } = req;
    const staffRoles = ["staff", "porter"];
    if (staffRoles.includes(body.role)) propertiesToPick.push("staffDetails");
    if (body.role === "customer" || req.user.role === "customer") {
      propertiesToPick.push("customerDetails");

      if (!body.password) req.body.password = customerDefaultPassword;
    }

    user = new User(_.pick(body, [...propertiesToPick, "password"]));

    const avatarUrl = await generateRandomAvatar(user.email);
    user.avatarUrl = avatarUrl;
    user.avatarImgTag = `<img src=${avatarUrl} alt=${user._id}>`;

    if (req.user.role !== "customer") user.role = user.role.toLowerCase();
    if (user.role === "staff" || user.role === "manager")
      user.departments = [...new Set(departments)];

    user = await this.createUser(user);

    const token = user.generateAuthToken();
    if (staffRoles.includes(body.role)) propertiesToPick.push("staffDetails");
    if (["customer", "dealershipStaff"].includes(user.role))
      propertiesToPick.push("customerDetails");

    user = _.pick(user, propertiesToPick);
    // It creates a token which is sent as a header to the client

    return { user, token };
  };

  async getUserById(userId) {
    return await User.findOne({ _id: userId, isDeleted: undefined });
  }

  getUserWithoutPasswordById = async (role, userId) => {
    const isUserStaff = this.staffRoles.includes(role);
    const selectArgs = isUserStaff ? "-password" : "-password";

    return await User.findOne({ _id: userId, isDeleted: undefined })
      .select(selectArgs)
      .populate("managerDetails.staffLocationsVisibleToManager", [
        "firstName",
        "lastName",
        "role",
      ])
      .populate("staffDetails.earningRates.serviceId", ["name", "type"])
      .populate("staffDetails.assignedDealerships", [
        "firstName",
        "lastName",
        "email",
      ])
      .sort({ _id: -1 });
  };

  getAllStaffEarnings() {
    return User.aggregate([
      {
        $match: {
          role: "staff",
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          role: 1,
          totalEarnings: { $sum: "$staffDetails.earningHistory.amountEarned" },
          earningHistory: "$staffDetails.earningHistory",
        },
      },
    ]);
  }

  query = (role, selectArg) =>
    User.find({ role, isDeleted: undefined })
      .select(selectArg)
      .sort({ _id: -1 });

  getUsersByRole = async (role) => {
    if (role === "manager") {
      return User.find({ role, isDeleted: undefined })
        .select("-customerDetails -password")
        .populate("managerDetails.staffLocationsVisibleToManager", [
          "firstName",
          "lastName",
        ])
        .populate("departments")
        .sort({ _id: -1 });
    }

    return role === "customer"
      ? await this.query(role, "-departments -password")
      : await this.query(role, "-customerDetails -password");
  };

  getServicesWithoutEarningRateAndTotalEarnings(serviceIds, staffId) {
    return User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(staffId),
          role: "staff",
        },
      },
      {
        $addFields: {
          serviceIdsWithEarningRate: {
            $ifNull: [
              {
                $map: {
                  input: "$staffDetails.earningRates",
                  as: "earningRate",
                  in: "$$earningRate.serviceId",
                },
              },
              [],
            ],
          },
        },
      },
      {
        $addFields: {
          serviceIdsToCheck: {
            $map: {
              input: serviceIds,
              in: {
                $toObjectId: "$$this",
              },
            },
          },
        },
      },
      {
        $addFields: {
          totalEarnings: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: {
                      $ifNull: ["$staffDetails.earningRates", []],
                    },
                    cond: {
                      $in: ["$$this.serviceId", "$serviceIdsToCheck"],
                    },
                  },
                },
                in: "$$this.earningRate",
              },
            },
          },
        },
      },
      {
        $addFields: {
          serviceIdsWithoutEarningRate: {
            $filter: {
              input: "$serviceIdsToCheck",
              as: "serviceId",
              cond: {
                $not: {
                  $in: ["$$serviceId", "$serviceIdsWithEarningRate"],
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "serviceIdsWithoutEarningRate",
          foreignField: "_id",
          as: "servicesWithoutEarningRate",
        },
      },
      {
        $project: {
          _id: 0,
          servicesWithoutEarningRate: {
            $map: {
              input: "$servicesWithoutEarningRate",
              in: "$$this.name",
            },
          },
          totalEarnings: 1,
        },
      },
    ]);
  }

  getDealersAssignedToStaff(staffId) {
    return User.findOne({ _id: staffId, role: "staff" }).populate(
      "staffDetails.assignedDealerships",
      "customerDetails.qbId"
    );
  }

  assignOrRemoveDealershipFromStaff(staffId, customerId, remove) {
    const assignedDealershipsArray = {
      "staffDetails.assignedDealerships": customerId,
    };

    return User.findOneAndUpdate(
      { _id: staffId, role: "staff" },
      remove
        ? { $pull: assignedDealershipsArray }
        : { $addToSet: assignedDealershipsArray },
      { new: true }
    ).select(
      "-password -staffDetails.signInLocations -staffDetails.earningHistory"
    );
  }

  fetchStaffsAssignedToDealership(customerId) {
    return User.find({
      "staffDetails.assignedDealerships": customerId,
      role: "staff",
    }).select("firstName lastName email");
  }

  async fetchStaffIdsAssignedToDealership(customerId) {
    const staffs = await User.find({
      role: "staff",
      "staffDetails.assignedDealerships": customerId,
    });

    return staffs.map((staff) => staff._id);
  }

  isDealerAssignedToStaff(customerId, staffId) {
    return User.countDocuments({
      "staffDetails.assignedDealerships": customerId,
      _id: staffId,
    });
  }

  async getCustomersForStaff() {
    return await User.find({ role: "customer", isDeleted: undefined }).select(
      "firstName lastName id"
    );
  }

  async getEmployees() {
    return await User.find({
      role: { $ne: "customer" },
      isDeleted: undefined,
    })
      .select("-password")
      .populate("departments")
      .sort({ _id: -1 });
  }

  async getUserByRoleAndId(userId, role) {
    return await User.find({ _id: userId, role, isDeleted: undefined }).select(
      "-password"
    );
  }

  async getUserByEmail(email) {
    return await User.findOne({ email, isDeleted: undefined });
  }

  async getUserWithoutPasswordByEmail(email) {
    return await User.findOne({ email, isDeleted: undefined }).select(
      "-password"
    );
  }

  async getUserByUsername(userName) {
    return await User.findOne({ userName, isDeleted: undefined }).select(
      "-password"
    );
  }

  async getStaffsByDepartments(departmentIds) {
    return await User.find({
      departments: {
        $in: departmentIds,
      },
      role: "staff",
      isDeleted: undefined,
    })
      .select("-password")
      .sort({ _id: -1 });
  }

  async getAllUsers() {
    return await User.find({ isDeleted: undefined })
      .select("-password")
      .sort({ _id: -1 });
  }

  getDealershipStaffsByDealerId(dealershipId) {
    return User.find({
      "customerDetails.customerId": dealershipId,
    });
  }

  async addSignInLocation(email, signInLocations) {
    return await User.findOneAndUpdate(
      { email },
      {
        $push: { "staffDetails.signInLocations": signInLocations },
      },
      { new: true }
    );
  }

  async updateUserById(id, user) {
    return await User.findByIdAndUpdate(
      id,
      {
        $set: user,
      },
      { new: true }
    );
  }
  async updateCustomerByQbId(id, user) {
    return await User.findOneAndUpdate(
      { "customerDetails.qbId": id },
      {
        $set: user,
      },
      { new: true }
    );
  }

  findCustomerByQbId(qbId) {
    return User.findOne({
      "customerDetails.qbId": qbId,
      "customerDetails.canCreate": true,
      isDeleted: undefined,
    }).sort({ _id: 1 });
  }

  findCustomersByQbId(qbId) {
    return User.find({
      "customerDetails.qbId": qbId,
      "customerDetails.canCreate": undefined,
      isDeleted: undefined,
    }).sort({ _id: -1 });
  }

  async signInStaff(email, currentSignInLocation, session) {
    return User.findOneAndUpdate(
      { email },
      {
        $set: {
          "staffDetails.currentSignInLocation": currentSignInLocation,
          "staffDetails.isLoggedIn": true,
        },
      },
      session ? { session } : undefined
    );
  }

  async signOutStaff(email) {
    return User.findOneAndUpdate(
      { email },
      {
        $set: {
          "staffDetails.isLoggedIn": false,
        },
      }
    );
  }

  async getLoggedInStaffs(staffIds) {
    const findQuery = { $and: [{ "staffDetails.isLoggedIn": true }] };
    if (staffIds) findQuery.$and.push({ _id: { $in: staffIds } });

    return User.find(findQuery).select(
      "-password -staffDetails.signInLocations"
    );
  }

  getStaffQueues = () => {
    const leastActiveDay = this.subtractDaysThresholdFromActiveDays();

    return User.find({
      $and: [
        { role: "staff" },
        {
          $or: [
            {
              "staffDetails.mostRecentScannedTime": {
                $gte: leastActiveDay,
              },
            },
            {
              "staffDetails.mostRecentScannedTime": undefined,
            },
          ],
        },
      ],
    })
      .sort({
        "staffDetails.mostRecentScannedTime": 1,
      })
      .select("_id");
  };

  subtractDaysThresholdFromActiveDays() {
    const noOfActiveDaysThreshold = process.env.noOfActiveDaysThreshold;
    // Get the current date
    const currentDate = new Date();

    currentDate.setDate(currentDate.getDate() - noOfActiveDaysThreshold);

    // Return the new date
    return currentDate;
  }

  async updateStaffLocationsVisibleToManager({
    managerId,
    idToAdd,
    idToRemove,
  }) {
    const update = {};
    if (idToAdd) {
      update.$push = {
        "managerDetails.staffLocationsVisibleToManager": idToAdd,
      };
    }
    if (idToRemove) {
      update.$pull = {
        "managerDetails.staffLocationsVisibleToManager": idToRemove,
      };
    }

    return await User.findOneAndUpdate(
      { _id: managerId }, // Find the user by their ID
      update, // Use $pull to remove the locationIdToRemove from the array
      { new: true }
    ).select("-password");
  }

  updateStaffTotalEarnings = async (staff, session, amountToBeAdded) => {
    const date = new Date();

    const earningHistory = {
      timestamp: date,
      amountEarned: amountToBeAdded,
    };

    return await User.updateOne(
      { _id: staff._id },
      {
        $inc: {
          "staffDetails.totalEarning": amountToBeAdded,
        },
        $set: {
          "staffDetails.mostRecentScannedTime": date,
        },
        $push: {
          "staffDetails.earningHistory": earningHistory,
        },
      },
      { session }
    );
  };

  updateStaffEarningRates(staffId, earningRate) {
    return User.findByIdAndUpdate(
      staffId,
      {
        $addToSet: { "staffDetails.earningRates": earningRate },
      },
      { new: true }
    ).select("-password");
  }

  updateEarningRateForStaff(staffId, serviceId, newEarningRate) {
    return User.findOneAndUpdate(
      {
        _id: staffId,
        role: "staff",
        "staffDetails.earningRates.serviceId": serviceId,
      },
      {
        $set: {
          "staffDetails.earningRates.$[elem].earningRate": newEarningRate,
        },
      },
      {
        arrayFilters: [{ "elem.serviceId": serviceId }],
        new: true, // To return the updated document
      }
    );
  }

  async getToken() {
    const user = await User.findOne({ isAdmin: true });

    const token = user.generateAuthToken();

    return token;
  }

  deleteEarningRateForStaff(staffId, serviceId) {
    return User.findOneAndUpdate(
      {
        _id: staffId,
        role: "staff",
        "staffDetails.earningRates.serviceId": serviceId,
      },
      {
        $pull: {
          "staffDetails.earningRates": {
            serviceId,
          },
        },
      },
      {
        new: true, // To return the updated document
      }
    );
  }

  isServiceRateAlreadyAdded(staffId, serviceId) {
    return User.countDocuments({
      "staffDetails.earningRates.serviceId": serviceId,
      _id: staffId,
    });
  }

  getTotalAmountEarnedByStaffInASpecifiedTime(startDate, endDate, staffId) {
    const match = {
      $and: [{ role: "staff" }],
    };

    if (staffId) match.$and.push({ _id: new mongoose.Types.ObjectId(staffId) });

    return User.aggregate([
      {
        $match: match,
      },
      {
        $unwind: {
          path: "$staffDetails.earningHistory",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $and: [
            {
              "staffDetails.earningHistory.timestamp": {
                $gte: new Date(startDate),
              },
            },
            {
              "staffDetails.earningHistory.timestamp": {
                $lte: new Date(endDate),
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$_id",
          firstName: {
            $first: "$firstName",
          },
          lastName: {
            $first: "$lastName",
          },
          earningHistory: {
            $push: "$staffDetails.earningHistory",
          },
          totalAmountEarned: {
            $sum: "$staffDetails.earningHistory.amountEarned",
          },
        },
      },
    ]);
  }

  updateStaffTotalEarningsBasedOnInCentives = async (
    mongoSession,
    staffId,
    user,
    amountEarned,
    numberOfVehicleToAdd
  ) => {
    let activeIncentive = await isIncentiveActive();

    if (!activeIncentive) return undefined;

    const {
      startTime,
      endTime,
      amountToBePaid,
      numberOfVehiclesThreshold,
      eligibleStaffs,
    } = activeIncentive;

    const totalAmountEarned = amountToBePaid + amountEarned;
    const reqParam = {};
    reqParam.params = {};

    reqParam.params.startDate = startTime;
    reqParam.params.endDate = endTime;
    reqParam.params.staffId = staffId;

    const filterArguments = getFilterArguments(reqParam);

    const entries = await entryServices.getCarsDoneByStaff(...filterArguments);
    const { totalJobCount } = getJobCounts(entries);

    if (totalJobCount + numberOfVehicleToAdd >= numberOfVehiclesThreshold) {
      if (!eligibleStaffs.includes(new mongoose.Types.ObjectId(staffId))) {
        await this.updateStaffTotalEarnings(
          user,
          mongoSession,
          totalAmountEarned
        );

        let retryCount = 0;
        while (retryCount < 10) {
          try {
            activeIncentive.eligibleStaffs.push(staffId);

            const result = await activeIncentive.save({
              session: mongoSession,
            });

            return result;
          } catch (error) {
            if (error.name === "VersionError") {
              console.warn(
                "VersionError: Document has been modified by another process."
              );

              activeIncentive = await isIncentiveActive();

              retryCount++;
              console.log(`Retrying update. Retry count: ${retryCount}`);
            } else {
              // Handle other errors
              console.error("Error during update:", error);
              throw error; // Rethrow other errors
            }
          }
        }
      }
    }
  };

  updatePorterCurrentLocation = async (porter, session, geoLocation) => {
    const porterFromDB = await User.findById(porter._id).lean();
    const locationType = geoLocation.locationType;

    let currentTrips = porterFromDB.staffDetails.currentTrips;

    if (!currentTrips) {
      currentTrips = [];
    }

    for (let currentTrip of currentTrips) {
      if (currentTrip.locationType === locationType) {
        currentTrip = geoLocation;
      } else if (currentTrips.length < 2) {
        currentTrips.push(geoLocation);
      }
    }

    if (currentTrips.length < 1) {
      currentTrips.push(geoLocation);
    }

    return await User.updateOne(
      { _id: porter._id },
      { $set: { "staffDetails.currentTrips": currentTrips } },
      { session }
    );
  };

  async deleteUser(id) {
    return await User.findByIdAndRemove(id);
  }

  async addAvatarToUser(user) {
    const avatarUrl = await generateRandomAvatar(user.email);
    user.avatarUrl = avatarUrl;
    user.avatarImgTag = `<img src=${avatarUrl} alt=${user._id}>`;

    return user;
  }

  // modifyCustomer(req) {
  //   const { role, password } = req.body;

  //   if (role.toLowerCase() == "customer") {
  //     if (!password) req.body.password = process.env.customerPassword;

  //     propertiesToPick.push("customerDetails");
  //     const filteredFieldsArray = propertiesToPick.filter(
  //       (field) => field !== "departments"
  //     );
  //     return filteredFieldsArray;
  //   }
  //   return propertiesToPick;
  // }
  softDeleteUser = async (id) => {
    const user = await User.findById(id);
    const randomString = this.generateUniqueTicketId();

    user.isDeleted = true;
    user.email = `${user.email}-${randomString} (deleted)`;

    return await user.save();
  };

  generateUniqueTicketId() {
    const timestamp = Date.now().toString(36);
    const randomComponent = Math.random().toString(36).substr(2, 5);
    return `${timestamp.toUpperCase()}${randomComponent.toUpperCase()}`;
  }

  staffRoles = ["staff", "porter"];
}

module.exports = new UserService();
