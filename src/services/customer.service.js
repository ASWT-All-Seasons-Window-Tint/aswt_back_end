require("dotenv").config();
const axios = require("axios");
const { getNewAccessToken } = require("../utils/getNewAccessToken.utils");
const { getOrSetCache, updateCache } = require("../utils/getOrSetCache.utils");
const getWebhookDataUtils = require("../utils/getWebhookData.utils");
const initializeQbUtils = require("../utils/initializeQb.utils");

const expires = 1800;
class CustomerService {
  //Create new department
  async createCustomer(department) {
    return await department.save();
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
      qbo.findCustomers({ fetchAll: true }, (err, customers) => {
        if (err) {
          reject(err);
        } else {
          resolve(customers.QueryResponse.Customer);
        }
      });
    });
  }

  async fetchCustomersByPage(qbo, pageNumber, pageSize) {
    const limit = pageSize;
    const offset = limit * (pageNumber - 1);

    return new Promise((resolve, reject) => {
      qbo.findCustomers({ asc: "Id", limit, offset }, (err, service) => {
        if (err) {
          reject(err);
        } else {
          resolve(service.QueryResponse.Customer);
        }
      });
    });
  }

  async fetchCustomerByName(qbo, customerName) {
    const Name = customerName;

    return new Promise((resolve, reject) => {
      qbo.findCustomers(
        [{ field: "DisplayName", value: `%${Name}%`, operator: "LIKE" }],
        (err, service) => {
          if (err) {
            reject(err);
          } else {
            resolve(service.QueryResponse.Customer);
          }
        }
      );
    });
  }

  async fetchCustomersCount(qbo) {
    return new Promise((resolve, reject) => {
      qbo.findCustomers({ count: true }, (err, service) => {
        if (err) {
          reject(err);
        } else {
          resolve(service.QueryResponse.totalCount);
        }
      });
    });
  }

  updateCustomerOnRedisViaWebhook = async (apiEndpoint) => {
    const payload = await getWebhookDataUtils(apiEndpoint, getNewAccessToken);

    const id = payload.Customer.Id;
    const customer = payload.Customer;
    const qbo = await initializeQbUtils();
    const customers = await this.fetchAllCustomers(qbo);

    updateCache(`customers?Id=${id}`, expires, customer);
    updateCache(`customers`, expires, customers);
  };

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
