const { Entry } = require("../model/entry.model");
const entryService = require("../services/entry.services");
const { errorMessage, successMessage } = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");

class EntryController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new entry
  async createEntry(req, res) {
    const { customerId, numberOfVehicles } = req.body;

    let entry = new Entry({
      customerId,
      numberOfVehicles,
      entryDate: new Date(),
      vehiclesLeft: numberOfVehicles,
    });

    entry = await entryService.createEntry(entry);

    res.send(successMessage(MESSAGES.CREATED, entry));
  }

  //get entry from the database, using their email
  async getEntryById(req, res) {
    const entry = await entryService.getEntryById(req.params.id);
    if (!entry) return res.status(404).send(errorMessage("entry"));

    res.send(successMessage(MESSAGES.FETCHED, entry));
  }

  //get all entries in the entry collection/table
  async fetchAllEntries(req, res) {
    const entries = await entryService.getAllEntries();

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  //Update/edit entry data
  async updateEntry(req, res) {
    const entry = await entryService.getEntryById(req.params.id);

    if (!entry) return res.status(404).send(errorMessage("entry"));

    let updatedEntry = req.body;

    updatedEntry = await entryService.updateEntryById(
      req.params.id,
      updatedEntry
    );

    res.send(successMessage(MESSAGES.UPDATED, updatedEntry));
  }

  //Delete entry account entirely from the database
  async deleteEntry(req, res) {
    const entry = await entryService.getEntryById(req.params.id);

    if (!entry) return res.status(404).send(errorMessage("entry"));

    await entryService.deleteEntry(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, entry));
  }
}

module.exports = new EntryController();
