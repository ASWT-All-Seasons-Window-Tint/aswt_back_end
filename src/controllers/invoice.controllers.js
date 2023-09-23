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

class DepartmentController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
  }

  //Create a new department
  async sendInvoice(req, res) {
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

    const { invoice: invoiceData } = convertEntryQbInvoiceReqBody(entry);
    const qbo = await initializeQbUtils();
    const { customerEmail } = entry;

    const { invoice } = await invoiceService.createInvoiceOnQuickBooks(
      qbo,
      invoiceData,
      customerEmail
    );

    entry.invoice.qbId = invoice.Id;
    entry.isActive = false;
    entry.invoice.invoiceNumber = invoice.DocNumber;
    entry.invoice.sent = true;

    await updateEntryById(req.params.id, entry);

    return res.send(
      successMessage("Invoice successfully created and sent", invoice)
    );
  }
}

module.exports = new DepartmentController();
