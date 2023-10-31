// This middleware checks if the user is an admin, the highest level of authorization.
// The isAdmin property is only given at the database level for authencity
module.exports = function (req, res, next) {
  console.log(req.user.role);
  if (!req.user.isAdmin && req.user.role != "manager")
    return res.status(403).send({ success: false, message: "Access denied" });

  next();
};
