module.exports = function (endOfRange) {
  // Generate a random decimal between 0 (inclusive) and 1 (exclusive)
  const randomDecimal = Math.random();

  // Scale and round to get a random integer between 0 and 10
  const randomInteger = Math.floor(randomDecimal * endOfRange);

  return randomInteger;
};
