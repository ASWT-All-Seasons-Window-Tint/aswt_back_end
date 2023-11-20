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

class DepartmentController {
  async getStatus(req, res) {
    res.status(200).send({ message: MESSAGES.DEFAULT, success: true });
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
}

module.exports = new DepartmentController();
