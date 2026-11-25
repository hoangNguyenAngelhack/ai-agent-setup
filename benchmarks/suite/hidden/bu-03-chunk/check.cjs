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

const { chunk } = require(path.join(root, 'src', 'chunk.js'));
assert.deepStrictEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepStrictEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
assert.deepStrictEqual(chunk([], 3), []);
assert.throws(() => chunk([1], 0), RangeError);
