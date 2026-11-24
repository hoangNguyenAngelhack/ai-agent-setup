import { describe, expect, it } from 'vitest';
import { parseArgs, UsageError } from '../../../src/cli/args';

describe('parseArgs', () => {
  it('should treat a leading non-command as the V1 project name', () => {
    const args = parseArgs(['my-app', '-t', 'backend', '-y']);

    expect(args.command).toBe('create');
    expect(args.positionals).toEqual(['my-app']);
    expect(args.values.get('type')).toEqual(['backend']);
    expect(args.switches.has('yes')).toBe(true);
  });

  it('should recognise subcommands, --key=value and comma lists', () => {
    const args = parseArgs(['setup', 'app', '--adapter=claude-code,codex', '--enable-tool', 'tool.mcp-github', '--enable-tool', 'tool.codegraph']);

    expect(args.command).toBe('setup');
    expect(args.positionals).toEqual(['app']);
    expect(args.values.get('adapter')).toEqual(['claude-code', 'codex']);
    expect(args.values.get('enable-tool')).toEqual(['tool.mcp-github', 'tool.codegraph']);
  });

  it('should let --help and --version win over any command', () => {
    expect(parseArgs(['setup', '--help']).command).toBe('help');
    expect(parseArgs(['-v']).command).toBe('version');
  });

  it('should reject unknown options and missing values', () => {
    expect(() => parseArgs(['--nope'])).toThrow(UsageError);
    expect(() => parseArgs(['app', '-t'])).toThrow(/needs a value/);
  });
});
