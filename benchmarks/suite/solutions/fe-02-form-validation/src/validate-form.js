const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates the sign-up form: { valid, errors } with one message per invalid field. */
function validateSignup({ email = '', password = '', confirm = '' } = {}) {
  const errors = {};
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (password.length < 12 || !/\d/.test(password)) errors.password = 'Use at least 12 characters including a digit.';
  if (confirm !== password) errors.confirm = 'Passwords do not match.';
  return { valid: Object.keys(errors).length === 0, errors };
}

module.exports = { validateSignup };
