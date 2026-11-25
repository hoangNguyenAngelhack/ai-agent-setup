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

const { debounce } = require(path.join(root, 'src', 'debounce.js'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const calls = [];
  const search = debounce((...args) => calls.push(args), 50);
  search('a');
  search('ab');
  search('abc');
  await sleep(20);
  assert.strictEqual(calls.length, 0, 'called before the wait');
  await sleep(90);
  assert.deepStrictEqual(calls, [['abc']]);
  const dropped = debounce(() => calls.push(['dropped']), 50);
  dropped();
  assert.strictEqual(typeof dropped.cancel, 'function');
  dropped.cancel();
  await sleep(100);
  assert.deepStrictEqual(calls, [['abc']]);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
