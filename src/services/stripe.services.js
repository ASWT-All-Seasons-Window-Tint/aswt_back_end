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
}

module.exports = new StripeService();
