const { json } = require("express");
const redis = require("redis");

const redisClient = redis.createClient();
(async () => {
  redisClient.on("error", (err) => console.log("Redis Client Error", err));

  await redisClient.connect();
})();
async function getOrSetCache(collection, expires, getDBDataFunction, query) {
  const results = {};

  // Get tokens
  try {
    let data = await redisClient.get(collection);

    if (data === "null") data = null;

    if (data) {
      //console.log(data);
      // Token found in cache
      results.data = JSON.parse(data);

      return results;
    } else {
      data = await getDBDataFunction(query);

      redisClient.setEx(collection, expires, JSON.stringify(data));

      results.data = data;
      return results;
    }
  } catch (error) {
    console.log(error);
    // Log error
    results.error = error;
  }
}

function updateCache(collection, expires, data) {
  redisClient.setEx(collection, expires, JSON.stringify(data));
}

exports.getOrSetCache = getOrSetCache;
exports.updateCache = updateCache;
