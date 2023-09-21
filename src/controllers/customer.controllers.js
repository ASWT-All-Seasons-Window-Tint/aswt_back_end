require("dotenv").config();
const axios = require("axios");
const QuickBooks = require("node-quickbooks");
const { getNewAccessToken } = require("../utils/getNewAccessToken.utils");
const { MESSAGES } = require("../common/constants.common");
const { successMessage, jsonResponse } = require("../common/messages.common");
const { getOrSetCache, updateCache } = require("../utils/getOrSetCache.utils");
const { getLatestToken } = require("../services/token.services");
const { getAllCustomers } = require("../services/customer.service");
const customerService = require("../services/customer.service");
const initializeQbUtils = require("../utils/initializeQb.utils");

const { env } = process;
const expires = 1800;

const apiUrl = env.qboGetCustomerUrl;

class Customer {
  async getCustomers(req, res) {
    const qbo = await initializeQbUtils();
    const id = req.params.id;
    const { data: customers } = await getOrSetCache(
      `customers?Id=${id}`,
      expires,
      customerService.fetchAllCustomers,
      [qbo]
    );

    //// 'customers' now contains an array of customer records from QuickBooksc
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
