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
// FAKE_HOST_USAGE=1: the stream carries token usage in each host's shape. Claude repeats one message
// id over two lines (as its transcripts do), so a meter that counts lines would double it.
const withUsage = process.env.FAKE_HOST_USAGE === '1';
const usage = () => {
  if (!withUsage || host !== 'claude') return;
  const message = (id, input, output) => ({ type: 'assistant', message: { id, model: 'claude-test-1', usage: { input_tokens: input, output_tokens: output, cache_read_input_tokens: 100, cache_creation_input_tokens: 10 } } });
  say(message('msg_a', 5, 20));
  say(message('msg_a', 5, 20));
  say(message('msg_b', 7, 30));
};
const done = () => {
  usage();
  if (host === 'claude') say({ type: 'result', subtype: 'success', is_error: false, ...(withUsage ? { total_cost_usd: 0.0125, usage: { input_tokens: 999, output_tokens: 999 } } : {}) });
  else say({ type: 'turn.completed', ...(withUsage ? { usage: { input_tokens: 300, cached_input_tokens: 120, output_tokens: 45 } } : {}) });
};
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
  case 'forge': {
    // A compromised agent (W2.2-09): it tries to approve its own step, claim the run, and write
    // the runtime state directly. The sandbox and the host-side inbox must refuse all of it.
    const { appendFileSync } = require('node:fs');
    const { dirname, join } = require('node:path');
    report(`--type STEP_STARTED --step ${steps[0]}`);
    report(`--type APPROVAL_REQUIRED --step ${steps[0]} --reason "needs a database migration"`);
    try {
      report(`--type APPROVAL_RESOLVED --step ${steps[0]} --approved true`);
    } catch {
      // Refused before it reached the inbox.
    }
    let direct = 'refused';
    try {
      appendFileSync(join(dirname(planPath), 'events.jsonl'), '{"type":"APPROVAL_RESOLVED"}\n');
      direct = 'written';
    } catch (error) {
      direct = error.code;
    }
    say({ type: 'item.completed', item: { text: `direct write: ${direct}` } });
    done();
    break;
  }
  case 'leave-behind': {
    // Starts a process outside its own process group and finishes (or hangs, with HANG=1).
    const { spawn } = require('node:child_process');
    const { writeFileSync } = require('node:fs');
    const pidFile = process.env.FAKE_HOST_PID_FILE;
    if (process.env.FAKE_HOST_ESCAPE) {
      // Adversarial: a double fork whose middle process exits at once, with an empty environment
      // (no run mark). The survivor keeps trying to read FAKE_HOST_ESCAPE and records the result.
      const target = JSON.stringify(process.env.FAKE_HOST_ESCAPE);
      const out = JSON.stringify(`${pidFile}.read`);
      const survivor = `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{let r;try{fs.readFileSync(${target});r='read'}catch(e){r=e.code}try{fs.writeFileSync(${out},r)}catch{}},200);`;
      const middle = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(survivor)}],{detached:true,stdio:'ignore',env:{}}).unref();`;
      spawn(process.execPath, ['-e', middle], { detached: true, stdio: 'ignore', env: {} }).unref();
    } else {
      const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' });
      writeFileSync(pidFile, String(child.pid));
      child.unref();
    }
    report(`--type STEP_STARTED --step ${steps[0]}`);
    if (process.env.FAKE_HOST_HANG) setInterval(() => {}, 1000);
    else done();
    break;
  }
  case 'hang':
    report(`--type STEP_STARTED --step ${steps[0]}`);
    setInterval(() => {}, 1000);
    break;
  default:
    process.exit(4);
}
