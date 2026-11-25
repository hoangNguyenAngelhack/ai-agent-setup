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

const { findUser } = require(path.join(root, 'src', 'store.js'));
assert.strictEqual(findUser('2')?.name, 'Bob');
assert.strictEqual(findUser(2)?.name, 'Bob');
assert.strictEqual(findUser('abc'), undefined);
assert.strictEqual(findUser('0'), undefined);
assert.strictEqual(get('/users/3').body.name, 'Cy');
