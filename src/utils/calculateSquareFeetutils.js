module.exports = function (length, lengthUnit, width, widthUnit) {
  const convertToFeet = {
    cm: 1 / 30.48, // Centimeters to feet
    m: 3.28084, // Meters to feet
    ft: 1, // Feet
    in: 1 / 12, // Inches to feet
    km: 3280.84, // Kilometers to feet
    mm: 1 / 304.8, // Millimeters to feet
    yd: 3, // Yards to feet
    mi: 5280, // Miles to feet
  };

  if (!length && !lengthUnit && !width && !widthUnit) {
    return Object.keys(convertToFeet);
  }

  if (
    convertToFeet[lengthUnit.toLowerCase()] === undefined ||
    convertToFeet[widthUnit.toLowerCase()] === undefined
  ) {
    return "Invalid unit. Please provide valid units: cm, m, ft, in, km, mm, yd, mi, etc.";
  }

  const lengthInFeet = length * convertToFeet[lengthUnit.toLowerCase()];
  const widthInFeet = width * convertToFeet[widthUnit.toLowerCase()];

  const areaInSquareFeet = lengthInFeet * widthInFeet;
  return areaInSquareFeet;
};
