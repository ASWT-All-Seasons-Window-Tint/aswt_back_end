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

  sendInvoicePdf(qbo, invoiceId, emailAddr) {
    return new Promise((resolve, reject) => {
      qbo.sendInvoicePdf(invoiceId, emailAddr, (sendErr, sendResponse) => {
        if (sendErr) {
          console.log(sendErr.Fault.Error[0]);
          reject("Error sending invoice:", sendErr);
        } else {
          resolve(sendResponse);
        }
      });
    });
  }
}
module.exports = new InvoiceService();
