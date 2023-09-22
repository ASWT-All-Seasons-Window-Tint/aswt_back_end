class InvoiceService {
  createInvoiceOnQuickBooks(qbo, invoiceData, emailAddr) {
    return new Promise((resolve, reject) => {
      const results = {};
      qbo.createInvoice(invoiceData, (err, invoice) => {
        if (err) {
          reject(err);
        } else {
          qbo.sendInvoicePdf(invoice.Id, emailAddr, (sendErr, sendResponse) => {
            if (sendErr) {
              reject("Error sending invoice:", sendErr);
            } else {
              results.sendResponse = sendResponse;
            }
          });
          results.invoice = invoice;
          resolve(results);
        }
      });
    });
  }
}
module.exports = new InvoiceService();
