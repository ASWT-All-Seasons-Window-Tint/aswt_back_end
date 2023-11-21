const { getEntries, updateEntryById } = require("../services/entry.services");
const invoiceService = require("../services/invoice.services");
const {
  errorMessage,
  successMessage,
  jsonResponse,
} = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");
const convertEntryQbInvoiceReqBody = require("../utils/convertDbInvoiceToQbInvoiceReqBody.utils");
const initializeQbUtils = require("../utils/initializeQb.utils");
const userServices = require("../services/user.services");
const serviceServices = require("../services/service.services");
const { updateCache } = require("../utils/getOrSetCache.utils");
const entryControllers = require("./entry.controllers");

class DepartmentController {
  async getInvoiceById(req, res) {
    const { invoiceId } = req.params;
    const qbo = initializeQbUtils();

    const { data: invoice, error } =
      await invoiceService.getOrSetInvoiceOnCache(invoiceId, qbo);

    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    return res.send(successMessage(MESSAGES.FETCHED, invoice));
  }
  //Create a new department
  sendInvoice = async (req, res) => {
    const [entry] = await getEntries({ entryId: req.params.id });
    if (!entry) return res.status(404).send(errorMessage("entry"));

    const isInvoiceSent = entry.invoice.sent === true;
    if (isInvoiceSent)
      return jsonResponse(
        res,
        400,
        false,
        "This invoice has been sent already"
      );
    const invoice = await this.createAndSendInvoice(entry);

    return res.send(
      successMessage("Invoice successfully created and sent", invoice)
    );
  };

  async createAndSendInvoice(entry) {
    const { invoice: invoiceData } = convertEntryQbInvoiceReqBody(entry);
    const qbo = await initializeQbUtils();
    let { customerEmail, customerId } = entry;

    const customer = await userServices.findCustomerByQbId(customerId);

    if (customer) {
      const alterNativeEmails = customer.customerDetails.alterNativeEmails;
      const newEmail = customerEmail;
      if (alterNativeEmails.length > 0)
        for (const email of alterNativeEmails)
          if (newEmail !== email) customerEmail += `, ${email}`;
    }

    console.log(customerEmail);
    const { invoice } = await invoiceService.createInvoiceOnQuickBooks(
      qbo,
      invoiceData,
      customerEmail
    );

    entry.invoice.qbId = invoice.Id;
    entry.isActive = false;
    entry.invoice.invoiceNumber = invoice.DocNumber;
    entry.invoice.sent = true;

    await updateEntryById(entry._id, entry);

    return invoice;
  }

  async sendInvoiceWithoutCreating(entry) {
    const qbo = await initializeQbUtils();
    let { customerEmail, customerId } = entry;
    const invoiceId = entry.invoice.qbId;

    const customer = await userServices.findCustomerByQbId(customerId);

    if (customer) {
      const alterNativeEmails = customer.customerDetails.alterNativeEmails;
      const newEmail = customerEmail;
      if (alterNativeEmails.length > 0)
        for (const email of alterNativeEmails)
          if (newEmail !== email) customerEmail += `, ${email}`;
    }

    invoiceService.sendInvoicePdf(qbo, invoiceId, customerEmail);
  }

  async updateInvoiceById(req, res) {
    const { price } = req.body;
    const qbo = await initializeQbUtils();

    const results = await entryControllers.modifyPrice(req, res, true);

    if (results.statusCode) return;

    const { qbId: invoiceId } = results.updatedEntry.invoice;
    const { lineId } = results.servicePrice;

    if (!invoiceId)
      return jsonResponse(res, 400, false, "This invoice has not been sent");

    const { data: invoice, error } =
      await invoiceService.getOrSetInvoiceOnCache(invoiceId, qbo);

    if (error)
      return jsonResponse(res, 404, false, error.Fault.Error[0].Detail);

    const { SyncToken } = invoice;

    const lineItem = invoice.Line.find((line) => (line.Id = lineId));
    const index = invoice.Line.findIndex(
      (line) => line.DetailType === "SubTotalLineDetail"
    );

    invoice.Line.splice(index, 1);

    lineItem.SalesItemLineDetail.UnitPrice = price;
    lineItem.Amount = price;
    delete invoice.TotalAmount;

    const updatedInvoice = await invoiceService.updateInvoiceById(
      qbo,
      invoiceId,
      invoice,
      SyncToken
    );

    const expires = 1800;

    updateCache(`invoices?Id=${invoiceId}`, expires, updatedInvoice);

    await invoiceService.sendInvoicePdf(qbo, invoiceId);

    return res.send(successMessage(MESSAGES.UPDATED, results.updatedEntry));
  }
}

module.exports = new DepartmentController();
