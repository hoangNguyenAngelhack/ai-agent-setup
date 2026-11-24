#!/usr/bin/env node
/**
 * Test double for the `claude` / `codex` CLIs (W2.0-15 harness; NOT the real hosts). It follows the
 * delivery prompt the way an agent would: reads the plan file it names, reports step events with the
 * event command it gives, and prints the host's native end-of-turn event. FAKE_HOST_MODE picks a
 * scenario.
 */
const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { basename } = require('node:path');

const host = basename(process.argv[1]).replace(/\.cjs$/, '');
const prompt = process.argv.find((arg) => arg.startsWith('Execute run')) ?? '';
const planPath = /Read (\S+execution-plan\.json)\./.exec(prompt)?.[1];
const eventCommand = /Report the start: (.+) --type STEP_STARTED/.exec(prompt)?.[1];
if (!planPath || !eventCommand) {
  process.stderr.write('fake host: prompt does not follow the delivery protocol\n');
  process.exit(3);
}
const steps = JSON.parse(readFileSync(planPath, 'utf8')).steps.map((step) => step.id);
const mode = process.env.FAKE_HOST_MODE ?? 'success';
const say = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const report = (args) => execSync(`${eventCommand} ${args}`, { stdio: 'ignore' });
const start = () => say(host === 'claude' ? { type: 'system', subtype: 'init', session_id: 'fake' } : { type: 'thread.started', thread_id: 'fake' });
const done = () => say(host === 'claude' ? { type: 'result', subtype: 'success', is_error: false } : { type: 'turn.completed' });
const failed = (message) => say(host === 'claude' ? { type: 'result', subtype: 'error_during_execution', is_error: true } : { type: 'turn.failed', error: { message } });

if (mode === 'silent') process.exit(0);
start();
switch (mode) {
  case 'success':
    for (const step of steps) {
      report(`--type STEP_STARTED --step ${step}`);
      report(`--type STEP_COMPLETED --step ${step} --evidence notes/${step}.md`);
    }
    done();
    break;
  case 'order-violation':
    report(`--type STEP_STARTED --step ${steps[1]}`);
    report(`--type STEP_STARTED --step ${steps[0]}`);
    report(`--type STEP_COMPLETED --step ${steps[0]}`);
    report(`--type STEP_COMPLETED --step ${steps[1]}`);
    done();
    break;
  case 'fail-first':
    report(`--type STEP_STARTED --step ${steps[0]}`);
    report(`--type STEP_FAILED --step ${steps[0]} --reason "unit tests fail"`);
    failed('the first step failed');
    break;
  case 'approval':
    report(`--type STEP_STARTED --step ${steps[0]}`);
    report(`--type APPROVAL_REQUIRED --step ${steps[0]} --reason "needs a database migration"`);
    done();
    break;
  case 'leak':
    // A synthetic credential in the host's own output: the stored transcript must not keep it.
    say({ type: 'item.completed', item: { text: `export GITHUB_TOKEN=ghp_${'Zq7'.repeat(12)}` } }); // secret-scan:allow synthetic fixture
    done();
    break;
  case 'hang':
    report(`--type STEP_STARTED --step ${steps[0]}`);
    setInterval(() => {}, 1000);
    break;
  default:
    process.exit(4);
}
