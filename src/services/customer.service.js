require("dotenv").config();
const Joi = require("joi");
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

  getOrSetCustomersOnCache = async (ids) => {
    const qbo = await initializeQbUtils();

    const results = await getOrSetCache(
      `customers?Ids=${ids}`,
      expires,
      this.fetchCustomersByIds,
      [qbo, ids]
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

  async fetchCustomerByDisplayName(qbo, customerName) {
    return new Promise((resolve, reject) => {
      qbo.findCustomers(
        [{ field: "DisplayName", value: customerName, operator: "=" }],
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

  async fetchCustomerByEmail(qbo, customerEmail) {
    return new Promise((resolve, reject) => {
      qbo.findCustomers(
        [
          {
            field: "PrimaryEmailAddr",
            value: customerEmail,
            operator: "LIKE",
          },
        ],
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
  async fetchCustomersByIds(qbo, Ids) {
    return new Promise((resolve, reject) => {
      qbo.findCustomers(
        [
          {
            field: "Id",
            value: Ids,
            operator: "IN",
          },
        ],
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

  createCustomerFromAppointmentDetails = async (qbo, appointment) => {
    const customerReqBody = this.convertToDesiredFormat(appointment);

    const createCustomer = async (reqBody) => {
      return new Promise((resolve, reject) => {
        qbo.createCustomer(reqBody, (err, customer) => {
          if (err) {
            const errorResponseLowercase = JSON.parse(
              JSON.stringify(err).toLowerCase()
            );
            if (errorResponseLowercase.fault) {
              const type = errorResponseLowercase.fault.type;

              if (type === "validationfault") {
                const message = errorResponseLowercase.fault.error[0].message;
                const duplicateDisplayNameError = "duplicate name exists error";

                if (message === duplicateDisplayNameError) {
                  // Append a unique ID to the DisplayName
                  const uniqueID = generateUniqueID(); // Function to generate a unique ID
                  const updatedDisplayName = `${customerReqBody.DisplayName}-${uniqueID}`;
                  customerReqBody.DisplayName = updatedDisplayName;

                  // Retry creating the customer with the updated DisplayName
                  resolve(createCustomer(customerReqBody));
                }
              }
            }

            reject(err);
          } else {
            resolve(customer);
          }
        });
      });
    };

    function generateUniqueID() {
      // Implement your logic to generate a unique ID here
      // Example: Generate a random string or a timestamp
      return Math.random().toString(36).substring(7); // Generating a random string
    }

    return createCustomer(customerReqBody);
  };

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

  async updateCustomerById(qbo, Id, customer, SyncToken) {
    return new Promise((resolve, reject) => {
      qbo.updateCustomer(
        {
          Id,
          SyncToken,
          sparse: true,
          ...customer,
        },
        (err, customer) => {
          if (err) {
            reject(err);
          } else {
            resolve(customer);
          }
        }
      );
    });
  }

  formatAddress(address) {
    // Destructure the properties of the address object
    const { Line1, City, Country, PostalCode } = address;
  
    // Create a formatted string
    const formattedAddress = `${Line1}, ${City}, ${Country} - ${PostalCode}`;
  
    return formattedAddress;
  }

  extractJSONObject(inputString) {
    const validInputStringJson = inputString.replace(/'/g, '"');

    const openBraceIndex = validInputStringJson.indexOf("{");
    const closeBraceIndex = validInputStringJson.lastIndexOf("}");

    if (
      openBraceIndex !== -1 &&
      closeBraceIndex !== -1 &&
      closeBraceIndex > openBraceIndex
    ) {
      const jsonObjectString = validInputStringJson.substring(
        openBraceIndex,
        closeBraceIndex + 1
      );
      try {
        const jsonObject = JSON.parse(jsonObjectString);
        return jsonObject;
      } catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
      }
    } else {
      return null;
    }
  }

  validateAlternativeEmails(entry) {
    const schema = Joi.object({
      AlternativeEmails: Joi.array().items(Joi.string().email().required()),
    });

    return schema.validate(entry);
  }

  async deleteCustomer(id) {
    return await Customer.findByIdAndRemove(id);
  }

  convertToDesiredFormat(data) {
    const { customerEmail, customerName, customerNumber } = data;

    const convertedData = {
      DisplayName: customerName,
      PrimaryEmailAddr: {
        Address: customerEmail,
      },
      PrimaryPhone: {
        FreeFormNumber: customerNumber,
      },
    };

    return convertedData;
  }
}

module.exports = new CustomerService();
