require("dotenv").config();
const QuickBooks = require("node-quickbooks");
const axios = require("axios");
const { getNewAccessToken } = require("../controllers/oauthToken.controllers");

const { env } = process;
const apiUrl =
  "https://sandbox-quickbooks.api.intuit.com/v3/company/4620816365328527460/query?query=SELECT * FROM Customer";

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

  getCustomerById(qbo, customerId) {
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

  // Function to initialize the QuickBooks SDK
  initializeQuickBooks(accessToken, refreshToken) {
    return new QuickBooks(
      env.clientId,
      env.clientSecret,
      accessToken,
      false,
      env.realmId,
      true,
      true,
      null,
      "2.0",
      refreshToken
    );
  }
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
