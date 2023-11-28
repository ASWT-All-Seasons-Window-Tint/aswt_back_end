require("dotenv").config();
const { validUserRoles } = require("../model/user.model").user;
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const userService = require("../services/user.services");
const { MESSAGES } = require("../common/constants.common");
const { errorMessage, successMessage } = require("../common/messages.common");
const generateRandomAvatar = require("../utils/generateRandomAvatar.utils");
const departmentServices = require("../services/department.services");
const { transporter, mailOptions } = require("../utils/email.utils");
const bcrypt = require("bcrypt");
const propertiesToPick = require("../common/propertiesToPick.common");
const {
  jsonResponse,
  badReqResponse,
  forbiddenResponse,
} = require("../common/messages.common");

class UserController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new user
  async register(req, res, customer) {
    const { departments, email, role } = req.body;
    const { createUserWithAvatar } = userService;

    if (req.body.departments)
      if (typeof req.body.departments[0] !== "string")
        return jsonResponse(res, 400, false, "invalid ID");

    const reqRole = req.user.role;

    if (reqRole === "customer") {
      req.body.role = "customer";

      req.body.isCustomer = true;
      req.body.customerDetails = req.user.customerDetails;

      delete req.body.customerDetails.canCreate;
    }

    const forbiddenRoles = {
      gm: ["gm", "admin"],
      manager: ["gm", "admin", "manager"],
      customer: validUserRoles,
    };

    if (reqRole !== "admin" && forbiddenRoles[reqRole].includes(role))
      return forbiddenResponse(res, `Only admins can create ${role}`);

    req.body.email = req.body.email.toLowerCase();
    // Checks if a user already exist by using the email id
    let [user, invalidIds] = await Promise.all([
      userService.getUserByEmail(email),
      departmentServices.validateDepartmentIds(departments),
    ]);

    if (user) return jsonResponse(res, 400, false, MESSAGES.USER_EXISTS);
    if (invalidIds.length > 0)
      return jsonResponse(
        res,
        400,
        false,
        MESSAGES.INVALID(invalidIds, "departments")
      );

    const userWithAvatar = await createUserWithAvatar(req, user, departments);

    if (customer) return res.send(successMessage(MESSAGES.CREATED, customer));
    res
      .header("x-auth-header", userWithAvatar.token)
      .header("access-control-expose-headers", "x-auth-token")
      // It determines what is sent back to the client
      .send(successMessage(MESSAGES.CREATED, userWithAvatar.user));
  }

  //get user from the database, using their email
  async gethUserById(req, res) {
    const { getUserWithoutPasswordById, staffRoles } = userService;
    const role = req.user.role;
    const isUserStaffOrPorter = staffRoles.includes(role);
    const totalArgs = [role];

    isUserStaffOrPorter
      ? totalArgs.push(req.user._id)
      : totalArgs.push(req.params.id);

    const user = await getUserWithoutPasswordById(...totalArgs);

    if (!user) return res.status(404).send(errorMessage("user"));

    const count = await userService.countStaffsWhoCanTakeAppointments();
    console.log(count);

    return res.send(successMessage(MESSAGES.FETCHED, user));
  }

  async getStaffsByDepartments(req, res) {
    const staff = await userService.getStaffsByDepartments(
      req.user.departments
    );
    if (!staff) return res.status(404).send(errorMessage("staff"));

    res.send(successMessage(MESSAGES.FETCHED, staff));
  }

  async getLoggedInStaffs(req, res) {
    const { role } = req.user;

    let loggedInStaff = [];

    let staffIds = undefined;
    if (role === "manager") {
      const manager = await userService.getUserById(req.user._id);
      if (!manager) return res.status(404).send(errorMessage("manager"));

      if (!manager.managerDetails) manager.managerDetails = {};

      staffIds = manager.managerDetails.staffLocationsVisibleToManager;

      if (!staffIds || staffIds.length < 1)
        return res.send(successMessage(MESSAGES.FETCHED, loggedInStaff));
    }

    loggedInStaff = await userService.getLoggedInStaffs(staffIds);

    res.send(successMessage(MESSAGES.FETCHED, loggedInStaff));
  }

  async getTotalAmountEarnedByStaffInASpecifiedTime(req, res) {
    const { startDate, endDate, staffId } = req.params;

    const staffsDetails =
      await userService.getTotalAmountEarnedByStaffInASpecifiedTime(
        startDate,
        endDate,
        staffId
      );

    res.send(successMessage(MESSAGES.FETCHED, staffsDetails));
  }

  async updateStaffLocationsVisibleToManager(req, res) {
    const { managerId } = req.params;
    const { idToAdd, idToRemove } = req.body;

    const [manager] = await userService.getUserByRoleAndId(
      managerId,
      "manager"
    );
    if (!manager) return res.status(404).send(errorMessage("manager"));

    if (idToAdd === idToRemove)
      return jsonResponse(
        res,
        403,
        false,
        "You are not allowed to add and remove the same staff"
      );

    if (!manager.managerDetails) manager.managerDetails = {};

    if (idToAdd) {
      const staffIds = manager.managerDetails.staffLocationsVisibleToManager;

      if (staffIds) {
        const staffIdsToString =
          staffIds.length > 0 ? staffIds.map((id) => id.toString()) : staffIds;

        if (staffIdsToString.includes(idToAdd))
          return badReqResponse(res, "User already added for this manager");
      }
    }

    const definedIds = [idToAdd, idToRemove].filter((id) => id);

    const { users, missingIds } = await userService.getUsersByIdArray(
      definedIds
    );

    if (missingIds.length > 0)
      return jsonResponse(
        res,
        400,
        false,
        `Users with IDs: [${missingIds}] could not be found`
      );

    for (const user of users) {
      const role = user.role;
      const staffRoles = userService.staffRoles;
      if (!staffRoles.includes(role))
        return badReqResponse(
          res,
          "Only staffs and porters can be added or removed"
        );
    }

    const updatedManageer =
      await userService.updateStaffLocationsVisibleToManager({
        managerId,
        idToAdd,
        idToRemove,
      });

    res.send(successMessage(MESSAGES.UPDATED, updatedManageer));
  }

  //get all users in the user collection/table
  async fetchAllUsers(req, res) {
    const users =
      req.user.role === "manager"
        ? await userService.getStaffsByDepartments(req.user.departments)
        : await userService.getAllUsers();

    res.send(successMessage(MESSAGES.FETCHED, users));
  }

  async getUsersByRole(req, res) {
    const users =
      req.user.role === "staff"
        ? await userService.getCustomersForStaff()
        : await userService.getUsersByRole(req.params.role);

    res.send(successMessage(MESSAGES.FETCHED, users));
  }

  async getEmployees(req, res) {
    const users = await userService.getEmployees();

    res.send(successMessage(MESSAGES.FETCHED, users));
  }

  async getDocumentsExcludingIDs(req, res) {
    const { managerId } = req.params;

    const [manager] = await userService.getUserByRoleAndId(
      managerId,
      "manager"
    );

    if (!manager) return res.status(404).send(errorMessage("manager"));

    const staffIds = userService.getStaffIdsAddedForManager(manager);

    const staffsNotAddedForManager =
      await userService.findDocumentsExcludingIDs(staffIds);

    return res.send(successMessage(MESSAGES.FETCHED, staffsNotAddedForManager));
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

    const url = process.env.clientUrl;
    const link = `${url}/?token=${token}`;
    const { firstName, email: receiversEmail } = user;

    transporter.sendMail(
      mailOptions({
        receiversEmail,
        firstName,
        link,
      }),
      (error, info) => {
        if (error) {
          return "Error occurred:", error;
        } else {
          console.log("Email sent successfully");
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
    let { role } = req.body;

    const roleOfUserMakingRequest = req.user.role;
    const forbiddenRolesForManager = ["admin", "gm", "manager"];

    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).send(errorMessage("user"));

    if (role) {
      req.body.role = role.toLowerCase();
      role = role.toLowerCase();

      if (user.isAdmin)
        return badReqResponse(res, "Cannot change role of an admin");

      if (role === "staff") {
        const staffDetails = user.staffDetails ? user.staffDetails : {};
        staffDetails.earningRate = req.body.staffDetails.earningRate;

        req.body.staffDetails = staffDetails;
      }

      if (roleOfUserMakingRequest === "manager") {
        if (forbiddenRolesForManager.includes(role))
          return forbiddenResponse(
            res,
            `A manager cannot promote the requested user to ${role} role.`
          );

        if (forbiddenRolesForManager.includes(user.role)) {
          return forbiddenResponse(
            res,
            `Managers can not modify the details of ${user.role.toUpperCase()}S.`
          );
        }
      }
      if (role === "manager") {
        req.body.managerDetails = {};
        req.body.managerDetails.staffLocationsVisibleToManager = [];
      }
    }

    let updatedUser = req.body;

    const avatarUrl = await generateRandomAvatar(user.email);

    updatedUser.avatarUrl = avatarUrl;
    updatedUser.avatarImgTag = `<img src=${avatarUrl} alt=${user._id}>`;

    updatedUser = await userService.updateUserById(req.params.id, updatedUser);

    updatedUser = _.pick(updatedUser, propertiesToPick);

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
    let user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).send(errorMessage("user"));

    if (user.isAdmin)
      return badReqResponse(res, "You can not delete an admin account");

    await userService.softDeleteUser(req.params.id);

    user = _.pick(user, propertiesToPick);

    res.send(successMessage(MESSAGES.DELETED, user));
  }
}

module.exports = new UserController();
