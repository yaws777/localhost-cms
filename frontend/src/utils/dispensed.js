// dispensed.js
// Medicine the nurse gave at the time out of a check-up (dispensed_* columns of the doctor visit rows).
// One line: "Biogesic (Paracetamol) - 2 tablet", empty when nothing was dispensed.
export const dispensedLine = (a) => {
    if (!a || !a.dispensed_medicine) return '';
    const qty = Number(a.dispensed_quantity);
    const amount = Number.isFinite(qty) && qty > 0 ? `${Math.round(qty * 100) / 100}${a.dispensed_unit ? ` ${a.dispensed_unit}` : ''}` : '';
    return amount ? `${a.dispensed_medicine} - ${amount}` : a.dispensed_medicine;
};
