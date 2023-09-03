const _ = require("lodash");
const jwt = require("jsonwebtoken");
const { User } = require("../model/user.model");
const userService = require("../services/user.services");
const { MESSAGES } = require("../common/constants.common");
const propertiesToPick = require("../common/propertiesToPick.common");
const { errorMessage, successMessage } = require("../common/messages.common");
const generateRandomAvatar = require("../utils/generateRandomAvatar.utils");
const departmentServices = require("../services/department.services");
const { transporter, mailOptions } = require("../utils/email.utils");
require("dotenv").config();
const bcrypt = require("bcrypt");

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

  //get all users in the user collection/table
  async passwordResetRequest(req, res) {
    const user = await userService.getUserByEmail(req.body.email);
    if (!user)
      return res.status(404).send({
        success: false,
        message:
          "We could not find an account associated with the email address you provided",
      });

    let token = jwt.sign({ id: user._id }, process.env.jwtPrivateKey, {
      expiresIn: "1h",
    });

    user.resetToken = token;
    await user.save();

    transporter.sendMail(
      mailOptions(user.email, user.firstName, token),
      (error, info) => {
        if (error) {
          return "Error occurred:", error;
        } else {
          console.log("Email sent successfully:", info.response);
        }
      }
    );

    res.send({
      message: "We've sent you a password reset email",
      success: true,
    });
  }

  async passwordReset(req, res) {
    let token = req.params.token;
    const { newPassword, confirmPassword } = req.body;

    // Verify token
    jwt.verify(token, process.env.jwtPrivateKey, async (err, decoded) => {
      if (err) {
        return res.status(400).json({ error: "Invalid or expired link" });
      }

      // Find user by id and update password
      let user = await userService.getUserById(decoded.id);
      if (!user) return res.status(400).json({ error: "User not found" });

      // Validate and save new password
      if (newPassword !== confirmPassword)
        return res.status(400).send({
          message: "New password and confirm password does not match",
          succes: false,
        });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);

      user.resetToken = undefined;
      user.save();

      res.json({ message: "Password updated", success: true });
    });
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

  async updateUserPassword(req, res) {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const user = await userService.getUserById(req.user._id);
    if (!user) return res.status(404).send(errorMessage("user"));

    //checks if the password is valid
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword)
      return res.status(400).send({
        message: "The password you provided is incorrect",
        succes: false,
      });

    if (newPassword !== confirmPassword)
      return res.status(400).send({
        message: "New password and confirm password does not match",
        succes: false,
      });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: "Password updated", success: true });
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
