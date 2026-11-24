import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCatalog } from '../../../src/registry';
import { fixtures, minimalValidEntries, writeCatalog } from '../../helpers/catalog-fixture';

function errorCodes(catalogDir: string): string[] {
  return validateCatalog(catalogDir)
    .diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => diagnostic.code);
}

describe('validateCatalog', () => {
  it('should accept a minimal valid catalog', () => {
    const report = validateCatalog(writeCatalog(minimalValidEntries()));

    expect(report.diagnostics).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.entries.map((entry) => entry.id).sort()).toEqual([
      'agent.worker',
      'demo',
      'demo.do-thing',
    ]);
  });

  it('should report schema violations when a required envelope field is missing', () => {
    const [domain, ...rest] = minimalValidEntries();
    const { description: _removed, ...domainWithoutDescription } = domain!;

    const codes = errorCodes(writeCatalog([{ ...domainWithoutDescription, kind: 'Domain', id: 'demo' }, ...rest]));

    expect(codes).toContain('E_SCHEMA');
  });

  it('should reject unknown properties so typos do not pass silently', () => {
    const entries = minimalValidEntries();
    entries[0] = { ...entries[0]!, capabilitiez: [] };

    expect(errorCodes(writeCatalog(entries))).toContain('E_SCHEMA');
  });

  it('should report YAML parse errors with the file path', () => {
    const dir = writeCatalog(minimalValidEntries(), { 'skills/skill.broken.yaml': 'id: [unclosed' });

    const report = validateCatalog(dir);

    const parseError = report.diagnostics.find((diagnostic) => diagnostic.code === 'E_PARSE');
    expect(parseError?.file).toContain('skill.broken.yaml');
  });

  it('should report duplicate ids', () => {
    const dir = writeCatalog(minimalValidEntries());
    writeFileSync(
      join(dir, 'agents', 'agent.copy.yaml'),
      JSON.stringify(fixtures.agent('agent.worker', ['demo.do-thing'])),
    );

    const codes = errorCodes(dir);

    expect(codes).toContain('E_DUPLICATE_ID');
  });

  it('should require the file name to equal the entry id', () => {
    const dir = writeCatalog(minimalValidEntries());
    renameSync(join(dir, 'agents', 'agent.worker.yaml'), join(dir, 'agents', 'worker.yaml'));

    expect(errorCodes(dir)).toContain('E_FILENAME_MISMATCH');
  });

  it('should require the entry kind to match its directory', () => {
    const dir = writeCatalog(minimalValidEntries());
    renameSync(join(dir, 'agents'), join(dir, 'skills'));

    expect(errorCodes(dir)).toContain('E_KIND_DIR_MISMATCH');
  });

  it('should report unresolved references', () => {
    const entries = minimalValidEntries();
    entries[1] = fixtures.capability('demo.do-thing', 'demo', {
      defaultAgents: ['agent.worker'],
      skills: ['skill.missing'],
    });

    expect(errorCodes(writeCatalog(entries))).toContain('E_UNRESOLVED_REF');
  });

  it('should report references that resolve to the wrong kind', () => {
    const entries = minimalValidEntries();
    entries[1] = fixtures.capability('demo.do-thing', 'demo', {
      defaultAgents: ['agent.worker'],
      skills: ['agent.worker'],
    });

    expect(errorCodes(writeCatalog(entries))).toContain('E_REF_KIND');
  });

  it('should report dependency cycles', () => {
    const entries = [
      ...minimalValidEntries(),
      fixtures.skill('skill.a', { dependencies: ['skill.b'] }),
      fixtures.skill('skill.b', { dependencies: ['skill.a'] }),
    ];

    expect(errorCodes(writeCatalog(entries))).toContain('E_DEPENDENCY_CYCLE');
  });

  it('should require domains and capabilities to agree on membership', () => {
    const entries = [
      ...minimalValidEntries(),
      fixtures.capability('demo.orphan', 'demo'),
    ];

    expect(errorCodes(writeCatalog(entries))).toContain('E_DOMAIN_MEMBERSHIP');
  });

  it('should require a capability category to equal its domain', () => {
    const entries = minimalValidEntries();
    entries[1] = { ...entries[1]!, category: 'other' };

    expect(errorCodes(writeCatalog(entries))).toContain('E_CATEGORY_MISMATCH');
  });

  it('should require a default agent to declare the capability', () => {
    const entries = minimalValidEntries();
    entries[2] = fixtures.agent('agent.worker', []);

    expect(errorCodes(writeCatalog(entries))).toContain('E_AGENT_CAPABILITY_MISMATCH');
  });

  it('should require stable entries to define validation criteria', () => {
    const entries = [...minimalValidEntries(), fixtures.skill('skill.solid', { status: 'stable' })];

    expect(errorCodes(writeCatalog(entries))).toContain('E_STABLE_NO_VALIDATION');
  });

  it('should require a reason when a stable entry is unsupported on an adapter', () => {
    const entries = [
      ...minimalValidEntries(),
      fixtures.skill('skill.solid', {
        status: 'stable',
        validation: { gates: ['gate.unit-tests'] },
        supportedAdapters: { 'claude-code': 'native', codex: 'unsupported' },
      }),
    ];

    expect(errorCodes(writeCatalog(entries))).toContain('E_UNSUPPORTED_NO_REASON');
  });

  it('should require deprecation details on deprecated entries', () => {
    const entries = [...minimalValidEntries(), fixtures.skill('skill.old', { status: 'deprecated' })];

    expect(errorCodes(writeCatalog(entries))).toContain('E_DEPRECATION_INFO');
  });

  it('should report a body file that does not exist', () => {
    const entries = [...minimalValidEntries(), fixtures.skill('skill.text', { body: 'skill.text.md' })];

    expect(errorCodes(writeCatalog(entries))).toContain('E_BODY_MISSING');
  });

  it('should accept a body file that exists next to the entry', () => {
    const entries = [...minimalValidEntries(), fixtures.skill('skill.text', { body: 'skill.text.md' })];

    const dir = writeCatalog(entries, { 'skills/skill.text.md': '# Skill\n' });

    expect(errorCodes(dir)).toEqual([]);
  });

  it('should reject an alias that points to another alias', () => {
    const entries = [
      ...minimalValidEntries(),
      fixtures.agent('agent.legacy', [], { aliasOf: 'agent.worker' }),
      fixtures.agent('agent.older', [], { aliasOf: 'agent.legacy' }),
    ];

    expect(errorCodes(writeCatalog(entries))).toContain('E_ALIAS_CHAIN');
  });

  it('should accept an alias that points to a canonical agent', () => {
    const entries = [...minimalValidEntries(), fixtures.agent('agent.legacy', [], { aliasOf: 'agent.worker' })];

    expect(errorCodes(writeCatalog(entries))).toEqual([]);
  });

  describe('policies', () => {
    const safety = [
      'schema: policy/v1',
      'id: policy.safety',
      'layer: mandatory',
      'description: Fixture mandatory policy.',
      'rules:',
      '  - id: safety.fixture',
      '    description: Fixture rule for tests.',
      '    effect: ask',
      '    match:',
      '      commands: ["rm * -rf *"]',
      '',
    ].join('\n');

    it('should load a valid mandatory policy', () => {
      const report = validateCatalog(writeCatalog(minimalValidEntries(), { 'policies/policy.safety.yaml': safety }));

      expect(report.diagnostics).toEqual([]);
      expect(report.policies.map((policy) => policy.id)).toEqual(['policy.safety']);
    });

    it('should require exactly one mandatory policy', () => {
      const dir = writeCatalog(minimalValidEntries());
      rmSync(join(dir, 'policies', 'policy.safety.yaml'));

      expect(errorCodes(dir)).toContain('E_POLICY_MANDATORY');
    });

    it('should reject regular expressions that do not compile', () => {
      const broken = safety.replace('commands: ["rm * -rf *"]', 'commandRegex: ["(unclosed"]');

      expect(errorCodes(writeCatalog(minimalValidEntries(), { 'policies/policy.safety.yaml': broken }))).toContain(
        'E_POLICY_REGEX',
      );
    });

    it('should reject organization or user layers inside the bundled catalog', () => {
      const userLayer = safety.replace('id: policy.safety', 'id: policy.mine').replace('layer: mandatory', 'layer: user');
      const dir = writeCatalog(minimalValidEntries(), {
        'policies/policy.safety.yaml': safety,
        'policies/policy.mine.yaml': userLayer,
      });

      expect(errorCodes(dir)).toContain('E_POLICY_LAYER');
    });

    it('should resolve the policy referenced by a profile', () => {
      const profileEntry = fixtures.profile('profile.fixture', { policy: 'policy.missing' });
      const dir = writeCatalog([...minimalValidEntries(), profileEntry], { 'policies/policy.safety.yaml': safety });

      expect(errorCodes(dir)).toContain('E_UNRESOLVED_REF');
    });
  });

  it('should reject a declared depth level that the catalog does not support', () => {
    const entries = minimalValidEntries();
    entries[0] = fixtures.domain('demo', ['demo.do-thing'], { depthLevel: 'L1' });

    expect(errorCodes(writeCatalog(entries))).toContain('E_DEPTH_OVERSTATED');
  });

  it('should accept L1 when a stable skill guides one of the domain capabilities', () => {
    const entries = [
      fixtures.domain('demo', ['demo.do-thing'], { depthLevel: 'L1' }),
      fixtures.capability('demo.do-thing', 'demo', {
        defaultAgents: ['agent.worker'],
        skills: ['skill.guide'],
      }),
      fixtures.agent('agent.worker', ['demo.do-thing']),
      fixtures.skill('skill.guide', { status: 'stable', validation: { gates: [], reviewChecklist: 'skill.guide#checklist' } }),
    ];

    expect(errorCodes(writeCatalog(entries))).toEqual([]);
  });
});
