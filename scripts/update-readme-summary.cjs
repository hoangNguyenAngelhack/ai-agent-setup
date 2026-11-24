#!/usr/bin/env node
// Regenerates the catalog summary block in README.md and README.vi.md from the catalog.
// Usage: npm run docs:summary (builds dist/ first).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { validateCatalog } = require(path.join(root, 'dist', 'registry'));
const { catalogSummary, replaceSummaryBlock } = require(path.join(root, 'dist', 'app', 'catalog-summary'));

const summary = catalogSummary(validateCatalog(path.join(root, 'catalog')));
for (const name of ['README.md', 'README.vi.md']) {
  const file = path.join(root, name);
  fs.writeFileSync(file, replaceSummaryBlock(fs.readFileSync(file, 'utf8'), summary));
  console.log(`updated ${name}`);
}
