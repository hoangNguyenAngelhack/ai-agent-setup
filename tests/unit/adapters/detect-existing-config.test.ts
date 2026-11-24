import { describe, expect, it } from 'vitest';
import { claudeCodeAdapter } from '../../../src/adapters/claude-code';
import { codexAdapter } from '../../../src/adapters/codex';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

describe('Claude Code adapter — existing config detection', () => {
  it('should recognise the V1 layout of this repository', () => {
    const detection = claudeCodeAdapter.detectExistingConfig(REPO_ROOT);

    expect(detection.present).toBe(true);
    expect(detection.v1Fingerprint).toBe(true);
    expect(detection.artifacts).toEqual(
      expect.arrayContaining(['.claude/CLAUDE.md', '.claude/settings.json', '.claude/agents', '.claude/rules']),
    );
  });

  it('should not fingerprint a foreign .claude configuration as V1', () => {
    const detection = claudeCodeAdapter.detectExistingConfig(
      writeTree({ 'CLAUDE.md': '# My project\n', '.claude/settings.json': '{}', '.mcp.json': '{}' }),
    );

    expect(detection).toEqual({
      adapter: 'claude-code',
      present: true,
      artifacts: ['.claude/settings.json', '.mcp.json', 'CLAUDE.md'],
      v1Fingerprint: false,
    });
  });

  it('should require known V1 rule files for the fingerprint, not only the header', () => {
    const detection = claudeCodeAdapter.detectExistingConfig(
      writeTree({ '.claude/CLAUDE.md': '# Claude AI Agent Configuration\n\n## Development Workflow\n' }),
    );

    expect(detection.v1Fingerprint).toBe(false);
  });

  it('should report nothing for a repository without Claude Code config', () => {
    expect(claudeCodeAdapter.detectExistingConfig(writeTree({ 'README.md': '#' }))).toEqual({
      adapter: 'claude-code',
      present: false,
      artifacts: [],
      v1Fingerprint: false,
    });
  });
});

describe('Codex adapter — existing config detection', () => {
  it('should find AGENTS.md and shared Agent Skills in this repository', () => {
    const detection = codexAdapter.detectExistingConfig(REPO_ROOT);

    expect(detection.present).toBe(true);
    expect(detection.artifacts).toEqual(expect.arrayContaining(['.agents/skills', 'AGENTS.md']));
  });

  it('should find project Codex config files', () => {
    const detection = codexAdapter.detectExistingConfig(
      writeTree({ '.codex/config.toml': '', '.codex/hooks.json': '{}', 'AGENTS.override.md': '' }),
    );

    expect(detection.artifacts).toEqual(['.codex/config.toml', '.codex/hooks.json', 'AGENTS.override.md']);
    expect(detection.v1Fingerprint).toBe(false);
  });
});
