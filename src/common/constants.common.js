const constants = {
  DATABASE_URI: process.env.DATABASE_URI,
  noSpecials: /^[a-zA-Z0-9_]+$/,
  DATABASES: {
    ROOM: "room",
    ROOM_TYPE: "room_type",
    USER: "user",
  },
  USER_TYPES: {
    USER: "user",
    ADMIN: "admin",
  },
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
    LOGIN_FAILURE: "Unable to login. Username or password incorrect",
  },

  errorMessage: (data) => {
    return {
      message: `We can't find ${data} with the given ID`,
      success: false,
    };
  },
  errorAlreadyExists(resource) {
    return {
      message: `The ${resource} has already been created`,
      success: false,
    };
  },
};

module.exports = constants;
