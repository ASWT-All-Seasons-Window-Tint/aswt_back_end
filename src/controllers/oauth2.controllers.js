"use strict";

require("dotenv").config();
var http = require("http");
var port = process.env.PORT || 3000;
var request = require("request");
var qs = require("querystring");
var util = require("util");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var session = require("express-session");
var express = require("express");
var app = express();
var QuickBooks = require("node-quickbooks");
var Tokens = require("csrf");
const tokenServices = require("../services/token.services");
var csrf = new Tokens();

QuickBooks.setOauthVersion("2.0");

app.use(cookieParser("brad"));

const { env } = process;
// INSERT YOUR CONSUMER_KEY AND CONSUMER_SECRET HERE

var consumerKey = env.clientId;
var consumerSecret = env.clientSecret;

// app.get("/", function (req, res) {
//   res.redirect("/start");
// });
class Ouath2Controller {
  start(req, res) {
    res.render("intuit.ejs", {
      port: `${env.apiUrl}/api/v1/oauth2/requestToken`,
      appCenter: QuickBooks.APP_CENTER_BASE,
    });
  }

  // OAUTH 2 makes use of redirect requests
  generateAntiForgery(session) {
    console.log(session);
    session.secret = csrf.secretSync();
    return csrf.create(session.secret);
  }

  requestToken = (req, res) => {
    var redirecturl =
      QuickBooks.AUTHORIZATION_URL +
      "?client_id=" +
      consumerKey +
      "&redirect_uri=" +
      encodeURIComponent(`${env.apiUrl}/api/v1/oauth2/callback/`) + //Make sure this path matches entry in application dashboard
      "&scope=com.intuit.quickbooks.accounting" +
      "&response_type=code" +
      "&state=" +
      this.generateAntiForgery(req.session);

    res.redirect(redirecturl);
  };

  callback(req, res) {
    var auth = Buffer.from(consumerKey + ":" + consumerSecret).toString(
      "base64"
    );

    var postBody = {
      url: env.tokenEndpoint,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + auth,
      },
      form: {
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: `${env.apiUrl}/api/v1/oauth2/callback/`, //Make sure this path matches entry in application dashboard
      },
    };

    request.post(postBody, async function (e, r, data) {
      const responseData = JSON.parse(r.body);

      await tokenServices.updateAccessAndRefreshToken(responseData);

      console.log("refreshToken", responseData.refresh_token);
      console.log("accessToken:", responseData.access_token);
    });

    res.send(
      '<!DOCTYPE html><html lang="en"><head></head><body><script>window.opener.location.reload(); window.close();</script></body></html>'
    );
  }
}

module.exports = new Ouath2Controller();
