const service = require("../services/service.services");

module.exports = async function validateServiceIds(req, res, next) {
  const missingIds = req.body.serviceIds
    ? await service.validateServiceIds(req.body.serviceIds)
    : [];
  if (missingIds.length > 0)
    return res.status(404).send({
      message: `Services with IDs: [${missingIds}] could not be found`,
      status: false,
    });

  next();
};
