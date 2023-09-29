const { transactionOptions } = require("../common/constants.common");

module.exports = async function (mongoSession, callback) {
  const results = {};
  try {
    results.data = await mongoSession.withTransaction(
      callback,
      transactionOptions
    );
  } catch (err) {
    console.log(err);

    results.error = err;

    return results;
  } finally {
    await mongoSession.endSession();
  }
};
