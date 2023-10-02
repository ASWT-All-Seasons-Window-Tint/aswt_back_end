module.exports = function (pageNumber, totalPages) {
  const error = {};
  if (pageNumber < 1) {
    error.message = "Page number must be greater than or equal to 1.";
    return error;
  }

  if (pageNumber > totalPages) {
    error.message = `Requested page number (${pageNumber}) exceeds total pages (${totalPages}).`;
    return error;
  }
  return error;
};
