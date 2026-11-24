import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SchemaValidator } from '../../src/registry';
import { REPO_ROOT } from '../helpers/v1-cli';

const schemas = new SchemaValidator(join(REPO_ROOT, 'catalog', 'schemas'));
const GATE_RESULT = 'urn:ai-agent-setup:contracts:v1:gate-result';
const MANIFEST = 'urn:ai-agent-setup:contracts:v1:manifest';

const commandEvidence = {
  type: 'command',
  command: 'npm test',
  exitCode: 0,
  startedAt: '2026-11-24T07:00:00Z',
  durationMs: 812,
};

function gateResult(overrides: Record<string, unknown>) {
  return { gate: 'gate.unit-tests', category: 'unit', status: 'PASS', measured: true, evidence: [commandEvidence], reason: null, ...overrides };
}

describe('GateResult contract (ADR-008, docs/v2/05 §12.1)', () => {
  it('should accept PASS backed by an executed command', () => {
    expect(schemas.validate(GATE_RESULT, gateResult({})).valid).toBe(true);
  });

  it('should reject PASS without evidence', () => {
    expect(schemas.validate(GATE_RESULT, gateResult({ evidence: [] })).valid).toBe(false);
  });

  it('should reject PASS backed only by a review note', () => {
    const result = gateResult({ evidence: [{ type: 'review-note', summary: { note: 'looks fine' } }] });

    expect(schemas.validate(GATE_RESULT, result).valid).toBe(false);
  });

  it('should reject PASS that is not measured', () => {
    expect(schemas.validate(GATE_RESULT, gateResult({ measured: false })).valid).toBe(false);
  });

  it('should reject command evidence without an exit code', () => {
    const result = gateResult({ evidence: [{ type: 'command', command: 'npm test' }] });

    expect(schemas.validate(GATE_RESULT, result).valid).toBe(false);
  });

  it('should require a reason for NOT_VERIFIED', () => {
    const withoutReason = gateResult({ status: 'NOT_VERIFIED', measured: false, evidence: [] });
    const withReason = { ...withoutReason, reason: 'npm is not installed' };

    expect(schemas.validate(GATE_RESULT, withoutReason).valid).toBe(false);
    expect(schemas.validate(GATE_RESULT, withReason).valid).toBe(true);
  });

  it('should require a reason for FAIL', () => {
    const failed = gateResult({ status: 'FAIL', evidence: [{ ...commandEvidence, exitCode: 1 }] });

    expect(schemas.validate(GATE_RESULT, failed).valid).toBe(false);
    expect(schemas.validate(GATE_RESULT, { ...failed, reason: '3 tests failed' }).valid).toBe(true);
  });
});

describe('Install manifest contract (docs/v2/05 §11.3)', () => {
  const sha = 'a'.repeat(64);
  const manifest = {
    schema: 'manifest/v1',
    toolkitVersion: '2.0.0',
    catalogDigest: `sha256:${sha}`,
    adapters: {
      'claude-code': { version: '1.0.0', hostCompat: 'verified' },
      codex: { version: '1.0.0', hostCompat: 'unverified', trustRequired: true },
    },
    profile: 'profile.standard',
    files: [{ path: '.claude/skills/tdd/SKILL.md', sha256: sha, source: 'skill.tdd@1.2.0', class: 'managed' }],
    sections: [{ path: 'CLAUDE.md', marker: 'ai-agent-setup:t0', sha256: sha }],
    transactions: [{ id: 'txn-20261124T070000Z', op: 'setup', backup: 'backups/txn-20261124T070000Z' }],
  };

  it('should accept a complete manifest', () => {
    expect(schemas.validate(MANIFEST, manifest)).toEqual({ valid: true, errors: [] });
  });

  it('should reject a malformed catalog digest', () => {
    expect(schemas.validate(MANIFEST, { ...manifest, catalogDigest: 'md5:abc' }).valid).toBe(false);
  });

  it('should reject an unknown file ownership class', () => {
    const files = [{ ...manifest.files[0], class: 'mine' }];

    expect(schemas.validate(MANIFEST, { ...manifest, files }).valid).toBe(false);
  });
});

describe('RunResult contract (ADR-009, docs/v2/05 §12.4)', () => {
  const RUN_RESULT = 'urn:ai-agent-setup:contracts:v1:run-result';
  const dir = join(REPO_ROOT, 'tests', 'contract', 'fixtures', 'run-result');
  const fixtures = readdirSync(dir).filter((name) => name.endsWith('.json'));
  const load = (name: string): unknown => JSON.parse(readFileSync(join(dir, name), 'utf8'));

  it('should have valid fixtures for every run status and invalid ones', () => {
    expect(fixtures.filter((name) => name.startsWith('valid-')).sort()).toEqual(['valid-cancelled.json', 'valid-failed.json', 'valid-not-verified.json', 'valid-outcome-verified.json', 'valid-succeeded.json']);
    expect(fixtures.filter((name) => name.startsWith('invalid-')).length).toBeGreaterThanOrEqual(10);
  });

  it.each(fixtures.filter((name) => name.startsWith('valid-')))('should accept %s', (name) => {
    expect(schemas.validate(RUN_RESULT, load(name))).toEqual({ valid: true, errors: [] });
  });

  it.each(fixtures.filter((name) => name.startsWith('invalid-')))('should reject %s', (name) => {
    expect(schemas.validate(RUN_RESULT, load(name)).valid).toBe(false);
  });
});
