import { cpSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSetup } from '../../src/app/setup';
import { writeTree } from '../helpers/fs-tree';
import { REPO_ROOT } from '../helpers/v1-cli';

/** docs/v2/16: `setup` installs the language packs of the languages it detects, and only those. */
const DIST = join(REPO_ROOT, 'dist');
const exists = (root: string, path: string) => existsSync(join(root, path));

describe('language packs through setup (docs/v2/16)', () => {
  it('should give a Go service its Go rule and build skill, not the Node or Rust ones', () => {
    const root = writeTree({ 'go.mod': 'module example.com/svc\n\ngo 1.22\n', 'main.go': 'package main\n' });
    runSetup({ root, adapters: ['claude-code', 'codex'], distDir: DIST });

    for (const path of ['.claude/rules/go-patterns.md', '.claude/skills/build-resolve-go/SKILL.md', '.agents/skills/go-patterns/SKILL.md']) expect(exists(root, path), path).toBe(true);
    for (const path of ['.claude/skills/build-resolve-node/SKILL.md', '.claude/rules/rust-patterns.md', '.claude/rules/typescript-patterns.md', '.agents/skills/build-resolve-node/SKILL.md']) expect(exists(root, path), path).toBe(false);
  }, 60000);

  it('should leave a Node project with the Node packs and none of the other languages', () => {
    const root = mkdtempSync(join(tmpdir(), 'language-packs-'));
    cpSync(join(REPO_ROOT, 'templates', 'backend'), root, { recursive: true });
    runSetup({ root, distDir: DIST });

    for (const path of ['.claude/skills/build-resolve-node/SKILL.md', '.claude/rules/typescript-patterns.md']) expect(exists(root, path), path).toBe(true);
    for (const path of ['.claude/rules/go-patterns.md', '.claude/rules/php-patterns.md', '.claude/skills/build-resolve-ruby/SKILL.md']) expect(exists(root, path), path).toBe(false);
  }, 60000);

  it('should give a polyglot repository the packs of every language it uses', () => {
    const root = writeTree({ 'services/api/go.mod': 'module api\n', 'apps/web/package.json': '{"name":"web","dependencies":{"react":"18"}}', 'apps/web/tsconfig.json': '{}' });
    runSetup({ root, distDir: DIST });

    for (const path of ['.claude/rules/go-patterns.md', '.claude/rules/typescript-patterns.md', '.claude/skills/build-resolve-node/SKILL.md']) expect(exists(root, path), path).toBe(true);
    expect(exists(root, '.claude/rules/ruby-patterns.md')).toBe(false);
  }, 60000);
});
