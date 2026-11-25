const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { findUser } = load('src/store.js');
  const name = (user) => (user === undefined ? 'undefined' : user && user.name);
  const { handle } = load('src/app.js');
  return {
    names: [name(findUser('2')), name(findUser(2)), name(findUser('abc')), name(findUser('0'))],
    cy: handle({ method: 'GET', url: '/users/3', headers: {} }).body.name,
  };
`);
assert.deepStrictEqual(seen.names, ['Bob', 'Bob', 'undefined', 'undefined']);
assert.strictEqual(seen.cy, 'Cy');
