import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HostConfigDetection } from '../../core/contracts';
import type { Adapter } from '../adapter';
import { generateClaudeCode } from './generate';

/** Paths Claude Code reads (verified 2026-11-23, docs/v2/05 §10.2). */
const KNOWN_ARTIFACTS = [
  'CLAUDE.md',
  'CLAUDE.local.md',
  '.claude/CLAUDE.md',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.claude/agents',
  '.claude/skills',
  '.claude/commands',
  '.claude/rules',
  '.claude/hooks',
  '.mcp.json',
];

const V1_HEADER = '# Claude AI Agent Configuration';
const V1_WORKFLOW_HEADING = '## Development Workflow';
const V1_RULE_FILES = ['clean-code.md', 'code-style.md', 'error-handling.md', 'tech-stack.md', 'system-design.md', 'api-conventions.md', 'naming-conventions.md', 'database.md'];
const MIN_V1_RULE_FILES = 3;

function readOrEmpty(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/** V1 fingerprint (docs/v2/07 §4.1): the V1 CLAUDE.md header and workflow, plus ≥ 3 known V1 rule files. */
function hasV1Fingerprint(root: string): boolean {
  const claudeMd = readOrEmpty(join(root, '.claude', 'CLAUDE.md'));
  if (!claudeMd.startsWith(V1_HEADER) || !claudeMd.includes(V1_WORKFLOW_HEADING)) return false;
  const ruleCount = V1_RULE_FILES.filter((file) => existsSync(join(root, '.claude', 'rules', file))).length;
  return ruleCount >= MIN_V1_RULE_FILES;
}

export const claudeCodeAdapter: Adapter = {
  id: 'claude-code',
  version: '0.1.0',
  generate: generateClaudeCode,
  detectExistingConfig(root: string): HostConfigDetection {
    const artifacts = KNOWN_ARTIFACTS.filter((path) => existsSync(join(root, path))).sort();
    return { adapter: 'claude-code', present: artifacts.length > 0, artifacts, v1Fingerprint: hasV1Fingerprint(root) };
  },
};
