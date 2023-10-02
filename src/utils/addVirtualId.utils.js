module.exports = function (schema) {
  return schema.virtual("id").get(function () {
    return this._id; // Convert ObjectId to hex string
  });
};
