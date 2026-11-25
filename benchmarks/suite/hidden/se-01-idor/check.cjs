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

const other = get('/orders/1', bob);
assert.strictEqual(other.status, 403);
assert.strictEqual(other.body.error.code, 'FORBIDDEN');
assert.strictEqual(get('/orders/2', bob).status, 200);
assert.strictEqual(get('/orders/2', ada).status, 200);
assert.strictEqual(get('/orders/999', bob).status, 404);
assert.strictEqual(get('/orders/2').status, 401);
