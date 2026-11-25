const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
// The toolkit's YAML parser (the oracle sets NODE_PATH for checks; the code under test does not get it).
const YAML = require('yaml');

const root = process.cwd();
const dir = path.join(root, '.github', 'workflows');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)) : [];
assert.ok(files.length, 'no workflow file');
const workflows = files.map((name) => {
  const document = YAML.parseDocument(fs.readFileSync(path.join(dir, name), 'utf8'));
  assert.deepStrictEqual(document.errors.map((error) => error.message), [], `${name} is not valid YAML`);
  return document.toJS();
});

const events = (on) => (typeof on === 'string' ? [on] : Array.isArray(on) ? on : Object.keys(on || {}));
const triggers = new Set(workflows.flatMap((workflow) => events(workflow.on)));
assert.ok(triggers.has('push'), 'not run on push');
assert.ok(triggers.has('pull_request'), 'not run on pull requests');

const jobs = workflows.flatMap((workflow) => Object.values(workflow.jobs || {}));
const steps = jobs.flatMap((job) => (job.steps || []).map((step) => ({ job, step })));
/** A value, or the matrix values it names (`${{ matrix.node }}`). */
const values = (job, value) => {
  const name = /^\$\{\{\s*matrix\.([\w-]+)\s*\}\}$/.exec(String(value).trim())?.[1];
  const listed = name ? job.strategy?.matrix?.[name] : value;
  return (Array.isArray(listed) ? listed : [listed]).map(String);
};
const setups = steps.filter(({ step }) => typeof step.uses === 'string' && step.uses.startsWith('actions/setup-node@'));
assert.ok(setups.length, 'no actions/setup-node step');
assert.ok(setups.some(({ job, step }) => values(job, step.with?.['node-version']).some((version) => /^20(\.|$|\.x)/.test(version))), 'Node 20 is not set up');
const commands = steps.map(({ step }) => String(step.run || '')).join('\n');
assert.match(commands, /\bnpm (ci|install)\b/, 'dependencies are not installed');
assert.match(commands, /\bnpm (run )?test\b/, 'tests are not run');
