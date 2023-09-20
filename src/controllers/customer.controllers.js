require("dotenv").config();
const axios = require("axios");
const QuickBooks = require("node-quickbooks");
const { getNewAccessToken } = require("./oauthToken.controllers");
const { MESSAGES } = require("../common/constants.common");
const { successMessage, jsonResponse } = require("../common/messages.common");
const { getOrSetCache, updateCache } = require("../utils/getOrSetCache.utils");
const { getLatestToken } = require("../services/token.services");
const { getAllCustomers } = require("../services/customer.service");
const customerService = require("../services/customer.service");
const { RefreshToken } = require("../model/refreshToken.model");

const { env } = process;
const expires = 1800;

const apiUrl = env.qboGetCustomerUrl;

class Customer {
  async getCustomers(req, res) {
    try {
      const id = req.params.id;
      const { data: customers } = await getOrSetCache(
        `customers?Id=${id}`,
        expires,
        getAllCustomers
      );

      //// 'customers' now contains an array of customer records from QuickBooksc
      res.send(successMessage(MESSAGES.FETCHED, customers));
    } catch (error) {
      console.error("Error fetching customers:", error);
      return res.send(successMessage(MESSAGES.FETCHED, error.message));
    }
  }
  async getCustomerById(req, res) {
    try {
      const id = req.params.id;

      const { data: customer, error } =
        await customerService.getOrSetCustomerOnCache(id);

      if (error)
        return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

      // 'customers' now contains an array of customer records from QuickBooksc
      return res.send(successMessage(MESSAGES.FETCHED, customer));
    } catch (error) {
      console.error("Error fetching customers:", error);
      return res.send(successMessage(MESSAGES.FETCHED, error.message));
    }
  }

  async createCustomer(req, res) {
    try {
      // Retrieve the access token and refresh token
      const accessToken = await getNewAccessToken();
      const refreshTokenData = await getOrSetCache(
        "refreshToken",
        expires,
        getLatestToken,
        [RefreshToken]
      );
      const refreshToken = refreshTokenData.token;
      if (refreshTokenData.error) return jsonResponse(res, 500, false, error);

      // Initialize the QuickBooks SDK
      const qbo = customerService.initializeQuickBooks(
        accessToken,
        refreshToken
      );

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
      res.status(200).json(successMessage("Customer created", createdCustomer));
    } catch (error) {
      console.error("Error in createCustomerAndCache:", error);
      res.status(500).json({ success: false, message: error });
    }
  }
}

module.exports = new Customer();
