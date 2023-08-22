const mongoose = require("mongoose");
const { Entry } = require("../model/entry.model");
const serviceServices = require("./service.services");

class EntryService {
  //Create new entry
  async createEntry(entry) {
    return await entry.save();
  }

  async getEntryById(entryId) {
    return await Entry.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(entryId),
        },
      },

      {
        $project: {
          customerId: 1,
          numberOfVehicles: 1,
          vehiclesLeft: 1,
          entryDate: 1,

          // Keep existing invoice projection
          invoice: {
            name: "$invoice.name",
            carDetails: "$invoice.carDetails",
            totalPrice: {
              $sum: "$invoice.carDetails.price",
            },
          },
        },
      },
    ]);
  }

  async validateEntryIds(entryIds) {
    const entrys = await Entry.find({
      _id: { $in: entryIds },
    });

    const foundIds = entrys.map((d) => d._id.toString());

    const missingIds = entryIds.filter((id) => !foundIds.includes(id));

    return missingIds;
  }

  async getEntryByName(name) {
    const caseInsensitiveName = new RegExp(name, "i");

    return await Entry.findOne({ name: caseInsensitiveName });
  }

  async getAllEntries() {
    return await Entry.aggregate([
      {
        $project: {
          customerId: 1,
          numberOfVehicles: 1,
          vehiclesLeft: 1,
          entryDate: 1,

          // Keep existing invoice projection
          invoice: {
            name: "$invoice.name",
            carDetails: "$invoice.carDetails",
            totalPrice: {
              $sum: "$invoice.carDetails.price",
            },
          },
        },
      },
    ]);
  }

  async checkDuplicateEntry(entryId, vin, serviceId) {
    return await Entry.findOne({
      $and: [
        { _id: entryId },
        { "invoice.carDetails.serviceId": serviceId },
        { "invoice.carDetails.vin": vin },
      ],
    });
  }

  getServiceAndEntry = async (carDetails, entryId) => {
    const results = {};

    results.service = await serviceServices.getServiceById(
      carDetails.serviceId
    );

    results.entry = await this.getEntryById(entryId);

    return results;
  };

  getTotalprice(invoice) {
    invoice.totalPrice = 0;

    invoice.carDetails.forEach((detail) => {
      invoice.totalPrice += detail.price;
    });

    return invoice.totalPrice;
  }

  getPriceForService(service, customerId, category) {
    const [customerDealershipPrice] = service.dealershipPrices.filter(
      (dealershipPrice) =>
        dealershipPrice.custumerId.toString() == customerId.toString()
    );

    const categoryInLowercase = category.toLowerCase();

    const price = customerDealershipPrice
      ? customerDealershipPrice.price
      : service.defaultPrice[categoryInLowercase];

    return price;
  }

  async updateEntryById(id, entry) {
    return await Entry.findByIdAndUpdate(
      id,
      {
        $set: entry,
      },
      { new: true }
    );
  }

  async deleteEntry(id) {
    return await Entry.findByIdAndRemove(id);
  }
}

module.exports = new EntryService();
