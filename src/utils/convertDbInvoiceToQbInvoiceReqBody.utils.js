module.exports = function (mongoDBInvoice) {
  const qboInvoice = {
    Line: [],
    CustomerRef: {
      value: "83", // Replace with the customer ID or name
      name: "Olisaeloka Odira Paul", // Replace with the customer name
    },
    TxnDate: new Date().toISOString().split("T")[0], // Current date
    DueDate: new Date().toISOString().split("T")[0], // Same as TxnDate by default
    // Add other fields as needed
  };

  // Transform carDetails into invoice line items
  mongoDBInvoice.invoice.carDetails.forEach((carDetail) => {
    // Loop through priceBreakdown for this carDetail
    carDetail.priceBreakdown.forEach((priceDetail) => {
      qboInvoice.Line.push({
        Amount: priceDetail.price,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: priceDetail.qbId, // Use the serviceId from priceBreakdown
            name: priceDetail.serviceName, // Use the serviceName from priceBreakdown
          },
          UnitPrice: priceDetail.price,
          Qty: 1.0,
        },
      });
    });
  });

  return { invoice: qboInvoice };
};
