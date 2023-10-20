const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const adminOrManager = require("../middleware/adminOrManager.middleware");
const auth = require("../middleware/auth.middleware");
const manager = require("../middleware/manager.middleware");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const qboAsyncMiddleware = require("../middleware/qboAsync.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const serviceController = require("../controllers/service.controllers");
const invoiceController = require("../controllers/invoice.controllers");
const {
  validatePatch,
  validateAddDealershipPrice,
  validateWithObj,
  validateUpdateDealershipPrice,
} = require("../model/service.model");
const validateObjectIdWithXArg = require("../middleware/validateObjectIdWithXArg.middleware");

router.post(
  "/",
  [auth, validateMiddleware(validateWithObj), adminOrManager],
  asyncMiddleware(serviceController.createService)
);

router.get(
  "/qb/name/:itemName",
  [auth, adminOrManager],
  qboAsyncMiddleware(serviceController.getQbServices)
);
router.get(
  "/qb/:pageNumber",
  [auth, adminOrManager],
  qboAsyncMiddleware(serviceController.getQbServices)
);

router.get("/", asyncMiddleware(serviceController.fetchAllServices));
router.post("/invoice/:id", asyncMiddleware(invoiceController.sendInvoice));
router.get("/web", asyncMiddleware(serviceController.fetchAllServicesWeb));
router.get("/multiple", asyncMiddleware(serviceController.getMultipleServices));

router.get(
  "/:id",
  validateObjectId,
  asyncMiddleware(serviceController.getServiceById)
);
router.get(
  "/web/:id",
  validateObjectId,
  asyncMiddleware(serviceController.getServiceByIdWeb)
);

router.put(
  "/:id",
  [validateObjectId, auth, admin || manager, validateMiddleware(validatePatch)],
  asyncMiddleware(serviceController.updateService)
);

router.put(
  "/add-dealership-price/:id",
  [
    validateObjectId,
    auth,
    adminOrManager,
    validateMiddleware(validateAddDealershipPrice),
  ],
  qboAsyncMiddleware(serviceController.addDealershipPrice)
);
router.put(
  "/update-dealership-price/service/:serviceId/customer/:customerId",
  [
    auth,
    admin,
    validateObjectIdWithXArg(["serviceId"]),
    validateMiddleware(validateUpdateDealershipPrice),
  ],
  qboAsyncMiddleware(serviceController.updateDealershipPrice)
);

router.put(
  "/delete-dealership-price/service/:serviceId/customer/:customerId",
  [auth, admin, validateObjectIdWithXArg(["serviceId"])],
  qboAsyncMiddleware(serviceController.deleteCustomerDealerShip)
);

router.delete(
  "/:id",
  [validateObjectId, auth, admin],
  asyncMiddleware(serviceController.deleteService)
);
module.exports = router;
