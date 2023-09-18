const _ = require("lodash");
const redis = require("redis");
require("dotenv").config();

const redisClient = redis.createClient({
  url: "rediss://red-ck2ruj6ru70s739ijd4g:AM7mhLWXWVkZE7efshuVn5AMj34uIetr@oregon-redis.render.com:6379",
});
(async () => {
  redisClient.on("error", (err) => console.log("Redis Client Error", err));

  await redisClient.connect();
})();
async function getOrSetCache(
  collection,
  expires,
  getDBDataFunction,
  query = []
) {
  const results = {};

  // Get tokens
  try {
    let data = await redisClient.get(collection);

    if (data === "null") data = null;

    if (data) {
      // Token found in cache
      results.data = JSON.parse(data);

      return results;
    } else {
      data = await getDBDataFunction(...query);

      const seen = [];

      redisClient.setEx(
        collection,
        expires,
        JSON.stringify(data, replacer, seen)
      );
      function replacer(key, value) {
        if (typeof value === "object" && value !== null) {
          if (seen.indexOf(value) !== -1) {
            return;
          }
          seen.push(value);
        }
        return value;
      }

      results.data = data;
      return results;
    }
  } catch (error) {
    console.log(error.message);
    // Log error
    results.error = error;
    return results;
  }
}

function updateCache(collection, expires, data) {
  redisClient.setEx(collection, expires, JSON.stringify(data));
}

exports.getOrSetCache = getOrSetCache;
exports.updateCache = updateCache;
