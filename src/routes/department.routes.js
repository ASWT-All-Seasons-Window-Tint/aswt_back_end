const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const { validate, validatePatch } = require("../model/department.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const departmentController = require("../controllers/department.controllers");

router.post(
  "/",
  auth,
  admin,
  validateMiddleware(validate),
  asyncMiddleware(departmentController.createDepartment)
);

router.get(
  "/",
  auth,
  asyncMiddleware(departmentController.fetchAllDepartments)
);

router.get(
  "/:id",
  validateObjectId,
  auth,
  asyncMiddleware(departmentController.getDepartmentById)
);

router.put(
  "/:id",
  validateObjectId,
  // auth is used to make authenticate a department.
  auth,
  admin,
  validateMiddleware(validatePatch),
  asyncMiddleware(departmentController.updateDepartment)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(departmentController.deleteDepartment)
);
module.exports = router;
