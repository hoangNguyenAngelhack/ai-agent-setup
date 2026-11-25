const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const { validateSignup } = load('src/validate-form.js');
  const ok = { email: 'dee@example.com', password: 'correcthorse1', confirm: 'correcthorse1' };
  const fields = (input) => Object.keys(validateSignup(input).errors).sort();
  return {
    valid: validateSignup(ok),
    fields: [
      fields({ ...ok, email: '' }),
      fields({ ...ok, email: 'not-an-email' }),
      fields({ ...ok, password: 'short1', confirm: 'short1' }),
      fields({ ...ok, password: 'nodigitsatall', confirm: 'nodigitsatall' }),
      fields({ ...ok, confirm: 'different12345' }),
    ],
    mismatch: validateSignup({ ...ok, confirm: 'x' }).valid,
  };
`);
assert.deepStrictEqual(seen.valid, { valid: true, errors: {} });
assert.deepStrictEqual(seen.fields, [['email'], ['email'], ['password'], ['password'], ['confirm']]);
assert.strictEqual(seen.mismatch, false);
