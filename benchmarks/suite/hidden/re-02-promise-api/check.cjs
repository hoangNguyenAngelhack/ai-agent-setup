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

const { readConfig } = require(path.join(root, 'src', 'legacy.js'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-'));
const good = path.join(dir, 'good.json');
const bad = path.join(dir, 'bad.json');
fs.writeFileSync(good, '{"port": 8080}');
fs.writeFileSync(bad, '{not json');
const viaCallback = (file) => new Promise((resolve) => readConfig(file, (error, config) => resolve({ error, config })));
(async () => {
  assert.deepStrictEqual(await readConfig(good), { port: 8080 });
  await assert.rejects(readConfig(path.join(dir, 'missing.json')));
  await assert.rejects(readConfig(bad));
  assert.deepStrictEqual(await viaCallback(good), { error: null, config: { port: 8080 } });
  assert.ok((await viaCallback(bad)).error instanceof Error);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
