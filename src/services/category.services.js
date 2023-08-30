const { Category } = require("../model/category.model");

class CategoryService {
  //Create new category
  async createCategory(category) {
    return await category.save();
  }

  async getCategoryById(categoryId) {
    return await Category.findById(categoryId);
  }

  async getCategoryByName(name) {
    const caseInsensitiveName = new RegExp(name, "i");

    return await Category.findOne({ name: caseInsensitiveName });
  }

  async validateCategoryNames(categoryNames) {
    const categories = await Category.find({
      name: { $in: categoryNames },
    });

    const foundNames = categories.map((d) => d.name.toString());

    const missingNames = categoryNames.filter(
      (name) => !foundNames.includes(name)
    );

    return missingNames;
  }

  async missingCategoryNames(categoryNames) {
    const [serviceCategories, categories] = await Promise.all([
      Category.find({
        name: { $in: categoryNames },
      }),
      Category.find(),
    ]);
    const missingInServiceCategories = categories.filter(
      (category) => !serviceCategories.some((price) => price.id === category.id)
    );

    const categoriesMissing = missingInServiceCategories.map(
      (category) => category.name
    );

    return categoriesMissing;
  }

  async getAllCategories() {
    return await Category.find().sort({ _id: -1 });
  }

  async updateCategoryById(id, category) {
    return await Category.findByIdAndUpdate(
      id,
      {
        $set: category,
      },
      { new: true }
    );
  }

  async deleteCategory(id) {
    return await Category.findByIdAndRemove(id);
  }
}

module.exports = new CategoryService();
