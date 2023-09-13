require("dotenv").config();
const _ = require("lodash");
const bcrypt = require("bcrypt");
const { User } = require("../model/user.model");
const propertiesToPick = require("../common/propertiesToPick.common");
const generateRandomAvatar = require("../utils/generateRandomAvatar.utils");

class UserService {
  //Create new user
  async createUser(user) {
    const salt = await bcrypt.genSalt(10);
    // for hashing the password that is saved the database for security reasons
    user.password = await bcrypt.hash(user.password, salt);

    return await user.save();
  }

  async getUserById(userId) {
    return await User.findOne({ _id: userId, isDeleted: undefined });
  }

  query = (role, selectArg) =>
    User.find({ role, isDeleted: undefined }).select(selectArg);

  getUsersByRole = async (role) => {
    return role === "customer"
      ? await this.query(role, "-departments")
      : await this.query(role, "-customerDetails");
  };

  async getEmployees() {
    return await User.find({
      role: { $ne: "customer" },
      isDeleted: undefined,
    })
      .select("-password")
      .populate("departments");
  }

  async getUserByRoleAndId(userId, role) {
    return await User.find({ _id: userId, role, isDeleted: undefined });
  }

  async getUserByEmail(email) {
    return await User.findOne({ email, isDeleted: undefined });
  }

  async getUserByUsername(userName) {
    return await User.findOne({ userName, isDeleted: undefined });
  }

  async getStaffsByDepartments(departmentIds) {
    return await User.find({
      departments: {
        $in: departmentIds,
      },
      role: "staff",
      isDeleted: undefined,
    });
  }

  async getAllUsers() {
    return await User.find({ isDeleted: undefined }).select("-password");
  }

  async addSignInLocation(email, signInLocations) {
    return await User.findOneAndUpdate(
      { email },
      {
        $push: { signInLocations },
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

  async deleteUser(id) {
    return await User.findByIdAndRemove(id);
  }

  createUserWithAvatar = async (req, user, departments) => {
    const modifiedPropertiesToPick = this.modifyCustomer(req);

    user = new User(
      _.pick(req.body, [...modifiedPropertiesToPick, "password"])
    );

    const avatarUrl = await generateRandomAvatar(user.email);
    user.avatarUrl = avatarUrl;
    user.avatarImgTag = `<img src=${avatarUrl} alt=${user._id}>`;

    user.role = user.role.toLowerCase();
    if (user.role !== "customer") user.departments = [...new Set(departments)];

    user = await this.createUser(user);

    const token = user.generateAuthToken();

    user = _.pick(user, propertiesToPick);
    // It creates a token which is sent as a header to the client

    return { user, token };
  };

  async addAvatarToUser(user) {
    const avatarUrl = await generateRandomAvatar(user.email);
    user.avatarUrl = avatarUrl;
    user.avatarImgTag = `<img src=${avatarUrl} alt=${user._id}>`;

    return user;
  }

  modifyCustomer(req) {
    const { role, password } = req.body;

    if (role.toLowerCase() == "customer") {
      if (!password) req.body.password = process.env.customerPassword;

      propertiesToPick.push("customerDetails");
      const filteredFieldsArray = propertiesToPick.filter(
        (field) => field !== "departments"
      );
      return filteredFieldsArray;
    }
    return propertiesToPick;
  }
  async softDeleteUser(id) {
    const user = await User.findById(id);

    user.isDeleted = true;

    return await user.save();
  }
}

module.exports = new UserService();
