const { Entry } = require("../model/entry.model");
const entryService = require("../services/entry.services");
const userService = require("../services/user.services");
const serviceService = require("../services/service.services");
const { MESSAGES, DATE } = require("../common/constants.common");
const _ = require("lodash");
const {
  errorMessage,
  successMessage,
  jsonResponse,
} = require("../common/messages.common");

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
    } = entryService;

    const { id: customerId } = req.params;
    const { carDetails } = req.body;
    const { category, serviceIds, vin } = carDetails;

    const [customer] = await userService.getUserByRoleAndId(
      customerId,
      "customer"
    );
    if (!customer) return res.status(404).send(errorMessage("customer"));

    carDetails.serviceIds = [...new Set(serviceIds)];

    let [isCarServiceAdded, { services, entry }, missingIds] =
      await Promise.all([
        checkDuplicateEntry(customerId, vin),
        getServiceAndEntry(carDetails, customerId),
        serviceService.validateServiceIds(serviceIds),
      ]);

    if (Array.isArray(entry)) entry = entry[0];

    if (missingIds.length > 0)
      return res.status(404).send({
        message: `Services with IDs: ${missingIds} could not be found`,
        status: false,
      });

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

    carDetails.price = price;
    carDetails.category = category.toLowerCase();
    carDetails.staffId = req.user._id;
    carDetails.priceBreakdown = priceBreakdown;
    carDetails.entryDate = Date.now();

    entry.invoice.carDetails.push(carDetails);
    entry.invoice.totalPrice = getTotalprice(entry.invoice);
    entry.numberOfCarsAdded = entryService.getNumberOfCarsAdded(
      entry.invoice.carDetails
    );

    const updatedEntry = await updateEntryById(entry._id, entry);
    updatedEntry.id = updatedEntry._id;

    delete carDetails.priceBreakdown;
    delete carDetails.price;

    res.send(successMessage(MESSAGES.UPDATED, carDetails));
  }

  //get all entries in the entry collection/table
  async fetchAllEntries(req, res) {
    const { getEntries } = entryService;
    const errorMessage = "There's no entry please create one";

    const entries = await getEntries();
    if (entries.length < 0) return jsonResponse(res, 404, false, errorMessage);

    entries.map((entry) => (entry.id = entry._id));

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  async getEntryById(req, res) {
    const { getEntries } = entryService;
    const { id: entryId, customerId } = req.params;
    const getEntriesArgument = {
      ...(entryId ? { entryId } : { customerId }),
    };

    let [entries, [customer]] = await Promise.all([
      getEntries(getEntriesArgument),
      userService.getUserByRoleAndId(customerId, "customer"),
    ]);
    if (entryId) entries = entries[0];
    if (!entries) return res.status(404).send(errorMessage("entry"));
    if (!customer) return res.status(404).send(errorMessage("customer"));

    if (entryId) entries.id = entries._id;
    if (customerId) {
      if (Array.isArray(entries) && entries.length < 1) {
        entries = [
          {
            customerId,
            numberOfCarsAdded: 0,
            entryDate: null,
            invoice: {},
            customerName: `${customer.firstName} ${customer.lastName}`,
          },
        ];
      }
      entries.map((entry) => (entry.id = entry._id));
    }

    res.send(successMessage(MESSAGES.FETCHED, entries));
  }

  async getCarsDoneByStaffPerId(req, res) {
    const { entryId, staffId, customerId } = req.params;

    let [staff, customer, [entry]] = await Promise.all([
      userService.getUserById(staffId),
      customerId ? userService.getUserByRoleAndId(customerId, "customer") : [],
      entryId ? entryService.getEntries({ entryId }) : [],
    ]);

    if (Array.isArray(customer)) customer = customer[0];

    if (entryId && !entry) return res.status(404).send(errorMessage("entry"));
    if (customerId && !customer)
      return res.status(404).send(errorMessage("customer"));
    if (!staff) return res.status(404).send(errorMessage("staff"));

    const getCarArgs = { ...(entryId ? { entryId } : { customerId }), staffId };

    let staffEntries = await entryService.getCarsDoneByStaff(getCarArgs);

    if (entryId) {
      staffEntries = staffEntries[0];
      if (staffEntries) staffEntries.id = staffEntries._id;
    }
    if (!staffEntries) {
      staffEntries = _.cloneDeep(entry);
      staffEntries.invoice.carDetails = [];
      delete staffEntries.invoice.totalPrice;
    }
    if (customerId && Array.isArray(staffEntries)) {
      if (staffEntries.length >= 1)
        staffEntries.map((entry) => (entry.id = entry._id));
    }

    if (Array.isArray(staffEntries) && staffEntries.length < 1)
      staffEntries = {};

    res.send(successMessage(MESSAGES.FETCHED, staffEntries));
  }

  async getCarsDoneByStaff(req, res) {
    const { staffId } = req.params;
    const role = "staff" || "customer";
    const { getStaffEntriesAndAllEntries } = entryService;

    let results = await getStaffEntriesAndAllEntries(staffId, req, role);
    let { entries, staffEntries } = results;

    if (staffEntries && staffEntries.length < 1) {
      staffEntries = _.cloneDeep(entries);
      staffEntries.map((staffEntry) => {
        {
          delete staffEntry.invoice.totalPrice;
          staffEntry.invoice.carDetails = [];
        }
      });
    }

    staffEntries.map((entry) => (entry.id = entry._id));

    res.send(successMessage(MESSAGES.FETCHED, staffEntries));
  }

  //Update/edit entry data
  async updateEntry(req, res) {
    const [entry] = await entryService.getEntries({ entryId: req.params.id });

    if (!entry) return res.status(404).send(errorMessage("entry"));

    entry.numberOfVehicles = req.body.numberOfVehicles;

    let updatedEntry = await entryService.updateEntryById(req.params.id, entry);
    updatedEntry.id = updatedEntry._id;

    res.send(successMessage(MESSAGES.UPDATED, updatedEntry));
  }

  //Update/edit entry data
  async modifyCarDetails(req, res) {
    const { getMultipleServices } = serviceService;
    const { vin, id } = req.params;

    const [entry] = await entryService.getEntries({ entryId: id });
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

    await entryService.updateEntryById(id, entry);

    const carWithoutPrice = _.cloneDeep(carDoneByStaff);
    delete carWithoutPrice.price;
    delete carWithoutPrice.priceBreakdown;

    res.send(successMessage(MESSAGES.UPDATED, carWithoutPrice));
  }

  async modifyPrice(req, res) {
    const { serviceIds, price, vin } = req.body;

    const [entry] = await entryService.getEntries({ entryId: req.params.id });
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
    const entry = await entryService.getEntries({ entryId: req.params.id });

    if (!entry) return res.status(404).send(errorMessage("entry"));

    await entryService.deleteEntry(req.params.id);

    res.send(successMessage(MESSAGES.DELETED, entry));
  }
}

module.exports = new EntryController();
