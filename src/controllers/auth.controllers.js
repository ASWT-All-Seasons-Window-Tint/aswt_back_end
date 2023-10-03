const bcrypt = require("bcrypt");
const _ = require("lodash");
const userService = require("../services/user.services");
const { loginSuccess, loginError } = require("../common/messages.common");
const propertiesToPick = require("../common/propertiesToPick.common");
const newDate = require("../utils/newDate.utils");

class AuthController {
  //Create a new user
  async logIn(req, res) {
    const { email, password } = req.body;

    if (req.user.role !== "staff" && req.body.signInLocations)
      return res
        .status(400)
        .send({ message: "Only a staff can sign in", success: false });

    let user = req.user;
    //checks if the password is valid
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).send(loginError());

    // Check if the user is a staff member
    if (user.role === "staff") {
      const { description, coordinates } = req.body.signInLocations;
      // Create a new signed-in location entry
      const newSignInLocation = {
        timestamp: newDate(),
        description,
        coordinates,
      };

      await Promise.all([
        userService.addSignInLocation(email, newSignInLocation),
        userService.signInStaff(email, newSignInLocation),
      ]);
    }

    const token = user.generateAuthToken();
    user = _.pick(user, propertiesToPick);

    // sends token as response to the client after validation
    // Token is used to check if client is logged in or not, it's presence means logged in and vice-versa
    res.send(loginSuccess(token, user));
  }
}

module.exports = new AuthController();
