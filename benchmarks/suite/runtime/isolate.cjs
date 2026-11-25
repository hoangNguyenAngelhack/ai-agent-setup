'use strict';
/**
 * Runtime of the hidden checks: the code under test (the subject) runs in its own process. The check
 * process loads no workspace code and keeps every assertion, so the code under test can neither end,
 * skip nor change the check; it can only return values. The oracle passes, in
 * BENCHMARK_SUBJECT_PREFIX, a command prefix that also keeps the subject out of the checks' directory
 * (Seatbelt on macOS). The subject gets no BENCHMARK_* variable and no NODE_PATH.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUBJECT_TIMEOUT_MS = 120000;
const prefix = JSON.parse(process.env.BENCHMARK_SUBJECT_PREFIX || '[]');
const subjectEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('BENCHMARK_') && name !== 'NODE_PATH'));

/**
 * Runs `command args` as the subject, from the workspace unless `options.cwd` says otherwise. In
 * `options.env`, a null value removes that variable.
 */
function spawnSubject(command, args, options = {}) {
  const [executable, ...rest] = [...prefix, command, ...args];
  const env = Object.fromEntries(Object.entries({ ...subjectEnv, ...(options.env || {}) }).filter(([, value]) => value !== null && value !== undefined));
  return spawnSync(executable, rest, { encoding: 'utf8', timeout: SUBJECT_TIMEOUT_MS, ...options, env });
}

/** Exit status of `node --test <file>` run as the subject in `cwd`. */
function runTests(cwd, file) {
  return spawnSubject(process.execPath, ['--test', file], { cwd }).status;
}

/**
 * Runs `body`, the body of an async function, in the subject from the workspace, and returns the JSON
 * value it returns. In the body, `load(file)` requires a workspace file and `args` holds `args`.
 * Throws when the subject throws, ends without answering, or times out.
 */
function observe(body, args = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subject-'));
  const script = path.join(dir, 'subject.cjs');
  const answer = path.join(dir, 'answer.json');
  fs.writeFileSync(
    script,
    [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      'const [answer, raw] = process.argv.slice(2);',
      'const args = JSON.parse(raw);',
      'const load = (file) => require(path.resolve(file));',
      `(async () => {\n${body}\n})().then(`,
      '  (value) => fs.writeFileSync(answer, JSON.stringify({ ok: true, value: value === undefined ? null : value })),',
      '  (error) => fs.writeFileSync(answer, JSON.stringify({ ok: false, error: String((error && error.message) || error) })),',
      ').then(() => process.exit(0));',
    ].join('\n'),
  );
  try {
    const result = spawnSubject(process.execPath, [script, answer, JSON.stringify(args)], { cwd: process.cwd() });
    if (!fs.existsSync(answer)) throw new Error(`the code under test ended without an answer (exit ${result.status}): ${String(result.stderr || '').trim().slice(0, 300)}`);
    const reply = JSON.parse(fs.readFileSync(answer, 'utf8'));
    if (!reply.ok) throw new Error(`the code under test threw: ${reply.error}`);
    return reply.value;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { observe, runTests, spawnSubject };
