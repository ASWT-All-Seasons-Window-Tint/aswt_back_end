const { Category } = require("../model/category.model");
const categoryService = require("../services/category.services");
const { errorMessage, successMessage } = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");

class CategoryController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new category
  async createCategory(req, res) {
    const { name, description } = req.body;

    let category = await categoryService.getCategoryByName(name);
    if (category) return res.status(400).send(errorAlreadyExists("category"));

    category = new Category({ name, description });
    category.name = category.name.toLowerCase();

    category = await categoryService.createCategory(category);

    res.send(successMessage(MESSAGES.CREATED, category));
  }

  //get category from the database, using their email
  async getCategoryById(req, res) {
    const category = await categoryService.getCategoryById(req.params.id);
    if (!category) return res.status(404).send(errorMessage("category"));

    res.send(successMessage(MESSAGES.FETCHED, category));
  }

  //get all categories in the category collection/table
  async fetchAllCategories(req, res) {
    const categories = await categoryService.getAllCategories();

    res.send(successMessage(MESSAGES.FETCHED, categories));
  }

  //Update/edit category data
  async updateCategory(req, res) {
    const category = await categoryService.getCategoryById(req.params.id);

    if (!category) return res.status(404).send(errorMessage("category"));

    let updatedCategory = req.body;

    updatedCategory = await categoryService.updateCategoryById(
      req.params.id,
      updatedCategory
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedCategory));
  }

  //Delete category account entirely from the database
  async deleteCategory(req, res) {
    const category = await categoryService.getCategoryById(req.params.id);

    if (!category) return res.status(404).send(errorMessage("category"));

    await categoryService.deleteCategory(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, category));
  }
}

module.exports = new CategoryController();
