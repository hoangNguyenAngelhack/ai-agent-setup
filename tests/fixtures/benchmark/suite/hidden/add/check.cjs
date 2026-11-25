const { add } = require('../src/math.cjs');
process.exit(add(2, 3) === 5 && add(-1, 1) === 0 ? 0 : 1);
