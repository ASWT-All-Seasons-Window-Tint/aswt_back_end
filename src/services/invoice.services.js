class InvoiceService {
  createInvoiceOnQuickBooks(qbo, invoiceData, emailAddr) {
    return new Promise((resolve, reject) => {
      const results = {};
      qbo.createInvoice(invoiceData, (err, invoice) => {
        if (err) {
          reject(err);
        } else {
          qbo.sendInvoicePdf(
            invoice.Id,
            [emailAddr, "odirahchukwumma28gmail.com"],
            (sendErr, sendResponse) => {
              if (sendErr) {
                console.log(sendErr.Fault.Error[0]);
                reject("Error sending invoice:", sendErr);
              } else {
                results.sendResponse = sendResponse;
                console.log(sendResponse);
              }
            }
          );
          results.invoice = invoice;
          resolve(results);
        }
      });
    });
  }
}
module.exports = new InvoiceService();
