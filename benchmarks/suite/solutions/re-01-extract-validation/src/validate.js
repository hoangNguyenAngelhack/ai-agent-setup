function isPositiveInt(value) {
  return /^[1-9][0-9]*$/.test(String(value));
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = { isPositiveInt, isEmail };
