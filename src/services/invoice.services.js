class InvoiceService {
  createInvoiceOnQuickBooks(qbo, invoiceData) {
    return new Promise((resolve, reject) => {
      qbo.createInvoice(invoiceData, (err, invoice) => {
        if (err) {
          reject(err);
        } else {
          resolve(invoice);
        }
      });
    });
  }
}
module.exports = new InvoiceService();
