const { getNewAccessToken } = require("./getNewAccessToken.utils");
const getWebhookDataUtils = require("./getWebhookData.utils");

module.exports = async (apiEndpoint) => {
  const payload = await getWebhookDataUtils(apiEndpoint, getNewAccessToken);

  const customerId = payload.Payment.CustomerRef.value;
  const amount = payload.Payment.TotalAmt;
  const currency = payload.Payment.CurrencyRef.value;
  const { invoiceId, invoiceNumber } = getQbIdAndNumber(payload);
  const paymentDate = new Date(payload.time);
  const qbPaymentId = payload.Payment.Id;

  return {
    customerId,
    currency,
    invoiceId,
    paymentDate,
    amount,
    invoiceNumber,
    qbPaymentId,
  };
};

function getQbIdAndNumber(data) {
  const invoiceLine = data.Payment.Line.find((item) => {
    return (
      item.LinkedTxn &&
      item.LinkedTxn.length > 0 &&
      item.LinkedTxn[0].TxnType === "Invoice"
    );
  });

  if (invoiceLine) {
    const invoiceId = invoiceLine.LinkedTxn[0].TxnId;
    const invoiceNumber = invoiceLine.LineEx.any.find(
      (item) =>
        item.name === "{http://schema.intuit.com/finance/v3}NameValue" &&
        item.value.Name === "txnReferenceNumber"
    )?.value.Value;
    return { invoiceId, invoiceNumber };
  }
}
