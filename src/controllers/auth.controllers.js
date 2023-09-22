const bcrypt = require("bcrypt");
const _ = require("lodash");
const userService = require("../services/user.services");
const { loginSuccess, loginError } = require("../common/messages.common");
const propertiesToPick = require("../common/propertiesToPick.common");

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
        timestamp: new Date(),
        description,
        coordinates,
      };

      console.log(req.session);
      // Create a session for the authenticated user
      if (!req.session.users) req.session.users = [];

      const userSession = _.pick(user, propertiesToPick);
      userSession.currentSignInLocation = newSignInLocation;

      const userIndex = req.session.users.findIndex(
        (sessionUser) => sessionUser._id.toString() == user._id.toString()
      );

      const userIsLoggedIn = req.session.users[userIndex];

      if (userIsLoggedIn) req.session.users[userIndex] = userSession;
      else req.session.users.push(userSession);

      await userService.addSignInLocation(email, newSignInLocation);
    }

    const token = user.generateAuthToken();
    user = _.pick(user, propertiesToPick);

    // sends token as response to the client after validation
    // Token is used to check if client is logged in or not, it's presence means logged in and vice-versa
    res.send(loginSuccess(token, user));
  }
}

module.exports = new AuthController();
