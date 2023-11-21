// this is the next middleware function that is called when a promise is rejected.
module.exports = function (err, req, res, next) {
  // this sends a response of 500 to the client and displays "Something failed" as a response
  if (err.statusCode === 400 && err.type === "entity.parse.failed") {
    console.log(err);
    return res
      .status(400)
      .send({ success: false, message: "Invalid JSON Syntax" });
  }

  console.log(err);
  res.status(500).send({ success: false, message: "Something Failed" });

  next();
};
