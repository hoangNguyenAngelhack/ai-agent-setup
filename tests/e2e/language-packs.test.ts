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

  it('should give mobile and systems projects their platform packs (wave 2)', () => {
    const flutter = writeTree({ 'pubspec.yaml': 'name: shop\ndependencies:\n  flutter:\n    sdk: flutter\n', 'ios/Podfile': "platform :ios, '16.0'", 'android/build.gradle': '', 'lib/main.dart': '' });
    runSetup({ root: flutter, distDir: DIST });
    for (const path of ['.claude/rules/dart-patterns.md', '.claude/skills/build-resolve-flutter/SKILL.md']) expect(exists(flutter, path), path).toBe(true);
    for (const path of ['.claude/rules/swift-patterns.md', '.claude/skills/build-resolve-node/SKILL.md', '.claude/rules/cpp-patterns.md']) expect(exists(flutter, path), path).toBe(false);

    const android = writeTree({ 'settings.gradle.kts': 'include(":app")', 'build.gradle.kts': '', 'app/build.gradle.kts': 'plugins { id("com.android.application") }' });
    runSetup({ root: android, distDir: DIST });
    for (const path of ['.claude/rules/kotlin-patterns.md', '.claude/rules/android-patterns.md', '.claude/skills/build-resolve-android/SKILL.md']) expect(exists(android, path), path).toBe(true);

    const kotlinService = writeTree({ 'build.gradle.kts': 'plugins { kotlin("jvm") }' });
    runSetup({ root: kotlinService, distDir: DIST });
    expect(exists(kotlinService, '.claude/rules/kotlin-patterns.md')).toBe(true);
    expect(exists(kotlinService, '.claude/rules/android-patterns.md')).toBe(false);

    const engine = writeTree({ 'CMakeLists.txt': 'project(engine CXX)\n', 'src/engine.cpp': '' });
    runSetup({ root: engine, distDir: DIST });
    for (const path of ['.claude/rules/cpp-patterns.md', '.claude/skills/build-resolve-cpp/SKILL.md']) expect(exists(engine, path), path).toBe(true);
    expect(exists(engine, '.claude/rules/c-patterns.md')).toBe(false);
  }, 120000);
});
