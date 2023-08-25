const validateMiddleware = require("../middleware/validate.middleware");
const admin = require("../middleware/admin.middleware");
const auth = require("../middleware/auth.middleware");
const { validate, validatePatch } = require("../model/category.model");
const express = require("express");
const router = express.Router();
const asyncMiddleware = require("../middleware/async.middleware");
const validateObjectId = require("../middleware/validateObjectId.middleware");
const categoryController = require("../controllers/category.controllers");

router.post(
  "/",
  auth,
  admin,
  validateMiddleware(validate),
  asyncMiddleware(categoryController.createCategory)
);

router.get("/", asyncMiddleware(categoryController.fetchAllCategories));

router.get(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(categoryController.getCategoryById)
);

router.put(
  "/:id",
  validateObjectId,
  // auth is used to make authenticate a category.
  auth,
  admin,
  validateMiddleware(validatePatch),
  asyncMiddleware(categoryController.updateCategory)
);

router.delete(
  "/:id",
  validateObjectId,
  auth,
  admin,
  asyncMiddleware(categoryController.deleteCategory)
);
module.exports = router;
