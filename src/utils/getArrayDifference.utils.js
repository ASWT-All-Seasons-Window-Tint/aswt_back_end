module.exports = function (arr1, arr2) {
  // Find elements in arr1 that are not in arr2
  const difference1 = arr1.filter((item) => !arr2.includes(item));

  // Find elements in arr2 that are not in arr1
  const difference2 = arr2.filter((item) => !arr1.includes(item));

  // Combine the differences
  const result = difference1.concat(difference2);

  console.log("hit");

  return result;
};
