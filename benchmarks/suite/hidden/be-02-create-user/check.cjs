const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

// One subject: the created user must be visible to the next request of the same process.
const seen = observe(`
  const { handle } = load('src/app.js');
  const post = (body) => handle({ method: 'POST', url: '/users', headers: {}, body });
  const created = post({ name: 'Dee', email: 'dee@example.com' });
  return {
    created,
    lookup: handle({ method: 'GET', url: '/users?email=dee@example.com', headers: {} }).status,
    badEmail: post({ name: 'Eve', email: 'not-an-email' }),
    noName: post({ email: 'eve@example.com' }).status,
    duplicate: post({ name: 'Ada again', email: 'ada@example.com' }),
  };
`);
assert.strictEqual(seen.created.status, 201);
assert.ok(Number.isInteger(seen.created.body.id) && seen.created.body.id > 3);
assert.strictEqual(seen.created.body.name, 'Dee');
assert.strictEqual(seen.lookup, 200);
assert.strictEqual(seen.badEmail.body.error.code, 'VALIDATION_ERROR');
assert.strictEqual(seen.noName, 422);
assert.strictEqual(seen.duplicate.status, 409);
assert.strictEqual(seen.duplicate.body.error.code, 'CONFLICT');
