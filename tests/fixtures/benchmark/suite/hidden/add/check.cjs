// Runs from outside the workspace (the oracle's check directory), with the workspace as cwd.
const { add } = require(require('node:path').resolve('src/math.cjs'));
process.exit(add(2, 3) === 5 && add(-1, 1) === 0 ? 0 : 1);
