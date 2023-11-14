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
}

module.exports = new StripeService();
