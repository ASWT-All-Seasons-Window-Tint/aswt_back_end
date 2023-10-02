require("dotenv").config();
const { MESSAGES } = require("../common/constants.common");
const { successMessage, jsonResponse } = require("../common/messages.common");
const { getOrSetCache, updateCache } = require("../utils/getOrSetCache.utils");
const customerService = require("../services/customer.service");
const initializeQbUtils = require("../utils/initializeQb.utils");
const errorChecker = require("../utils/paginationErrorChecker.utils");

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

  async fetchCustomersByPage(req, res) {
    const qbo = await initializeQbUtils();
    const { pageNumber, customerName } = req.params;
    const expiryTimeInSecs = 1800;
    const pageSize = 10;

    if (customerName) {
      const { data: customer, error } = await getOrSetCache(
        `customers?name${customerName.toLowerCase()}`,
        expiryTimeInSecs,
        customerService.fetchCustomerByName,
        [qbo, customerName]
      );
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
      customerService.fetchAllCustomers,
      [qbo, pageNumber, pageSize]
    );

    if (customersError) return jsonResponse(res, 404, false, customersError);

    return res.send(successMessage(MESSAGES.FETCHED, customers));
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

  async createCustomer(req, res) {
    const qbo = await initializeQbUtils();

    // Create the customer in QuickBooks
    const customerData = {
      DisplayName: req.body.DisplayName,
      PrimaryEmailAddr: req.body.PrimaryEmailAddr,
      PrimaryPhone: req.body.PrimaryPhone,
      BillAddr: req.body.BillAddr,
      Notes: req.body.Notes,
      CompanyName: req.body.CompanyName,
    };

    const createdCustomer = await customerService.createQuickBooksCustomer(
      qbo,
      customerData
    );
    const id = createdCustomer.Id;

    // Fetch all customers and update the cache
    const customers = await customerService.fetchAllCustomers(qbo);

    updateCache(`customers?Id=${id}`, expires, createdCustomer);
    updateCache(`customers`, expires, customers);

    // Send a success response
    return res
      .status(200)
      .json(successMessage("Customer created", createdCustomer));
  }
}

module.exports = new Customer();
