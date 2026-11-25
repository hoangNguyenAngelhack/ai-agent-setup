// Security regression check for Python fixtures: no code evaluation, shell commands or unsafe
// deserialisation. The fixtures contain none, so any finding was introduced by the change.
const { scan } = require('./scan.cjs');

scan(
  [
    ['eval/exec', /(^|[^.\w])(eval|exec)\s*\(/m],
    ['os.system', /\bos\.(system|popen)\s*\(/],
    ['subprocess', /\bsubprocess\b/],
    ['shell=True', /shell\s*=\s*True/],
    ['pickle', /\bpickle\.loads?\s*\(/],
    ['yaml.load', /\byaml\.load\s*\(/],
  ],
  ['.py'],
  ['etl'],
);
