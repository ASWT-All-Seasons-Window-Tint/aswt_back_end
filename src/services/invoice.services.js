const { getOrSetCache } = require("../utils/getOrSetCache.utils");
const initializeQbUtils = require("../utils/initializeQb.utils");

class InvoiceService {
  createInvoiceOnQuickBooks(qbo, invoiceData, emailAddr, sendPdf = true) {
    return new Promise((resolve, reject) => {
      const results = {};
      qbo.createInvoice(invoiceData, (err, invoice) => {
        if (err) {
          reject(err);
        } else {
          results.invoice = invoice;

          if (sendPdf) {
            qbo.sendInvoicePdf(
              invoice.Id,
              emailAddr,
              (sendErr, sendResponse) => {
                if (sendErr) {
                  console.log(sendErr.Fault.Error[0]);
                  reject("Error sending invoice:", sendErr);
                } else {
                  results.sendResponse = sendResponse;
                }
              }
            );
          }

          resolve(results);
        }
      });
    });
  }

  async updateInvoiceById(qbo, Id, invoice, SyncToken) {
    return new Promise((resolve, reject) => {
      qbo.updateInvoice(
        {
          Id,
          SyncToken,
          sparse: true,
          ...invoice,
        },
        (err, invoice) => {
          if (err) {
            reject(err);
          } else {
            resolve(invoice);
          }
        }
      );
    });
  }

  async getInvoiceById(qbo, invoiceId) {
    // Initialize the QuickBooks SDK
    return new Promise((resolve, reject) => {
      qbo.getInvoice(invoiceId, (err, invoice) => {
        if (err) {
          reject(err);
        } else {
          resolve(invoice);
        }
      });
    });
  }

  getOrSetInvoiceOnCache = async (id, qbo) => {
    const expires = 1800;

    const results = await getOrSetCache(
      `invoices?Id=${id}`,
      expires,
      this.getInvoiceById,
      [qbo, id]
    );

    return results;
  };

  async getUnpaidInvoices(qbo) {
    return new Promise((resolve, reject) => {
      qbo.findInvoices(
        [{ field: "Balance", value: "0", operator: ">" }],
        (err, invoice) => {
          if (err) {
            reject(err);
          } else {
            resolve(invoice.QueryResponse.Invoice);
          }
        }
      );
    });
  }

  sendInvoicePdf(qbo, invoiceId, emailAddr) {
    return new Promise((resolve, reject) => {
      qbo.sendInvoicePdf(invoiceId, emailAddr, (sendErr, sendResponse) => {
        if (sendErr) {
          if (sendErr.Fault) {
            console.log(sendErr.Fault.Error[0]);
          }
          reject("Error sending invoice:", sendErr);
        } else {
          resolve(sendResponse);
        }
      });
    });
  }

  addVInToAppointmentInvoice(carDetails, Line) {
    carDetails.forEach((car) => {
      car.priceBreakdown.forEach((priceObj) => {
        const priceLine = Line.find((line) => line.Id === priceObj.lineId);
        const description = priceLine.Description;
        const vin = car.vin;

        const newDescription =
          description &&
          typeof description === "string" &&
          !description.includes(vin)
            ? `${description} with VIN: ${vin}`
            : description;

        priceLine.Description = newDescription;
      });
    });
  }
}
module.exports = new InvoiceService();
