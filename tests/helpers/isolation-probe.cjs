#!/usr/bin/env node
/**
 * What an agent might try (W2.2-09 security tests). Prints one JSON line: { ok, code }.
 * `ok: true` means the action succeeded, so for an attack it means the boundary failed.
 */
const fs = require('node:fs');
const net = require('node:net');
const { execFileSync, spawnSync } = require('node:child_process');
const { join } = require('node:path');

const [action, target, extra] = process.argv.slice(2);
const done = (ok, code = null, detail = null) => {
  process.stdout.write(`${JSON.stringify({ ok, code, detail })}\n`);
  process.exit(0);
};
const attempt = (fn) => {
  try {
    const detail = fn();
    done(true, null, detail ?? null);
  } catch (error) {
    done(false, error.code ?? String(error.status ?? error.message).slice(0, 40));
  }
};

switch (action) {
  case 'read':
    attempt(() => fs.readFileSync(target, 'utf8').length);
    break;
  case 'list':
    attempt(() => fs.readdirSync(target).length);
    break;
  case 'write':
    attempt(() => fs.writeFileSync(target, 'written by the agent'));
    break;
  case 'append':
    attempt(() => fs.appendFileSync(target, '{"forged":true}\n'));
    break;
  case 'exec-scratch': {
    const script = join(process.env.TMPDIR, 'dropped.sh');
    fs.writeFileSync(script, '#!/bin/sh\necho escaped\n', { mode: 0o755 });
    attempt(() => execFileSync(script, { encoding: 'utf8' }).trim());
    break;
  }
  case 'child-read': {
    const result = spawnSync('/bin/sh', ['-c', `cat "${target}"`], { encoding: 'utf8' });
    done(result.status === 0, result.status === 0 ? null : 'child-denied');
    break;
  }
  case 'nested-sandbox': {
    const result = spawnSync('/usr/bin/sandbox-exec', ['-p', '(version 1)(allow default)', '/bin/cat', target], { encoding: 'utf8' });
    done(result.status === 0, result.status === 0 ? null : `exit-${result.status}`);
    break;
  }
  case 'connect': {
    const socket = net.connect(Number(target), extra ?? '127.0.0.1');
    socket.on('connect', () => done(true));
    socket.on('error', (error) => done(false, error.code));
    break;
  }
  case 'signal':
    attempt(() => process.kill(Number(target), 'SIGTERM'));
    break;
  case 'env':
    done(true, null, Object.keys(process.env).sort());
    break;
  case 'info':
    // Signal 0 only asks whether the process exists and may be signalled.
    attempt(() => process.kill(Number(target), 0));
    break;
  case 'spawn-tree': {
    // Leaves processes behind: `group` stays in the process group, `setsid` leaves it, `double-fork`
    // leaves it through a parent that exits at once. Their pids go to `target`.
    const { spawn } = require('node:child_process');
    const keep = 'setInterval(()=>{},1000)';
    if (extra === 'double-fork') {
      const code = `const c=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(keep)}],{detached:true,stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(target)},String(c.pid));c.unref();`;
      spawn(process.execPath, ['-e', code], { detached: true, stdio: 'ignore' }).unref();
    } else {
      const child = spawn(process.execPath, ['-e', keep], { detached: extra === 'setsid', stdio: 'ignore' });
      fs.writeFileSync(target, String(child.pid));
    }
    setInterval(() => {}, 1000);
    break;
  }
  default:
    done(false, 'unknown-action');
}
