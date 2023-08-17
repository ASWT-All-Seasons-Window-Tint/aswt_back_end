const bcrypt = require("bcrypt");
const _ = require("lodash");
const userService = require("../services/user.services");
const {
  loginSuccess,
  loginError,
  errorMessage,
} = require("../common/messages.common");

class AuthController {
  //Create a new user
  async logIn(req, res) {
    const { email, password } = req.body;

    const user = req.user;
    //checks if the password is valid
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).send(loginError());

    // Check if the user is a staff member
    if (user.role === "staff") {
      const { description, coordinates } = req.body.signInLocations;
      // Create a new signed-in location entry
      const newSignInLocation = {
        timestamp: new Date(),
        description,
        coordinates,
      };

      await userService.addSignInLocation(email, newSignInLocation);
    }

    const token = user.generateAuthToken();

    // sends token as response to the client after validation
    // Token is used to check if client is logged in or not, it's presence means logged in and vice-versa
    res.send(loginSuccess(token));
  }
}

module.exports = new AuthController();
