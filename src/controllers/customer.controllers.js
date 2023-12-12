require("dotenv").config();
const _ = require("lodash");
const { User } = require("../model/user.model").user;
const { MESSAGES } = require("../common/constants.common");
const { getOrSetCache, updateCache } = require("../utils/getOrSetCache.utils");
const customerService = require("../services/customer.service");
const initializeQbUtils = require("../utils/initializeQb.utils");
const errorChecker = require("../utils/paginationErrorChecker.utils");
const { register } = require("../controllers/user.controllers");
const userServices = require("../services/user.services");
const propertiesToPick = require("../common/propertiesToPick.common");
const { transporter, mailOptions } = require("../utils/email.utils");
const jwt = require("jsonwebtoken");
const {
  successMessage,
  jsonResponse,
  errorMessage,
  badReqResponse,
  EMAIL,
} = require("../common/messages.common");

const expires = 1800;

class Customer {
  async getCustomers(req, res) {
    const qbo = await initializeQbUtils();
    const { data: customers } = await getOrSetCache(
      `customers`,
      expires,
      customerService.fetchAllCustomers,
      [qbo]
    );

    //// 'customers' now contains an array of customer records from QuickBooksc
    return res.send(successMessage(MESSAGES.FETCHED, customers));
  }

  fetchCustomersByPage = async (req, res) => {
    const qbo = await initializeQbUtils();
    const { pageNumber, customerName, customerEmail } = req.params;
    const expiryTimeInSecs = 1800;
    const pageSize = 10;

    if (customerEmail || customerName) {
      const { error, customer } = await this.getCustomerByNameOrEmail({
        name: customerName,
        email: customerEmail,
        qbo,
      });
      if (error) return jsonResponse(res, 404, false, error);

      return res.send(successMessage(MESSAGES.FETCHED, customer));
    }

    const { data: count } = await getOrSetCache(
      `customerCount`,
      expiryTimeInSecs,
      customerService.fetchCustomersCount,
      [qbo]
    );

    const totalPages = Math.ceil(count / pageSize);

    const { message } = errorChecker(pageNumber, totalPages);
    if (message) return jsonResponse(res, 400, false, message);

    const { data: customers, error: customersError } = await getOrSetCache(
      `customers?pageNumber${pageNumber}`,
      expiryTimeInSecs,
      customerService.fetchCustomersByPage,
      [qbo, pageNumber, pageSize]
    );

    if (customersError) return jsonResponse(res, 404, false, customersError);

    return res.send(successMessage(MESSAGES.FETCHED, customers));
  };

  async getCustomerByNameOrEmail({ email, name, qbo }) {
    const expiryTimeInSecs = 1800;

    const { data: customer, error } = await getOrSetCache(
      email
        ? `customers?email${email.toLowerCase()}`
        : `customers?name${name.toLowerCase()}`,
      expiryTimeInSecs,
      email
        ? customerService.fetchCustomerByEmail
        : customerService.fetchCustomerByName,
      [qbo, email ? email.toLowerCase() : name.toLowerCase()]
    );

    return { customer, error };
  }

  async getCustomerById(req, res) {
    const id = req.params.id;

    const { data: customer, error } =
      await customerService.getOrSetCustomerOnCache(id);

    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    // 'customers' now contains an array of customer records from QuickBooksc
    return res.send(successMessage(MESSAGES.FETCHED, customer));
  }

  async getCustomersByIds(ids) {
    const { data: customers, error } =
      await customerService.getOrSetCustomersOnCache(ids);

    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    // 'customers' now contains an array of customer records from QuickBooksc
    return customers;
  }

  async updateCustomerById(req, res) {
    const { DisplayName, PrimaryEmailAddr } = req.body;

    const id = req.params.id;
    const qbo = await initializeQbUtils();

    const { data: customer, error } =
      await customerService.getOrSetCustomerOnCache(id);

    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    const { Id, SyncToken } = customer;

    const updatedCustomer = await customerService.updateCustomerById(
      qbo,
      Id,
      req.body,
      SyncToken
    );

    let firstName, lastName;

    const nameArray = DisplayName ? DisplayName.split(" ") : undefined;

    if (nameArray)
      [firstName, lastName] =
        nameArray.length === 1 ? [nameArray[0], nameArray[0]] : nameArray;

    req.body = {
      firstName,
      lastName,
      customerDetails: {
        companyName: req.body.CompanyName,
      },
    };

    await userServices.updateCustomerByQbId(Id, req.body);

    // Fetch all customers and update the cache
    const customers = await customerService.fetchAllCustomers(qbo);

    updateCache(`customers?Id=${id}`, expires, updatedCustomer);
    updateCache(`customers`, expires, customers);

    return res.send(successMessage(MESSAGES.FETCHED, updatedCustomer));
  }

