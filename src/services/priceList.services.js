const { PriceList } = require("../model/priceList.model").priceList;

class PriceListService {
  //Create new priceList
  async createPriceList(priceList) {
    return await priceList.save();
  }

  async getPriceListById(priceListId) {
    return await PriceList.findById(priceListId);
  }

  async validatePriceListIds(priceListIds) {
    const priceLists = await PriceList.find({
      _id: { $in: priceListIds },
    });

    const foundIds = priceLists.map((d) => d._id.toString());

    const missingIds = priceListIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  async getPriceListByFilmQualityIdIdAndServiceId(
    serviceId,
    filmQualityId,
    categoryId
  ) {
    if (!filmQualityId && categoryId) {
      return await PriceList.findOne({
        serviceId,
        categoryId,
      }).populate(["serviceId", "categoryId"]);
    }
    if (categoryId) {
      return await PriceList.findOne({
        serviceId,
        filmQualityId,
        categoryId,
      }).populate(["serviceId", "filmQualityId", "categoryId"]);
    }

    return await PriceList.findOne({ serviceId, filmQualityId }).populate([
      "serviceId",
      "filmQualityId",
    ]);
  }
  async getPriceListByServiceId(serviceId) {
    return await PriceList.findOne({ serviceId }).populate(["serviceId"]);
  }

  getAllPriceLists() {
    return PriceList.find()
      .sort({ _id: -1 })
      .populate(["serviceId", "filmQualityId", "categoryId"]);
  }

  async updatePriceListById(id, priceList) {
    return await PriceList.findByIdAndUpdate(
      id,
      {
        $set: priceList,
      },
      { new: true }
    );
  }

  async deletePriceList(id) {
    return await PriceList.findByIdAndRemove(id);
  }
}

module.exports = new PriceListService();
