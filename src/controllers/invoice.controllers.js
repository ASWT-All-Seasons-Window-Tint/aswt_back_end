const { getEntries, updateEntryById } = require("../services/entry.services");
const invoiceService = require("../services/invoice.services");
const {
  errorMessage,
  successMessage,
  jsonResponse,
  forbiddenResponse,
  notFoundResponse,
} = require("../common/messages.common");
const { MESSAGES, errorAlreadyExists } = require("../common/constants.common");
const convertEntryQbInvoiceReqBody = require("../utils/convertDbInvoiceToQbInvoiceReqBody.utils");
const initializeQbUtils = require("../utils/initializeQb.utils");
const userServices = require("../services/user.services");
const serviceServices = require("../services/service.services");
const { updateCache, getOrSetCache } = require("../utils/getOrSetCache.utils");
const estimateServices = require("../services/estimate.services");
const getEstimatePdfUtils = require("../utils/getEstimatePdf.utils");
const entryServices = require("../services/entry.services");
const customerService = require("../services/customer.service");

class DepartmentController {
  async createEstimate(appointment, appointmentType) {
    const qbo = await initializeQbUtils();
    const { invoice: estimateData } = convertEntryQbInvoiceReqBody(
      appointment,
      appointmentType
    );

    const {
      AllowIPNPayment,
      AllowOnlineACHPayment,
      AllowOnlineCreditCardPayment,
      AllowOnlinePayment,
      ...restEstimateData
    } = estimateData;

    const { estimate } = await estimateServices.createEstimateOnQuickBooks(
      qbo,
      restEstimateData
    );

    const estimateId = estimate.Id;

    const pdfBuffer = await getEstimatePdfUtils(estimateId);
    return pdfBuffer;
  }

  async getInvoiceById(req, res) {
    const { invoiceId } = req.params;
    const qbo = await initializeQbUtils();

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

  resendInvoice = async (req, res) => {
    const { id: entryId } = req.params;
    const entry = await entryServices.getEntryById(entryId);

    if (!entry)
      return notFoundResponse(res, "Can't find entry with the given ID");

    if (!entry.invoice.sent)
      return forbiddenResponse(res, "You can only resend sent invoice");

    const response = await this.sendInvoiceWithoutCreating(entry);
    if (!response) return jsonResponse(res, 500, false, "Something failed");

    return jsonResponse(
      res,
      200,
      true,
      "The invoice has been effectively resent."
    );
  };

  sendUpaidInvoices = async (req, res) => {
    let qbInvoices;
    const sentInvoiceIds = [];
    const errorInvoiceId = [];
    try {
      const qbo = await initializeQbUtils();
      const { data: invoices } = await getOrSetCache(
        `invoices`,
        1800,
        invoiceService.getUnpaidInvoices,
        [qbo]
      );

      await this.sendMultipleInvoices(invoices, qbo, sentInvoiceIds);
    } catch (error) {
      if (error.Fault) {
        if (error.Fault.Error) error.Fault.Error.map((err) => console.log(err));
      } else {
        console.log(error);
      }
    }

    return res.send(successMessage("Invoices successfully sent", true));
  };

  sendMultipleInvoices = async (invoices, qbo, sentInvoiceIds) => {
    let customerEmail;
    for (const invoice of invoices) {
      if (!invoice.BillEmail) {
        try {
          const { data: customer, error } =
            await customerService.getOrSetCustomerOnCache(
              invoice.CustomerRef.value,
              qbo
            );

          customerEmail = customer.PrimaryEmailAddr
            ? customer.PrimaryEmailAddr.Address
            : "";
        } catch (error) {
          if (error.Fault) {
            if (error.Fault.Error)
              error.Fault.Error.map((err) => console.log(err));
          } else {
            console.log(error);
          }
        }
      }

      const entry = {
        customerEmail: invoice.BillEmail
          ? invoice.BillEmail.Address
          : customerEmail,
        customerId: invoice.CustomerRef.value,
        invoice: {
          qbId: invoice.Id,
        },
      };

      try {
        await this.sendInvoiceWithoutCreating(entry, qbo);
      } catch (error) {
        if (error.code === 2050) {
          sentInvoiceIds.push(invoice.Id);

          invoices = invoices.filter(
            (invoice) => !sentInvoiceIds.includes(invoice.Id)
          );
          if (invoices.length > 0)
            await this.sendMultipleInvoices(invoices, qbo, sentInvoiceIds);
        }
      }

      sentInvoiceIds.push(invoice.Id);

      console.log(`Sent invoice ${invoice.Id}: ${invoice.DocNumber}`);
    }
  };

  async sendInvoiceWithoutCreating(entry, qbo) {
    if (!qbo) qbo = await initializeQbUtils();

    let { customerEmail, customerId } = entry;
    const invoiceId = entry.invoice.qbId;

    const customer = await userServices.findCustomerByQbId(customerId);

    if (customer) {
      const alterNativeEmails = customer.customerDetails.alterNativeEmails;
      const newEmail = customerEmail;
      if (alterNativeEmails.length > 0)
        for (const email of alterNativeEmails)
          if (newEmail !== email) customerEmail += `, ${email}`;

      while (customerEmail.length > 100) {
        let emailArray = customerEmail.split(", ");

        // Remove the last email
        emailArray.pop();

        // Join the array back into a string
        customerEmail = emailArray.join(", ");
      }
    }

    return invoiceService.sendInvoicePdf(qbo, invoiceId, customerEmail);
  }

  async getUnpaidInvoices(req, res) {
    const qbo = await initializeQbUtils();
    const { data: invoices } = await getOrSetCache(
      `invoices`,
      1800,
      invoiceService.getUnpaidInvoices,
      [qbo]
    );

    return res.send(successMessage(MESSAGES.FETCHED, invoices));
  }

  async updateInvoiceById(price, entry, lineId) {
    const qbo = await initializeQbUtils();

    // const entry = await entryControllers.modifyPrice(req, res, true);

    // if (entry.statusCode) return;
    const errorResponse = {};

    const { qbId: invoiceId } = entry.invoice;

    if (!invoiceId) {
      errorResponse.statusCode = 404;
      errorResponse.message = "This invoice has not been sent";

      return errorResponse;
    }

    const { data: invoice, error } =
      await invoiceService.getOrSetInvoiceOnCache(invoiceId, qbo);

    if (error) {
      errorResponse.statusCode = 404;
      errorResponse.message = error.Fault.Error[0].Detail;

      return errorResponse;
    }

    const { SyncToken } = invoice;

    if (price) {
      const lineItem = invoice.Line.find((line) => line.Id === lineId);

      const index = invoice.Line.findIndex(
        (line) => line.DetailType === "SubTotalLineDetail"
      );

      invoice.Line.splice(index, 1);

      lineItem.SalesItemLineDetail.UnitPrice = price;
      lineItem.Amount = price;
      delete invoice.TotalAmount;
    } else {
      invoiceService.addVInToAppointmentInvoice(
        entry.invoice.carDetails,
        invoice.Line
      );
    }

    const updatedInvoice = await invoiceService.updateInvoiceById(
      qbo,
      invoiceId,
      invoice,
      SyncToken
    );

    const expires = 1800;

    updateCache(`invoices?Id=${invoiceId}`, expires, updatedInvoice);

    await invoiceService.sendInvoicePdf(qbo, invoiceId);

    return errorResponse;
    //return res.send(successMessage(MESSAGES.UPDATED, entry.updatedEntry));
  }
}

module.exports = new DepartmentController();