  async createCustomer(req, res) {
    const qbo = await initializeQbUtils();
    const { DisplayName, PrimaryEmailAddr, PrimaryPhone, BillAddr, Notes } =
      req.body;

    let alterNativeEmails;
    let completeNotes;

    const accountNumber = await User.getNextAccountNumber();

    if (Notes) {
      const validNote =
        "{'AlternativeEmails': ['test@example.com', 'test2@example.com']}";

      const alternativeEmailsObject = customerService.extractJSONObject(Notes);
      if (!alternativeEmailsObject)
        return badReqResponse(
          res,
          `Invalid alternative notes format, valid format: ${validNote}`
        );

      const { error } = customerService.validateAlternativeEmails(
        alternativeEmailsObject
      );

      if (error)
        return res
          .status(400)
          .send({ success: false, message: error.details[0].message });

      alterNativeEmails = alternativeEmailsObject.AlternativeEmails;

      alternativeEmailsObject.AccountNumber = accountNumber;

      completeNotes = JSON.stringify(alternativeEmailsObject);
    }
    // Create the customer in QuickBooks
    const customerData = {
      DisplayName: DisplayName,
      PrimaryEmailAddr: PrimaryEmailAddr,
      PrimaryPhone: PrimaryPhone,
      BillAddr: BillAddr,
      Notes: completeNotes,
      CompanyName: req.body.CompanyName,
    };
    const expiryTimeInSecs = 1800;

    const { data: customer, error } = await getOrSetCache(
      `customers?name${DisplayName.toLowerCase()}`,
      expiryTimeInSecs,
      customerService.fetchCustomerByDisplayName,
      [qbo, DisplayName.toLowerCase()]
    );

    const createdCustomer = error
      ? await customerService.createQuickBooksCustomer(qbo, customerData)
      : customer[0];
    const id = createdCustomer.Id;

    const nameArray = DisplayName.split(" ");

    const [firstName, lastName] =
      nameArray.length === 1 ? [nameArray[0], nameArray[0]] : nameArray;

    req.body = {
      ...req.body,
      firstName,
      lastName,
      email: PrimaryEmailAddr.Address,
      role: "customer",
      customerDetails: {
        qbId: id,
        companyName: req.body.CompanyName,
        accountNumber,
        alterNativeEmails,
        canCreate: true,
      },
    };

    // Fetch all customers and update the cache
    const customers = await customerService.fetchAllCustomers(qbo);

    updateCache(`customers?Id=${id}`, expires, createdCustomer);
    updateCache(`customers`, expires, customers);

    await register(req, res, createdCustomer);
    // Send a success response
  }

  sendRegistrationLink(req, res) {
    const { email, name } = req.body;

    req.user.isTemporal = true;

    const token = jwt.sign(req.user, process.env.jwtPrivateKey);

    const aswtDetails = JSON.parse(process.env.aswtDetails);

    const baseUrl = aswtDetails.invitationLink;
    const invitationLink = `${baseUrl}/${token}`;

    transporter.sendMail(
      EMAIL.invintationLinkBody(
        email,
        req.user.firstName,
        invitationLink,
        name
      ),
      (error, info) => {
        if (error) {
          console.log(error);
          return "Error occurred:", error;
        } else {
          console.log("Email sent successfully");
        }
      }
    );

    jsonResponse(res, 200, true, "Email sent successfully");
  }
  //Delete user account entirely from the database
  async deleteUserAccount(req, res) {
    let user = await userServices.findCustomerByQbId(req.params.id);
    if (!user) return res.status(404).send(errorMessage("user"));

    const id = user._id;

    if (user.isAdmin)
      return badReqResponse(res, "You can not delete an admin account");

    await userServices.softDeleteUser(id);

    user = _.pick(user, propertiesToPick);

    res.send(successMessage(MESSAGES.DELETED, user));
  }
}

module.exports = new Customer();
