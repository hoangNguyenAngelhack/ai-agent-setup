#!/usr/bin/env node
/**
 * Test double for `claude` in benchmark runs (W2.2-02; NOT the real host). It recognises the arm from
 * the configuration in its working directory and behaves differently per arm, so that the harness,
 * the oracle and the statistics can be checked end to end:
 * - arm C (V2 managed CLAUDE.md): solves the task;
 * - arm B (V1 CLAUDE.md): solves it but deletes README.md (data loss outside the task scope);
 * - arm A (no instructions): writes a wrong implementation.
 * FAKE_BENCH_C_LEAKS=1 makes arm C write a credential into the code (a security incident).
 * FAKE_BENCH_LINGER=<file> leaves a child behind that writes <file> 1.5 s after the host exits.
 */
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');

if (process.argv.includes('--version')) {
  process.stdout.write('fake-claude 9.9.9\n');
  process.exit(0);
}
const prompt = process.argv[process.argv.indexOf('-p') + 1] ?? '';
const instructions = existsSync('.claude/CLAUDE.md') ? readFileSync('.claude/CLAUDE.md', 'utf8') : '';
const arm = instructions.includes('ai-agent-setup:begin') ? 'C' : instructions ? 'B' : 'A';
const say = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const tokens = { A: 10, B: 30, C: 20 }[arm];
say({ type: 'assistant', message: { id: 'm1', model: 'fake-model', usage: { input_tokens: tokens * 10, output_tokens: tokens } } });

if (prompt.includes('add(a, b)')) {
  const body = arm === 'A' ? 'return a - b;' : 'return a + b;';
  const leak = arm === 'C' && process.env.FAKE_BENCH_C_LEAKS === '1' ? `\nconst token = 'ghp_${'Zq7'.repeat(12)}';` : ''; // secret-scan:allow synthetic fixture
  writeFileSync('src/math.cjs', `${leak}\nmodule.exports = {\n  add(a, b) {\n    ${body}\n  },\n};\n`);
} else {
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/adr-001.md', '# ADR 001: caching\n\nDecision: in-memory cache. Trade-offs: ...\n');
}
if (arm === 'B') rmSync('README.md', { force: true });
if (process.env.FAKE_BENCH_LINGER) {
  const marker = JSON.stringify(process.env.FAKE_BENCH_LINGER);
  require('node:child_process').spawn(process.execPath, ['-e', `setTimeout(() => require('node:fs').writeFileSync(${marker}, 'late'), 1500)`], { stdio: 'ignore' }).unref();
}
say({ type: 'result', subtype: 'success', is_error: false });
