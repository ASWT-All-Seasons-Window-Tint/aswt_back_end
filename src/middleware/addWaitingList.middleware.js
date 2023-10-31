module.exports = (waitingList) => {
  return function (req, res, next) {
    req.params.waitingList = waitingList;

    next();
  };
};
