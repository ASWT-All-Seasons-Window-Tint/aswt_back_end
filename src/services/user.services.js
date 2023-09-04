const { User } = require("../model/user.model");
const bcrypt = require("bcrypt");

class UserService {
  //Create new user
  async createUser(user) {
    const salt = await bcrypt.genSalt(10);
    // for hashing the password that is saved the database for security reasons
    user.password = await bcrypt.hash(user.password, salt);

    return await user.save();
  }

  async getUserById(userId) {
    return await User.findById(userId);
  }

  async getUsersByRole(role) {
    return await User.find({ role });
  }

  async getUserByRoleAndId(userId, role) {
    return await User.find({ _id: userId, role });
  }

  async getUserByEmail(email) {
    return await User.findOne({ email });
  }

  async getUserByUsername(userName) {
    return await User.findOne({ userName });
  }

  async getStaffsByDepartments(departmentIds) {
    return await User.find({
      departments: {
        $in: departmentIds,
      },
      role: "staff",
    });
  }

  async getAllUsers() {
    return await User.find({}).select("-password");
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
}

module.exports = new UserService();
