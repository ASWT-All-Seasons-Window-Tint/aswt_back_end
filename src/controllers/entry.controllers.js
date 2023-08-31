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
    const { category, serviceIds, vin } = carDetails;

    let [isCarServiceAdded, { services, entry }, missingIds] =
      await Promise.all([
        checkDuplicateEntry(entryId, vin),
        getServiceAndEntry(carDetails, entryId),
        serviceService.validateServiceIds(serviceIds),
      ]);

    if (missingIds.length > 0)
      return res.status(404).send({
        message: `Services with IDs: ${missingIds} could not be found`,
        status: false,
      });

    entry = entry[0];

    if (!entry) return res.status(404).send(errorMessage("entry"));
    if (!services) return res.status(404).send(errorMessage("services"));
    if (isCarServiceAdded)
      return res
        .status(400)
        .send({ message: "Duplicate entry", succes: false });

    const { price, priceBreakdown } = getPriceForService(
      services,
      entry.customerId,
      category
    );

    carDetails.entryDate = new Date();
    carDetails.price = price;
    carDetails.category = category.toLowerCase();
    carDetails.staffId = req.user._id;
    carDetails.priceBreakdown = priceBreakdown;

    entry.invoice.carDetails.push(carDetails);

    const vehiclesLeft = getVehiclesLeft(entry);

    entry.vehiclesLeft = vehiclesLeft;
    entry.invoice.totalPrice = getTotalprice(entry.invoice);

    const updatedEntry = await updateEntryById(entryId, entry);
    updatedEntry.id = updatedEntry._id;

    delete carDetails.priceBreakdown;
    delete carDetails.price;

    res.send(successMessage(MESSAGES.UPDATED, carDetails));
  }

  //get entry from the database, using their email
  async getEntryById(req, res) {
    const { getEntryById } = entryService;

    const [entry] = await getEntryById(req.params.id);
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
    const { getAllEntries } = entryService;

    const entries = await getAllEntries();
    entries.map((entry) => (entry.id = entry._id));

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  async getAllEntriesWithoutInvoice(req, res) {
    const entries = await entryService.getAllEntriesWithoutInvoice();
    entries.map((entry) => (entry.id = entry._id));

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }
  async getAllEntryByIdWithoutInvoice(req, res) {
    const entry = await entryService.getAllEntriesWithoutInvoice(req.params.id);
    if (!entry) return res.status(404).send(errorMessage("entry"));

    entry.id = entry._id;

    res.send(successMessage(MESSAGES.FETCHED, entry));
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

  //Update/edit entry data
  async modifyCarDetails(req, res) {
    const { getMultipleServices, validateServiceIds } = serviceService;
    const { vin, id } = req.params;

    const [entry] = await entryService.getEntryById(id);
    if (!entry) return res.status(404).send(errorMessage("entry"));

    const { carIndex, carDoneByStaff } = entryService.getCarDoneByStaff(
      entry,
      req,
      vin
    );

    if (!carDoneByStaff)
      return res
        .status(401)
        .send({ message: MESSAGES.UNAUTHORIZE("update"), succes: false });

    if (!entryService.carWasAddedRecently(carDoneByStaff)) {
      return res.status(400).send({
        message: "Cannot modify car details more than 24 hours after adding",
        succes: false,
      });
    }

    entryService.updateCarProperties(req, carDoneByStaff);

    const services = await getMultipleServices(carDoneByStaff.serviceIds);

    entryService.recalculatePrices(req, entry, services, carDoneByStaff);

    entry.invoice.carDetails[carIndex] = carDoneByStaff;

    const updatedEntry = await entryService.updateEntryById(id, entry);

    res.send(successMessage(MESSAGES.UPDATED, updatedEntry));
  }

  async modifyPrice(req, res) {
    const { serviceIds, price, vin } = req.body;

    const entry = await entryService.getEntryById(req.params.id);
    if (!entry) return res.status(404).send(errorMessage("entry"));

    const updatedEntry = entryService.modifyPrice(
      req.params.id,
      vin,
      serviceIds,
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
