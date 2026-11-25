const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const app = () => require(path.join(root, 'src', 'app.js'));
const get = (url, headers = {}) => app().handle({ method: 'GET', url, headers });
const bob = { authorization: 'Bearer token-bob' };
const ada = { authorization: 'Bearer token-ada' };
const runTests = (cwd, file) => spawnSync(process.execPath, ['--test', file], { cwd, encoding: 'utf8' }).status;

let missing;
assert.doesNotThrow(() => {
  missing = get('/users/99');
});
assert.strictEqual(missing.status, 404);
assert.strictEqual(missing.body.error.code, 'NOT_FOUND');
assert.deepStrictEqual(get('/users/2').body, { id: 2, name: 'Bob', email: 'bob@example.com' });
assert.strictEqual(get('/users/abc').status, 400);
