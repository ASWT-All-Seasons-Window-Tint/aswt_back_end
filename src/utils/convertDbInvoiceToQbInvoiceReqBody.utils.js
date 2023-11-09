module.exports = function (mongoDBInvoice, type) {
  const qboInvoice = {
    Line: [],
    CustomerRef: {
      value: mongoDBInvoice.customerId, // Replace with the customer ID or name
      name: mongoDBInvoice.customerName, // Replace with the customer name
    },
    AllowIPNPayment: true,
    AllowOnlinePayment: true,
    AllowOnlineCreditCardPayment: true,
    AllowOnlineACHPayment: true,
    TxnDate: new Date().toISOString().split("T")[0], // Current date
    DueDate: new Date().toISOString().split("T")[0], // Same as TxnDate by default
    // Add other fields as needed
  };

  // Transform carDetails into invoice line items
  let { carDetails } = mongoDBInvoice.invoice
    ? mongoDBInvoice.invoice
    : mongoDBInvoice;

  if (carDetails) {
    if (!Array.isArray(carDetails)) {
      carDetails = [carDetails];
    }
    carDetails.forEach((carDetail) => {
      const { priceBreakdown } = carDetail;

      convertPriceBreakDown(priceBreakdown, type, carDetail);
      // Loop through priceBreakdown for this carDetail
    });
  } else {
    const { priceBreakdown } = mongoDBInvoice.residentialDetails;

    convertPriceBreakDown(priceBreakdown, type);
  }

  function convertPriceBreakDown(priceBreakdown, type, carDetail) {
    priceBreakdown.forEach((priceDetail) => {
      qboInvoice.Line.push({
        Description: !type
          ? `${priceDetail.serviceName} service done on ${carDetail.make}, identified by VIN number: ${carDetail.vin}`
          : "Appointment Booking",
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
  }

  return { invoice: qboInvoice };
};
