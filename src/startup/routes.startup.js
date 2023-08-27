// This file determines which of the routes will be used based on the api url
const express = require("express");
const cors = require("cors");
const error = require("../middleware/error.middleware");
const auth = require("../routes/auth.routes");
const users = require("../routes/user.routes");
const departments = require("../routes/department.routes");
const categories = require("../routes/category.routes");
const entries = require("../routes/entry.routes");
const services = require("../routes/service.routes");

module.exports = function (app) {
  app.use(cors());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.use("/api/v1/auth", auth);
  app.use("/api/v1/departments", departments);
  app.use("/api/v1/entries", entries);
  app.use("/api/v1/categories", categories);
  app.use("/api/v1/users", users);
  app.use("/api/v1/services", services);

  // it calls the error middleware if there was a rejected promise.
  app.use(error);
};
