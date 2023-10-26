require("dotenv").config();
const _ = require("lodash");
const bcrypt = require("bcrypt");
const { User } = require("../model/user.model").user;
const propertiesToPick = require("../common/propertiesToPick.common");
const generateRandomAvatar = require("../utils/generateRandomAvatar.utils");

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
      "staffDetails.isAvailableForAppointments": true,
    });

    return staffsWhoCanTakeAppointments.map((staff) => staff._id);
  }

  createUserWithAvatar = async (req, user, departments) => {
    const { body } = req;
    const staffRoles = ["staff", "porter"];
    if (staffRoles.includes(body.role)) propertiesToPick.push("staffDetails");
    if (body.role === "customer") {
      propertiesToPick.push("customerDetails");

      if (!body.password) req.body.password = customerDefaultPassword;
    }

    user = new User(_.pick(body, [...propertiesToPick, "password"]));

    const avatarUrl = await generateRandomAvatar(user.email);
    user.avatarUrl = avatarUrl;
    user.avatarImgTag = `<img src=${avatarUrl} alt=${user._id}>`;

    user.role = user.role.toLowerCase();
    if (user.role === "staff" || user.role === "manager")
      user.departments = [...new Set(departments)];

    user = await this.createUser(user);

    const token = user.generateAuthToken();
    if (staffRoles.includes(body.role)) propertiesToPick.push("staffDetails");
    if (user.role === "customer") propertiesToPick.push("customerDetails");

    user = _.pick(user, propertiesToPick);
    // It creates a token which is sent as a header to the client

    return { user, token };
  };

  async getUserById(userId) {
    return await User.findOne({ _id: userId, isDeleted: undefined });
  }

  async getUserWithoutPasswordById(role, userId) {
    const isUserStaff = role === "staff";
    const selectArgs = isUserStaff ? "-password" : "-password -staffDetails";

    return await User.findOne({ _id: userId, isDeleted: undefined }).select(
      selectArgs
    );
  }

  query = (role, selectArg) =>
    User.find({ role, isDeleted: undefined }).select(selectArg);

  getUsersByRole = async (role) => {
    return role === "customer"
      ? await this.query(role, "-departments -password")
      : await this.query(role, "-customerDetails -password");
  };

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
      .populate("departments");
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
    }).select("-password");
  }

  async getAllUsers() {
    return await User.find({ isDeleted: undefined }).select("-password");
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
    return User.findOne({ "customerDetails.qbId": qbId, isDeleted: undefined });
  }

  async signInStaff(email, currentSignInLocation) {
    return User.findOneAndUpdate(
      { email },
      {
        $set: {
          "staffDetails.currentSignInLocation": currentSignInLocation,
          "staffDetails.isLoggedIn": true,
        },
      }
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

  updateStaffTotalEarnings = async (staff, session) => {
    const staffFromDb = await User.findById(staff._id).session(session);
    staff = staffFromDb;

    const staffEarningRate = staff.staffDetails.earningRate;

    return await User.updateOne(
      { _id: staff._id },
      { $inc: { "staffDetails.totalEarning": staffEarningRate } },
      { session }
    );
  };

  updatePorterCurrentLocation = async (porter, session, geoLocation) => {
    return await User.updateOne(
      { _id: porter._id },
      { $set: { "staffDetails.currentTrip": geoLocation } },
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
  async softDeleteUser(id) {
    const user = await User.findById(id);

    user.isDeleted = true;

    return await user.save();
  }

  staffRoles = ["staff", "porter"];
}

module.exports = new UserService();
