const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const [source, testFile] = process.argv.slice(2);
assert.ok(fs.existsSync(path.join(root, testFile)), `no ${testFile}`);
const run = (implementation) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutant-'));
  fs.mkdirSync(path.join(dir, path.dirname(source)), { recursive: true });
  fs.mkdirSync(path.join(dir, path.dirname(testFile)), { recursive: true });
  fs.writeFileSync(path.join(dir, source), implementation);
  fs.copyFileSync(path.join(root, testFile), path.join(dir, testFile));
  return spawnSync(process.execPath, ['--test', testFile], { cwd: dir, encoding: 'utf8' }).status;
};
assert.strictEqual(run(fs.readFileSync(path.join(root, source), 'utf8')), 0, 'the tests fail on the real implementation');
const mutants = fs.readdirSync(path.join(__dirname, 'mutants')).sort();
for (const name of mutants) assert.notStrictEqual(run(fs.readFileSync(path.join(__dirname, 'mutants', name), 'utf8')), 0, `mutant ${name} survived`);
