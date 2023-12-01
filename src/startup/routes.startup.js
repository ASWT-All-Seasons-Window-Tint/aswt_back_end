// This file determines which of the routes will be used based on the api url
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const error = require("../middleware/error.middleware");
const auth = require("../routes/auth.routes");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const appointments = require("../routes/appointment.routes");
const articles = require("../routes/article.routes");
const departments = require("../routes/department.routes");
const invoices = require("../routes/invoice.routes");
const incentives = require("../routes/incentive.routes");
const notifications = require("../routes/notification.routes");
const categories = require("../routes/category.routes");
const customers = require("../routes/customer.routes");
const entries = require("../routes/entry.routes");
const logout = require("../routes/logout.routes");
const priceLists = require("../routes/priceList.routes");
const filmQualities = require("../routes/filmQuality.routes");
const forms = require("../routes/form.routes");
const oauth2 = require("../routes/oauth2.routes");
const webhook = require("../routes/webhook.routes");
const services = require("../routes/service.routes");
const tickets = require("../routes/ticket.routes");
const stripe = require("../routes/stripe.routes");
const distanceThreshold = require("../routes/distanceThreshold.routes");
const session = require("./session.startup");
const users = require("../routes/user.routes");

const { localEndpoint } = process.env;

module.exports = function (app) {
  app.use(cors());
  app.use(express.static(path.join(__dirname, "")));
  app.use(express.urlencoded({ extended: true }));
  app.set("views", path.join(__dirname, "../views"));
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/v1/webhook/stripe") {
      next();
    } else {
      express.json()(req, res, next);
    }
  });
  // app.use((req, res, next) => {
  //   if (req.originalUrl === "/api/v1/webhook/stripe") {
  //     next();
  //   } else {
  //     express.json()(req, res, next);
  //   }
  // });
  app.use(cookieParser("brad"));
  // app.use(bodyParser.json());
  // app.use(bodyParser.urlencoded({ extended: true }));
  app.use(session());

  app.use(`${localEndpoint}/articles`, articles);
  app.use(`${localEndpoint}/appointments`, appointments);
  app.use(`${localEndpoint}/auth`, auth);
  app.use(`${localEndpoint}/notifications`, notifications);
  app.use(`${localEndpoint}/incentives`, incentives);
  app.use(`${localEndpoint}/invoices`, invoices);
  app.use(`${localEndpoint}/departments`, departments);
  app.use(`${localEndpoint}/entries`, entries);
  app.use(`${localEndpoint}/categories`, categories);
  app.use(`${localEndpoint}/customers`, customers);
  app.use(`${localEndpoint}/price-lists`, priceLists);
  app.use(`${localEndpoint}/film-qualities`, filmQualities);
  app.use(`${localEndpoint}/users`, users);
  app.use(`${localEndpoint}/forms`, forms);
  app.use(`${localEndpoint}/logout`, logout);
  app.use(`${localEndpoint}/oauth2`, oauth2);
  app.use(`${localEndpoint}/webhook`, webhook);
  app.use(`${localEndpoint}/stripe`, stripe);
  app.use(`${localEndpoint}/distanceThreshold`, distanceThreshold);
  app.use(`${localEndpoint}/tickets`, tickets);
  app.use(`${localEndpoint}/services`, services);

  // it calls the error middleware if there was a rejected promise.
  app.use(error);
};
