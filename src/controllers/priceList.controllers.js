const { PriceList } = require("../model/priceList.model").priceList;
const priceListService = require("../services/priceList.services");
const filmQualityService = require("../services/filmQuality.services");
const serviceService = require("../services/service.services");
const entryService = require("../services/entry.services");
const {
  errorMessage,
  successMessage,
  badReqResponse,
} = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");

class PriceListController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new priceList
  async createPriceList(req, res) {
    const { filmQualityId, serviceId, price } = req.body;

    const [filmQuality, service, priceListExist] = await Promise.all([
      filmQualityService.getFilmQualityById(filmQualityId),
      serviceService.getServiceById(serviceId),
      priceListService.getPriceListByFilmQualityIdIdAndServiceId(
        serviceId,
        filmQualityId
      ),
    ]);

    if (!filmQuality) return res.status(404).send(errorMessage("filmQuality"));
    if (!service) return res.status(404).send(errorMessage("service"));
    if (priceListExist)
      return badReqResponse(
        res,
        "Price list has already been added for film quality and service type"
      );

    let priceList = new PriceList({
      filmQualityId,
      serviceId,
      price,
    });

    priceList = await priceListService.createPriceList(priceList);

    res.send(successMessage(MESSAGES.CREATED, priceList));
  }

  //get priceList from the database, using their email
  async getPriceListById(req, res) {
    const priceList = await priceListService.getPriceListById(req.params.id);
    if (!priceList) return res.status(404).send(errorMessage("priceList"));

    res.send(successMessage(MESSAGES.FETCHED, priceList));
  }

  async getPriceListByFilmQualityIdIdAndServiceId(req, res) {
    const { filmQualityId, serviceId } = req.params;

    const priceList =
      await priceListService.getPriceListByFilmQualityIdIdAndServiceId(
        serviceId,
        filmQualityId
      );
    if (!priceList) return res.status(404).send(errorMessage("priceList"));

    res.send(successMessage(MESSAGES.FETCHED, priceList));
  }

  //get all priceLists in the priceList collection/table
  async fetchAllPriceLists(req, res) {
    const priceLists = await priceListService.getAllPriceLists();

    res.send(successMessage(MESSAGES.FETCHED, priceLists));
  }

  //Update/edit priceList data
  async updatePriceList(req, res) {
    const priceList = await priceListService.getPriceListById(req.params.id);
    if (!priceList) return res.status(404).send(errorMessage("priceList"));

    let updatedPriceList = req.body;
    updatedPriceList = await priceListService.updatePriceListById(
      req.params.id,
      updatedPriceList
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedPriceList));
  }

  //Delete priceList account entirely from the database
  async deletePriceList(req, res) {
    const priceList = await priceListService.getPriceListById(req.params.id);
    if (!priceList) return res.status(404).send(errorMessage("priceList"));

    await priceListService.deletePriceList(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, priceList));
  }
}

module.exports = new PriceListController();
