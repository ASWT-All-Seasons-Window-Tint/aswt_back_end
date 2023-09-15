module.exports = function (valueInSeconds) {
  // Original date
  const originalDate = new Date();
  originalDate.setSeconds(originalDate.getSeconds() + valueInSeconds);

  // Format the result as a string (optional)
  const updatedDate = originalDate;

  return updatedDate;
};
