require("dotenv").config();
const stripe = require("stripe")(process.env.stripeSecretKey);

class StripeService {
  calculateStripeFee(desiredNetAmount) {
    const stripeFeePercentage = 0.029; // 2.9%
    const stripeFeeFixed = 0.3; // $0.30

    // Calculate the total amount to charge to achieve the desired net amount after fees
    const totalAmountToCharge =
      (desiredNetAmount + stripeFeeFixed) / (1 - stripeFeePercentage);

    // Round the total amount to charge to ensure precision in the final charge
    const roundedTotalAmount = Math.round(totalAmountToCharge * 100) / 100;

    return roundedTotalAmount;
  }

  createPromoCode = async (percentOff, expirationDate, promoCode) => {
    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      redeem_by: this.convertDateStringToTimeStamp(expirationDate),
    });

    const promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: promoCode,
    });

    return promotionCode;
  };

  async getAllPromoCodes() {
    const promotionCodes = await stripe.promotionCodes.list();

    return promotionCodes;
  }

  convertDateStringToTimeStamp(dateString) {
    const unixTimestamp = Date.parse(dateString) / 1000;

    return unixTimestamp;
  }

  createStripeSession = async (appointment, appointmentId) => {
    const appointmentType = appointment.appointmentType;
    const autoAppointmentType = appointmentType === "auto";
    let customerMeasurementAwareness = true;

    if (!autoAppointmentType) {
      customerMeasurementAwareness =
        appointment.residentialDetails.customerMeasurementAwareness;
    }

    const priceBreakdown = autoAppointmentType
      ? appointment.carDetails.priceBreakdown
      : appointment.residentialDetails.priceBreakdown;

    const totalPrice = autoAppointmentType
      ? appointment.carDetails.price
      : appointment.residentialDetails.price;

    const thirtyPercentOfPrice = (totalPrice * 30) / 100;

    const pricePlusStripeFee = this.calculateStripeFee(totalPrice);

    const thirtyPercentOfPricePlusStripeFee =
      this.calculateStripeFee(thirtyPercentOfPrice);

    const stripeFee = customerMeasurementAwareness
      ? Math.round(
          (thirtyPercentOfPricePlusStripeFee - thirtyPercentOfPrice) * 100
        ) / 100
      : Math.round((pricePlusStripeFee - totalPrice) * 100) / 100;

    const stripeServiceName = "Stripe processing fee";

    const stripeFeeeService = {
      price: stripeFee,
      serviceName: stripeServiceName,
    };

    priceBreakdown.push(stripeFeeeService);

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        mode: "payment",
        line_items: priceBreakdown.map((item) => {
          const price = item.price;
          const thirtyPercentOfPriceInCents = Math.round(price * 30);

          return {
            price_data: {
              currency: "usd",
              product_data: {
                name: item.serviceName,
              },
              unit_amount: customerMeasurementAwareness
                ? item.serviceName === stripeServiceName
                  ? Math.round(price * 100)
                  : thirtyPercentOfPriceInCents
                : Math.round(price * 100),
            },
            quantity: 1,
          };
        }),
        // automatic_tax: {
        //   enabled: true,
        // },
        invoice_creation: {
          enabled: true,
        },
        allow_promotion_codes: true,
        payment_intent_data: {
          metadata: {
            appointmentId,
            stripeConnectedAccountId: process.env.stripeConnectedAccountId,
          },
        },
        success_url: process.env.stripeSuccessUrl,
        cancel_url: `${process.env.apiUrl}/client/cancel.html`,
      }
      // {
      //   stripeAccount,
      // }
    );

    return session;
  };
}

module.exports = new StripeService();
