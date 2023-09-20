require("dotenv").config();
const QuickBooks = require("node-quickbooks");
const axios = require("axios");
const { getNewAccessToken } = require("../controllers/oauthToken.controllers");
const { getOrSetCache } = require("../utils/getOrSetCache.utils");
const initializeQbUtils = require("../utils/initializeQb.utils");

const { env } = process;
const apiUrl =
  "https://sandbox-quickbooks.api.intuit.com/v3/company/4620816365328527460/query?query=SELECT * FROM Customer";

const expires = 1800;
class CustomerService {
  //Create new department
  async createCustomer(department) {
    return await department.save();
  }

  async getAllCustomers() {
    const accessToken = await getNewAccessToken();

    const config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const { data } = await axios.get(apiUrl, config);

    return data.QueryResponse.Customer;
  }

  async getCustomerById(qbo, customerId) {
    // Initialize the QuickBooks SDK
    return new Promise((resolve, reject) => {
      qbo.getCustomer(customerId, (err, customer) => {
        if (err) {
          reject(err);
        } else {
          resolve(customer);
        }
      });
    });
  }

  getOrSetCustomerOnCache = async (id) => {
    const qbo = await initializeQbUtils();

    const results = await getOrSetCache(
      `customers?Id=${id}`,
      expires,
      this.getCustomerById,
      [qbo, id]
    );

    return results;
  };

  // Function to create a customer in QuickBooks
  createQuickBooksCustomer(qbo, customerData) {
    return new Promise((resolve, reject) => {
      qbo.createCustomer(customerData, (err, customer) => {
        if (err) {
          reject(err);
        } else {
          resolve(customer);
        }
      });
    });
  }

  // Function to fetch all customers
  async fetchAllCustomers(qbo) {
    return new Promise((resolve, reject) => {
      qbo.findCustomers((err, customers) => {
        if (err) {
          reject(err);
        } else {
          resolve(customers.QueryResponse.Customer);
        }
      });
    });
  }

  async updateCustomerById(id, department) {
    return await Customer.findByIdAndUpdate(
      id,
      {
        $set: department,
      },
      { new: true }
    );
  }

  async deleteCustomer(id) {
    return await Customer.findByIdAndRemove(id);
  }
}

module.exports = new CustomerService();
