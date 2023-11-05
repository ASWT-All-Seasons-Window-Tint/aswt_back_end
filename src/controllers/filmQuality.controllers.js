const { FilmQuality } = require("../model/filmQuality.model").filmQuality;
const filmQualityService = require("../services/filmQuality.services");
const {
  errorMessage,
  successMessage,
  badReqResponse,
} = require("../common/messages.common");
const { filmQualityType } = require("../model/filmQuality.model").filmQuality;
const { MESSAGES } = require("../common/constants.common");

class FilmQualityController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new filmQuality
  async createFilmQuality(req, res) {
    const { name, description, type } = req.body;

    let filmQuality = new FilmQuality({
      name: name.toUpperCase(),
      description,
      type,
    });

    filmQuality = await filmQualityService.createFilmQuality(filmQuality);

    res.send(successMessage(MESSAGES.CREATED, filmQuality));
  }

  //get filmQuality from the database, using their email
  async getFilmQualityById(req, res) {
    const filmQuality = await filmQualityService.getFilmQualityById(
      req.params.id
    );
    if (!filmQuality) return res.status(404).send(errorMessage("filmQuality"));

    res.send(successMessage(MESSAGES.FETCHED, filmQuality));
  }

  async getFilmQualitiesByType(req, res) {
    const { filmType } = req.params;

    if (!filmQualityType.includes(filmType))
      return badReqResponse(res, "Invalid film type");

    const filmQualities = await filmQualityService.getAllFilmQualitiesByType(
      filmType
    );

    res.send(successMessage(MESSAGES.FETCHED, filmQualities));
  }

  async getFilmQualityByEntryIdAndStaffId(req, res) {
    const { entryId, staffId } = req.body;

    const filmQuality =
      await filmQualityService.getFilmQualityByEntryIdAndStaffId(
        entryId,
        staffId
      );
    if (!filmQuality) return res.status(404).send(errorMessage("filmQuality"));

    res.send(successMessage(MESSAGES.FETCHED, filmQuality));
  }

  //get all entries in the filmQuality collection/table
  async fetchAllFilmQualities(req, res) {
    const filmQualities = await filmQualityService.getAllFilmQualities();

    res.send(successMessage(MESSAGES.FETCHED, filmQualities));
  }

  //Update/edit filmQuality data
  async updateFilmQuality(req, res) {
    const filmQuality = await filmQualityService.getFilmQualityById(
      req.params.id
    );
    if (!filmQuality) return res.status(404).send(errorMessage("filmQuality"));

    let updatedFilmQuality = req.body;
    updatedFilmQuality = await filmQualityService.updateFilmQualityById(
      req.params.id,
      updatedFilmQuality
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedFilmQuality));
  }

  //Delete filmQuality account entirely from the database
  async deleteFilmQuality(req, res) {
    const filmQuality = await filmQualityService.getFilmQualityById(
      req.params.id
    );
    if (!filmQuality) return res.status(404).send(errorMessage("filmQuality"));

    await filmQualityService.deleteFilmQuality(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, filmQuality));
  }
}

module.exports = new FilmQualityController();
