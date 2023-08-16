const _ = require("lodash");
const { User } = require("../model/user.model");
const userService = require("../services/user.services");
const { MESSAGES } = require("../common/constants.common");
const propertiesToPick = require("../common/propertiesToPick.common");
const { errorMessage, successMessage } = require("../common/messages.common");
const generateRandomAvatar = require("../utils/generateRandomAvatar.utils");
const departmentServices = require("../services/department.services");
require("dotenv").config();

class UserController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new user
  async register(req, res) {
    const { role, password, departments, email } = req.body;

    // Checks if a user already exist by using the email id
    let [user, invalidIds] = await Promise.all([
      userService.getUserByEmail(email),
      departmentServices.validateDepartmentIds(departments),
    ]);
    if (user)
      return res
        .status(400)
        .send({ success: false, message: "User already registered" });

    if (invalidIds.length > 0)
      return res.status(400).send({
        message: `This ids: ${[invalidIds]} are not in the department`,
        success: false,
      });

    if (role.toLowerCase() == "customer" && !password)
      password = process.env.customerPassword;

    user = new User(_.pick(req.body, [...propertiesToPick, "password"]));

    user = new User(user);

    const avatarUrl = await generateRandomAvatar(user.email);
    user.avatarUrl = avatarUrl;
    user.avatarImgTag = `<img src=${avatarUrl} alt=${user._id}>`;

    user.role = user.role.toLowerCase();
    user.departments = [...new Set(departments)];

    user = await userService.createUser(user);

    // it creates a token which is sent as an header to the client
    const token = user.generateAuthToken();

    user = _.pick(user, propertiesToPick);

    res
      .header("x-auth-header", token)
      .header("access-control-expose-headers", "x-auth-token")
      // It determines what is sent back to the client
      .send(successMessage(MESSAGES.CREATED, user));
  }

  //get user from the database, using their email
  async gethUserById(req, res) {
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).send(errorMessage("user"));

    res.send(successMessage(MESSAGES.FETCHED, user));
  }

  async getStaffsByDepartments(req, res) {
    const staff = await userService.getStaffsByDepartments(
      req.user.departments
    );
    if (!staff) return res.status(404).send(errorMessage("staff"));

    res.send(successMessage(MESSAGES.FETCHED, staff));
  }

  //get all users in the user collection/table
  async fetchAllUsers(req, res) {
    const users = await userService.getAllUsers();

    res.send(successMessage(MESSAGES.FETCHED, users));
  }

  //Update/edit user data
  async updateUserProfile(req, res) {
    let user = await userService.getUserById(req.params.id);

    if (!user) return res.status(404).send(errorMessage("user"));

    let updatedUser = req.body;

    const avatarUrl = await generateRandomAvatar(user.email);

    updatedUser.avatarUrl = avatarUrl;
    updatedUser.avatarImgTag = `<img src=${avatarUrl} alt=${user._id}>`;

    updatedUser = await userService.updateUserById(req.params.id, updatedUser);

    res.send(successMessage(MESSAGES.UPDATED, updatedUser));
  }

  //Delete user account entirely from the database
  async deleteUserAccount(req, res) {
    const user = await userService.getUserById(req.params.id);

    if (!user) return res.status(404).send(errorMessage("user"));

    await userService.deleteUser(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, user));
  }
}

module.exports = new UserController();
