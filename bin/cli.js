#!/usr/bin/env node
'use strict';

// Thin launcher (docs/v2/06 §5). The V1 implementation is preserved in git history (commit 51bfc3a)
// and frozen by tests/characterization; V2 lives in src/ and is compiled to dist/.
const fs = require('fs');
const path = require('path');

const entry = path.join(__dirname, '..', 'dist', 'cli', 'main.js');
if (!fs.existsSync(entry)) {
  console.error('create-ai-agent-setup: build output not found (dist/). Run `npm run build` in the package directory.');
  process.exit(1);
}
require(entry).run(process.argv.slice(2));
