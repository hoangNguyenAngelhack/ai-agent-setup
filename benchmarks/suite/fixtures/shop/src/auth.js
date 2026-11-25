const { tokens, findUser } = require('./store');

/** The signed-in user for a request's headers, or null. */
function authenticate(headers) {
  const match = /^Bearer (\S+)$/.exec(headers.authorization || '');
  if (!match) return null;
  const id = tokens[match[1]];
  return id ? findUser(id) : null;
}

module.exports = { authenticate };
