const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBSession = require("connect-mongodb-session");
require("dotenv").config();

const MongoDBStore = MongoDBSession(session);

module.exports = function () {
  const sessionStore = new MongoDBStore({
    uri: process.env.dbUri, // Use the same connection URI
    collection: "sessions", // Name of the collection to store sessions
    mongooseConnection: mongoose.connection, // Reuse the existing connection
  });

  const maxAgeInDays = 1000 * 60 * 60 * 24;

  return session({
    secret: process.env.sessionPassword,
    resave: false,
    saveUninitialized: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set 'secure' to true for HTTPS
    store: sessionStore,
  });
};
