const redis = require("redis");
const { env } = process;

const redisClient = redis.createClient();
(async () => {
  redisClient.on("error", (err) => console.log("Redis Client Error", err));

  await redisClient.connect({
    url: env.redisUrl,
  });
})();
async function getOrSetCache(collection, expires, getDBDataFunction, query) {
  const results = {};

  // Get tokens
  try {
    let data = await redisClient.get(collection);

    if (data) {
      // Token found in cache
      results.data = JSON.parse(data);

      return results;
    } else {
      data = await getDBDataFunction(query);

      redisClient.setEx(collection, expires, JSON.stringify(data));

      results.data = data;

      return data;
    }
  } catch (error) {
    console.log(error);
    // Log error
    results.error = error;
  }
}

exports.getOrSetCache = getOrSetCache;
