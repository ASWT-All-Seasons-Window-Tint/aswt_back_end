const { Entry } = require("../model/entry.model");
const entryService = require("../services/entry.services");
const userService = require("../services/user.services");
const serviceService = require("../services/service.services");
const { errorMessage, successMessage } = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");

class EntryController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new entry
  async createEntry(req, res) {
    const { customerId, numberOfVehicles } = req.body;

    const [customer] = await userService.getUserByRoleAndId(
      customerId,
      "customer"
    );

    if (!customer) return res.status(404).send(errorMessage("customer"));

    let entry = new Entry({
      customerId,
      numberOfVehicles,
      entryDate: new Date(),
      vehiclesLeft: numberOfVehicles,
    });

    entry = await entryService.createEntry(entry);

    res.send(successMessage(MESSAGES.CREATED, entry));
  }

  async addInvoice(req, res) {
    const { getServiceAndEntry, updateEntryById, getPriceForService } =
      entryService;

    const { id: entryId } = req.params;
    const { name, carDetails } = req.body.invoice;

    const { service, entry } = await getServiceAndEntry(carDetails, entryId);

    if (!entry[0]) return res.status(404).send(errorMessage("entry"));
    if (!service) return res.status(404).send(errorMessage("service"));

    const price = getPriceForService(
      service,
      entry[0].customerId,
      carDetails.category
    );

    carDetails.price = price;
    carDetails.category = categoryInLowercase;

    entry.invoice.name = name;
    entry.invoice.carDetails.push(carDetails);

    const updatedEntry = await updateEntryById(entryId, entry);

    res.send(successMessage(MESSAGES.UPDATED, updatedEntry));
  }

  //get entry from the database, using their email
  async getEntryById(req, res) {
    const [entry] = await entryService.getEntryById(req.params.id);
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
