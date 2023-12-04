const mongoose = require("mongoose");
const { env } = process;
const constants = {
  DATABASE_URI: process.env.DATABASE_URI,
  noSpecials: /^[a-zA-Z0-9_]+$/,
  vinRegex: /\b(?:[A-HJ-NPR-Z0-9]{17})\b/,
  DATABASES: {
    ROOM: "room",
    ROOM_TYPE: "room_type",
    USER: "user",
  },
  USER_TYPES: {
    USER: "user",
    ADMIN: "admin",
  },
  apiEndpoint: `https://sandbox-quickbooks.api.intuit.com/v3/company/${env.realmId}/payment/${env.paymentId}`,
  tokenSchema: new mongoose.Schema({
    realmId: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    expires: {
      type: Date,
      // Set the 'expires' field as a TTL index
      index: { expireAfterSeconds: 0 }, // 0 means documents expire immediately after 'expires' date
    },
  }),
  MESSAGES: {
    FETCHED: "Resource fetched successfully",
    UPDATED: "Resource updated successfully",
    ERROR: "Resource error",
    CREATED: "Resource created successfully",
    DELETED: "Resource deleted successfully",
    UNAUTHORIZE(operate) {
      return `You cannot ${operate} a resource created by another user`;
    },
    NOT_FOUND(resource) {
      return `We can't find ${resource} with the given ID`;
    },
    SUCCESFUL_LOGIN: "Sucessfully logged in",
    SUCCESFUL_LOGOUT: "Sucessfully logged out",
    LOGIN_FAILURE: "Unable to login. Username or password incorrect",
    USER_EXISTS: "User already registered",
    INVALID(ids, collection) {
      return `This ids: [${ids}] are not in the ${collection}`;
    },
  },
  DATE: {
    now: new Date(),
    yesterday: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
    twentyFourHoursInMs: 24 * 60 * 60 * 1000,
  },
  EXPIRES: 1800,

  errorMessage: (data) => {
    return {
      message: `We can't find ${data} with the given ID`,
      success: false,
    };
  },
  errorAlreadyExists(resource) {
    return {
      message: `The ${resource} has been already created.`,
      success: false,
    };
  },
  days: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  validMonthNames: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  FREE_TIME_SLOTS: {
    VALID_TIME_SLOTS() {
      const VALID_TIME_SLOTS = [];
      const startTime = "09:00";
      const endTime = "17:00";

      // Split the start and end time into hours and minutes
      const [startHour, startMinute] = startTime.split(":").map(Number);
      const [endHour, endMinute] = endTime.split(":").map(Number);

      // Loop through the time slots
      for (let hour = startHour; hour <= endHour; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          // Format the hour and minute as "hh:mm"
          const formattedHour = String(hour).padStart(2, "0");
          const formattedMinute = String(minute).padStart(2, "0");
          const currentTime = `${formattedHour}:${formattedMinute}`;

          // Check if the current time exceeds the end time and stop if necessary
          if (currentTime > endTime) {
            break;
          }

          VALID_TIME_SLOTS.push(currentTime);
        }
      }
      return VALID_TIME_SLOTS;
    },
    COMPLETION_TIME_HOURS: 3,
    START_OF_BUSINESS: 9,
    TIME_OFFSET: 0.001,
  },
  transactionOptions: {
    readPreference: "primary",
    readConcern: { level: "local" },
    writeConcern: { w: "majority" },
  },

  NOTIFICATIONS: {
    TITLES: {
      TAKEN_TO_SHOP: `Vehicle Assignment Notification`,
      VEHICLE_COMPLETED: `Completed Vehicle Ready for Porter`,
      WAITING_LIST_COMPLETED: `Completion of Waiting List Vehicles`,
    },
    DESCRIPTIONS: {
      TAKEN_TO_SHOP: `This is to inform you that a vehicle has been assigned to you for upcoming tasks. Kindly proceed to the shop to collect the vehicle keys and necessary documentation. Your cooperation in ensuring timely and efficient completion of assigned tasks is appreciated.`,
      VEHICLE_COMPLETED: `We are pleased to inform you that the vehicle from your waiting list has been successfully serviced and is now ready for pickup. Kindly proceed to the service area to collect the vehicle, ensuring a smooth transition for delivery to the customer slot.\n\nThank you for your prompt attention to this matter.`,
      WAITING_LIST_COMPLETED: `Great news! All vehicles on your waiting list have been successfully serviced and are ready for pickup. Please coordinate with the service team to ensure the efficient retrieval and delivery of these vehicles to their designated slots.\n\nThank you for your dedication to providing excellent service.`,
    },
  },
};

module.exports = constants;
