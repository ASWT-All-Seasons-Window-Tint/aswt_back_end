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

    const invoiceNumber = await Entry.getNextInvoiceNumber();
    entry.invoice.name = invoiceNumber;

    entry = await entryService.createEntry(entry);
    entry.id = entry._id;

    res.send(successMessage(MESSAGES.CREATED, entry));
  }

  async addInvoice(req, res) {
    const {
      getServiceAndEntry,
      updateEntryById,
      getPriceForService,
      getTotalprice,
      checkDuplicateEntry,
      getVehiclesLeft,
    } = entryService;

    const { id: entryId } = req.params;
    const { carDetails } = req.body;
    const { category, serviceId, vin } = carDetails;

    let [isCarServiceAdded, { service, entry }] = await Promise.all([
      checkDuplicateEntry(entryId, vin, serviceId),
      getServiceAndEntry(carDetails, entryId),
    ]);

    entry = entry[0];

    if (!entry) return res.status(404).send(errorMessage("entry"));
    if (!service) return res.status(404).send(errorMessage("service"));
    if (isCarServiceAdded)
      return res
        .status(400)
        .send({ message: "Duplicate entry", succes: false });

    const price = getPriceForService(service, entry.customerId, category);

    carDetails.price = price;
    carDetails.category = category.toLowerCase();
    carDetails.staffId = req.user._id;

    entry.invoice.carDetails.push(carDetails);

    const vehiclesLeft = getVehiclesLeft(entry);

    entry.vehiclesLeft = vehiclesLeft;
    entry.invoice.totalPrice = getTotalprice(entry.invoice);

    const updatedEntry = await updateEntryById(entryId, entry);
    updatedEntry.id = updatedEntry._id;

    delete carDetails.price;

    res.send(successMessage(MESSAGES.UPDATED, carDetails));
  }

  //get entry from the database, using their email
  async getEntryById(req, res) {
    const [entry] = await entryService.getEntryById(req.params.id);
    if (!entry) return res.status(404).send(errorMessage("entry"));

    entry.id = entry._id;

    res.send(successMessage(MESSAGES.FETCHED, entry));
  }

  async getCarsDoneByStaffPerEntryId(req, res) {
    const { entryId, staffId } = req.params;
    const [entry] = await entryService.getCarsDoneByStaff(entryId, staffId);

    if (!entry) return res.status(404).send(errorMessage("entry"));

    entry.id = entry._id;

    res.send(successMessage(MESSAGES.FETCHED, entry));
  }

  async getCarsDoneByStaff(req, res) {
    const { staffId } = req.params;
    const entries = await entryService.getCarsDoneByStaff(null, staffId);

    if (!entries) return res.status(404).send(errorMessage("entry"));

    entries.map((entry) => (entry.id = entry._id));

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  //get all entries in the entry collection/table
  async fetchAllEntries(req, res) {
    const entries = await entryService.getAllEntries();
    entries.map((entry) => (entry.id = entry._id));

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

    updatedEntry.id = updatedEntry._id;

    res.send(successMessage(MESSAGES.UPDATED, updatedEntry));
  }

  async modifyPrice(req, res) {
    const { serviceId, price, vin } = req.body;

    const entry = await entryService.getEntryById(req.params.id);
    if (!entry) return res.status(404).send(errorMessage("entry"));

    const updatedEntry = entryService.modifyPrice(
      req.params.id,
      vin,
      serviceId,
      price
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
