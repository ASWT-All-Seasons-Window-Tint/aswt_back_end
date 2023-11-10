class PaymentService {
  getPaymentReqBody(customer, amount, invoiceId) {
    const customerId = customer.Id;

    const paymentReqBody = {
      CustomerRef: {
        value: customerId,
        name: customer.DisplayName,
      },
      TotalAmt: amount,
      Line: [
        {
          Amount: amount,
          LinkedTxn: [
            {
              TxnId: invoiceId,
              TxnType: "Invoice",
            },
          ],
        },
      ],
      CustomField: [
        {
          Name: "shouldBeUpdated",
          BooleanValue: false,
        },
      ],
    };

    return paymentReqBody;
  }

  createPayment(qbo, paymentData) {
    return new Promise((resolve, reject) => {
      qbo.createPayment(paymentData, (err, payment) => {
        if (err) {
          reject(err.Fault.Error);
        } else {
          resolve(payment);
        }
      });
    });
  }
}

module.exports = new PaymentService();
