const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const { priceList } = require("../model/priceList.model");
const { validate, validatePatch } = priceList;
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const priceListController = require("../controllers/priceList.controllers");
const companyMiddleware = require("../middleware/company.middleware");
const validateObjectIdWithXArgMiddleware = require("../middleware/validateObjectIdWithXArg.middleware");

// This is used for registering a new priceList.
router.post(
  "/",
  auth,
  admin,
  validateMiddleware(validate),
  asyncMiddleware(priceListController.createPriceList)
);

router.get("/", asyncMiddleware(priceListController.fetchAllPriceLists));

router.get(
  "/:id",
  validateObjectId,
  asyncMiddleware(priceListController.getPriceListById)
);

router.get(
  "/service/:serviceId/film-quality/:filmQualityId",
  validateObjectIdWithXArgMiddleware(["serviceId", "filmQualityId"]),
  asyncMiddleware(priceListController.getPriceListByFilmQualityIdIdAndServiceId)
);

router.put(
  "/:id",
  validateObjectId,
  // auth is used to make authenticate a priceList.
  auth,
  validateMiddleware(validatePatch),
  asyncMiddleware(priceListController.updatePriceList)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(priceListController.deletePriceList)
);
module.exports = router;
