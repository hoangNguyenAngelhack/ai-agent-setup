import { statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkContextBudget, measureContext, selectProfileEntries } from '../../../src/core/context';
import { KnowledgeIndex, Registry, validateCatalog, type ProfileEntry } from '../../../src/registry';
import { fixtures, minimalValidEntries, writeCatalog } from '../../helpers/catalog-fixture';
import { REPO_ROOT } from '../../helpers/v1-cli';

const rule = fixtures.rule;
const profile = (overrides: Record<string, unknown> = {}) =>
  fixtures.profile('profile.test', { contextBudget: { codex: 100 }, ...overrides });

function loadFixture(profileOverrides: Record<string, unknown> = {}) {
  const dir = writeCatalog(
    [
      ...minimalValidEntries(),
      rule('rule.always-a', { always: true }),
      rule('rule.always-b', { always: true }),
      rule('rule.scoped', { paths: ['**/*.ts'] }),
      rule('rule.by-capability', { capabilities: ['demo.do-thing'] }),
      rule('rule.draft', { always: true }, { status: 'draft' }),
      fixtures.skill('skill.guide', { body: 'skill.guide.md', resources: ['refs/guide-ref.md'] }),
      profile(profileOverrides),
    ],
    {
      'rules/rule.always-a.md': 'a'.repeat(40),
      'rules/rule.always-b.md': 'b'.repeat(50),
      'rules/rule.scoped.md': 's'.repeat(30),
      'rules/rule.by-capability.md': 'c'.repeat(20),
      'rules/rule.draft.md': 'd'.repeat(999),
      'skills/skill.guide.md': 'g'.repeat(70),
      'skills/refs/guide-ref.md': 'r'.repeat(15),
    },
  );
  const report = validateCatalog(dir);
  expect(report.diagnostics).toEqual([]);
  const registry = new Registry(report.entries);
  return {
    registry,
    knowledge: new KnowledgeIndex(report.loaded),
    profileEntry: registry.get('profile.test') as ProfileEntry,
  };
}

describe('Context Engine — static tiers (docs/v2/05 §8)', () => {
  it('should assign tiers by rule scope and entry kind and measure real bytes', () => {
    const { registry, knowledge, profileEntry } = loadFixture();

    const report = measureContext(selectProfileEntries(registry, profileEntry), knowledge);

    expect(report.tiers.T0).toEqual({ bytes: 90, items: [{ id: 'rule.always-a', bytes: 40 }, { id: 'rule.always-b', bytes: 50 }] });
    expect(report.tiers.T1).toEqual({ bytes: 30, items: [{ id: 'rule.scoped', bytes: 30 }] });
    expect(report.tiers.T2.items).toEqual(
      expect.arrayContaining([{ id: 'rule.by-capability', bytes: 20 }, { id: 'skill.guide', bytes: 70 }]),
    );
    expect(report.tiers.T3).toEqual({ bytes: 15, items: [{ id: 'skill.guide:refs/guide-ref.md', bytes: 15 }] });
    expect(report.label).toBe('measured');
  });

  it('should leave out entries whose status the profile does not include', () => {
    const { registry, knowledge, profileEntry } = loadFixture();

    const report = measureContext(selectProfileEntries(registry, profileEntry), knowledge);

    expect(report.tiers.T0.items.map((item) => item.id)).not.toContain('rule.draft');
  });

  it('should leave out entries the profile excludes', () => {
    const { registry, knowledge, profileEntry } = loadFixture({ excludes: { ids: ['rule.always-b'] } });

    const report = measureContext(selectProfileEntries(registry, profileEntry), knowledge);

    expect(report.tiers.T0.bytes).toBe(40);
  });

  it('should flag T0 over the adapter budget', () => {
    const { registry, knowledge, profileEntry } = loadFixture();
    const report = measureContext(selectProfileEntries(registry, profileEntry), knowledge);

    expect(checkContextBudget(report, profileEntry, 'codex')).toEqual({ adapter: 'codex', t0Bytes: 90, budget: 100, withinBudget: true });
    expect(checkContextBudget(report, { ...profileEntry, contextBudget: { codex: 80 } }, 'codex').withinBudget).toBe(false);
  });

  it('should report an unknown budget as null rather than guessing', () => {
    const { registry, knowledge, profileEntry } = loadFixture();
    const report = measureContext(selectProfileEntries(registry, profileEntry), knowledge);

    expect(checkContextBudget(report, profileEntry, 'claude-code')).toEqual({
      adapter: 'claude-code',
      t0Bytes: 90,
      budget: null,
      withinBudget: null,
    });
  });
});

describe('Context Engine — bundled catalog, standard profile', () => {
  const report = validateCatalog(join(REPO_ROOT, 'catalog'));
  const registry = new Registry(report.entries);
  const standard = registry.get('profile.standard') as ProfileEntry;
  const context = measureContext(selectProfileEntries(registry, standard), new KnowledgeIndex(report.loaded));
  const ruleBytes = (name: string) => statSync(join(REPO_ROOT, 'catalog', 'rules', `rule.${name}.md`)).size;

  it('should load only the always-scoped rules at T0, without the opt-in honesty rule (V1 parity)', () => {
    expect(context.tiers.T0.items.map((item) => item.id).sort()).toEqual([
      'rule.clean-code',
      'rule.code-style',
      'rule.error-handling',
      'rule.git-workflow',
      'rule.security',
    ]);
    expect(context.tiers.T0.bytes).toBe(
      ['clean-code', 'code-style', 'error-handling', 'git-workflow', 'security'].reduce((sum, name) => sum + ruleBytes(name), 0),
    );
  });

  it('should keep T0 within the Codex budget', () => {
    expect(checkContextBudget(context, standard, 'codex').withinBudget).toBe(true);
  });

  it('should load less T0 rule content than V1 loads from .claude/rules', () => {
    const v1Bytes = validateCatalog(join(REPO_ROOT, 'catalog'))
      .loaded.filter((item) => item.entry.kind === 'Rule')
      .reduce((sum, item) => sum + statSync(item.file.replace(/\.yaml$/, '.md')).size, 0);

    expect(context.tiers.T0.bytes).toBeLessThan(v1Bytes);
  });
});
