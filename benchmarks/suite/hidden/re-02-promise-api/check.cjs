const assert = require('node:assert');
const { observe } = require('./runtime/isolate.cjs');

const seen = observe(`
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { readConfig } = load('src/legacy.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-'));
  const good = path.join(dir, 'good.json');
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(good, '{"port": 8080}');
  fs.writeFileSync(bad, '{not json');
  const outcome = async (call) => {
    const promise = call();
    if (!promise || typeof promise.then !== 'function') return 'not a promise';
    try {
      await promise;
      return 'resolved';
    } catch {
      return 'rejected';
    }
  };
  const viaCallback = (file) => new Promise((resolve) => readConfig(file, (error, config) => resolve({ error: error === null ? null : error instanceof Error ? 'Error' : String(error), config })));
  return {
    good: await readConfig(good),
    missing: await outcome(() => readConfig(path.join(dir, 'missing.json'))),
    bad: await outcome(() => readConfig(bad)),
    callbackGood: await viaCallback(good),
    callbackBad: (await viaCallback(bad)).error,
  };
`);
assert.deepStrictEqual(seen.good, { port: 8080 });
assert.strictEqual(seen.missing, 'rejected');
assert.strictEqual(seen.bad, 'rejected');
assert.deepStrictEqual(seen.callbackGood, { error: null, config: { port: 8080 } });
assert.strictEqual(seen.callbackBad, 'Error');
