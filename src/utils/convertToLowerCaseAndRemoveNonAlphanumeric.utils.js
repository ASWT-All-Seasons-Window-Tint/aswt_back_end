module.exports = function (inputString) {
  // Use a regular expression to remove non-alphanumeric characters
  var alphanumericString = inputString.replace(/[^a-z0-9]/gi, "");

  // Convert the resulting string to lowercase
  var lowercaseString = alphanumericString.toLowerCase();

  return lowercaseString;
};
