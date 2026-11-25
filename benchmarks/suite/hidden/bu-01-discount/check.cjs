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

const { computeTotal } = require(path.join(root, 'src', 'price.js'));
const items = [{ price: 10, qty: 2 }, { price: 5, qty: 1 }];
assert.strictEqual(computeTotal(items, 10), 22.5);
assert.strictEqual(computeTotal(items), 25);
assert.strictEqual(computeTotal([{ price: 0.1, qty: 3 }]), 0.3);
assert.strictEqual(computeTotal([{ price: 19.99, qty: 3 }], 15), 50.97);
