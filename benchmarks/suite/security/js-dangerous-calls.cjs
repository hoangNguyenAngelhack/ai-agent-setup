// Security regression check for JavaScript fixtures: no code evaluation, shell access or raw HTML
// injection. The fixtures contain none, so any finding was introduced by the change.
const { scan } = require('./scan.cjs');

scan(
  [
    ['eval', /\beval\s*\(/],
    ['new Function', /\bnew\s+Function\s*\(/],
    ['child_process', /require\(\s*['"](node:)?child_process['"]\s*\)|from\s+['"](node:)?child_process['"]/],
    ['innerHTML assignment', /\.(innerHTML|outerHTML)\s*=/],
    ['document.write', /\bdocument\.write(ln)?\s*\(/],
  ],
  ['.js', '.cjs', '.mjs', '.html'],
  ['src', 'public'],
);
