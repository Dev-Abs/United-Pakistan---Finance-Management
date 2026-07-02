module.exports = {
  calculateRemaining: (totalPayable, amountPaid) => {
    const total = Number(totalPayable) || 0;
    const paid = Number(amountPaid) || 0;
    const remaining = total - paid;
    return remaining > 0 ? remaining : 0;
  },
  
  calculateStatus: (totalPayable, amountPaid) => {
    const total = Number(totalPayable) || 0;
    const paid = Number(amountPaid) || 0;
    
    if (paid >= total && total > 0) return 'Paid';
    if (paid > 0 && paid < total) return 'Partially Paid';
    return 'Pending';
  },

  calculateTotalPayable: (monthlyFund, previousBalance) => {
    const fund = Number(monthlyFund) || 0;
    const prev = Number(previousBalance) || 0;
    return fund + prev;
  }
};
