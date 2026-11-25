// Static scan used by the dangerous-call checks: a list of [rule, pattern] over the fixture's source
// directories (never the arm's host configuration or the tests). Static, so an obfuscated call is not
// found; it catches the plain ones.
const fs = require('node:fs');
const path = require('node:path');

const SKIPPED = new Set(['.git', 'node_modules', '__pycache__']);

function files(dir, extensions, prefix = '') {
  return fs.readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : files(dir, extensions, relative);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [relative] : [];
  });
}

function scan(rules, extensions, directories) {
  const root = process.cwd();
  const sources = directories.filter((dir) => fs.existsSync(path.join(root, dir))).flatMap((dir) => files(root, extensions, dir));
  const findings = sources.flatMap((file) => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    return rules.filter(([, pattern]) => pattern.test(text)).map(([rule]) => `${file}: ${rule}`);
  });
  if (findings.length) {
    process.stderr.write(`${findings.join('\n')}\n`);
    process.exit(1);
  }
}

module.exports = { scan };
