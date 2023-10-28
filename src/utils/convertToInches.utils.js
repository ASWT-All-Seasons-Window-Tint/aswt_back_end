module.exports = function (value, unit) {
  const units = {
    mm: value * 0.0393701, // Millimeters to inches
    yd: value * 36, // Yards to inches
    mi: value * 63360, // Miles to inches
    nmi: value * 72913.4, // Nautical miles to inches
    cm: value * 0.393701, // Centimeters to inches
    m: value * 39.3701, // Meters to inches
    ft: value * 12, // Feet to inches
    in: value, // Inches
    km: value * 39370.1, // Kilometers to inches
  };

  if (units[unit.toLowerCase()] !== undefined) {
    return units[unit.toLowerCase()];
  } else {
    return "Invalid unit. Please provide one of: cm, m, ft, in, km, mm, yd, mi, nmi";
  }
};
