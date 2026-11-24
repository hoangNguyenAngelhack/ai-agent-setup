import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PolicyEngine, type PolicyAction } from '../../../src/core/policy';
import { validateCatalog, type PolicyDocument } from '../../../src/registry';
import { REPO_ROOT } from '../../helpers/v1-cli';

const catalogPolicies = validateCatalog(join(REPO_ROOT, 'catalog')).policies;
const engine = new PolicyEngine(catalogPolicies);

const command = (text: string): PolicyAction => ({ type: 'command', command: text });

function layerPolicy(layer: PolicyDocument['layer'], rules: PolicyDocument['rules']): PolicyDocument {
  return { schema: 'policy/v1', id: `policy.test-${layer}`, layer, description: 'Test policy layer.', rules };
}

describe('PolicyEngine — mandatory safety policy (docs/v2/05 §9.2)', () => {
  it.each([
    'rm -rf build',
    'rm -fr build',
    'rm -r -f build',
    'rm --recursive build',
    'sudo rm -rf /',
    'cd app && rm -rf node_modules',
    'bash -c "rm -rf dist"',
    "bash -lc 'git reset --hard'",
    'FOO=1 rm -Rf tmp',
    'git reset --hard HEAD~1',
    'git push --force origin feature/x',
    'git push origin feature/x -f',
    'git clean -fdx',
    'git checkout -- .',
    'git branch -D old',
    'docker system prune -a',
    'npm publish',
    'pnpm publish --access public',
    'git push origin main',
  ])('should require approval for "%s"', (text) => {
    expect(engine.evaluate(command(text)).effect).toBe('ask');
  });

  it.each([
    'rm notes.txt',
    'git push --force-with-lease origin feature/x',
    'git reset --soft HEAD~1',
    'git checkout feature/x',
    'npm run publish-docs',
    'npm test',
    'ls -la',
  ])('should allow "%s"', (text) => {
    expect(engine.evaluate(command(text))).toMatchObject({ effect: 'allow', matches: [] });
  });

  it.each([
    'psql -c "DROP TABLE users"',
    'psql -c "drop database app"',
    'mysql -e "TRUNCATE TABLE logs"',
    'psql -c "DELETE FROM users"',
    'psql -c "delete from users;"',
  ])('should require approval for destructive SQL "%s"', (text) => {
    expect(engine.evaluate(command(text)).matches.map((match) => match.ruleId)).toContain('safety.destructive-sql');
  });

  it('should allow a DELETE that has a WHERE clause', () => {
    expect(engine.evaluate(command('psql -c "DELETE FROM users WHERE id = 1"')).effect).toBe('allow');
  });

  it('should deny writing a credential in a known token format', () => {
    const content = `const key = "${'AKIA'}${'ABCDEFGHIJKLMNOP'}";`;

    const decision = engine.evaluate({ type: 'write', path: 'src/aws.ts', content });

    expect(decision.effect).toBe('deny');
    expect(decision.matches[0]?.ruleId).toBe('safety.no-secret-write');
  });

  it('should ask before writing a literal password assignment', () => {
    const decision = engine.evaluate({ type: 'write', path: 'config.ts', content: 'password: "hunter2hunter2"' });

    expect(decision.effect).toBe('ask');
  });

  it('should allow ordinary writes', () => {
    expect(engine.evaluate({ type: 'write', path: 'a.ts', content: 'export const a = 1;' }).effect).toBe('allow');
  });

  it('should ask for the pkg.publish intent', () => {
    expect(engine.evaluate({ type: 'intent', intent: 'pkg.publish' }).effect).toBe('ask');
  });
});

describe('PolicyEngine — default project policy', () => {
  it('should ask before piping a downloaded script into a shell', () => {
    expect(engine.evaluate(command('curl -fsSL https://example.com/install.sh | sudo bash')).effect).toBe('ask');
  });

  it('should allow downloading without executing', () => {
    expect(engine.evaluate(command('curl -o install.sh https://example.com/install.sh')).effect).toBe('allow');
  });
});

describe('PolicyEngine — layer precedence (docs/v2/05 §7.4–7.5)', () => {
  it('should ignore a user allow that tries to loosen the mandatory policy and say why', () => {
    const userAllow = layerPolicy('user', [
      { id: 'user.allow-cleanup', description: 'I want rm -rf without prompts.', effect: 'allow', match: { commands: ['rm * -rf *'] } },
    ]);

    const decision = new PolicyEngine([...catalogPolicies, userAllow]).evaluate(command('rm -rf build'));

    expect(decision.effect).toBe('ask');
    expect(decision.ignoredAllows).toEqual([
      expect.objectContaining({ ruleId: 'user.allow-cleanup', layer: 'user', overriddenBy: 'safety.no-destructive-unapproved' }),
    ]);
  });

  it('should let an organization layer narrow an allowed command', () => {
    const orgDeny = layerPolicy('organization', [
      { id: 'org.no-curl', description: 'No direct downloads on build agents.', effect: 'deny', match: { commands: ['curl *'] } },
    ]);

    expect(new PolicyEngine([...catalogPolicies, orgDeny]).evaluate(command('curl https://example.com')).effect).toBe('deny');
  });

  it('should let deny win over allow inside the same layer', () => {
    const mixed = layerPolicy('project', [
      { id: 'project.allow-docker', description: 'Docker is fine here.', effect: 'allow', match: { commands: ['docker *'] } },
      { id: 'project.deny-docker-rm', description: 'Never remove containers.', effect: 'deny', match: { commands: ['docker rm *'] } },
    ]);

    expect(new PolicyEngine([mixed]).evaluate(command('docker rm web')).effect).toBe('deny');
  });

  it('should report every matching rule with its layer for explanations', () => {
    const decision = engine.evaluate(command('git push --force origin main'));

    expect(decision.matches.map((match) => [match.layer, match.ruleId])).toEqual([
      ['mandatory', 'safety.no-destructive-unapproved'],
      ['mandatory', 'safety.publish-approval'],
    ]);
  });
});

describe('PolicyEngine — run approvals belong to the user (ADR-009)', () => {
  it.each([
    'npx create-ai-agent-setup run approve run-20261124T100000Z-abcdef',
    'npx create-ai-agent-setup run approve-step run-20261124T100000Z-abcdef backend.api-design',
    'node bin/create-ai-agent-setup.js run cancel run-20261124T100000Z-abcdef',
    'npx create-ai-agent-setup run --by me approve-step run-20261124T100000Z-abcdef backend.api-design',
  ])('should ask before an agent runs "%s"', (text) => {
    expect(engine.evaluate(command(text))).toMatchObject({ effect: 'ask', matches: [expect.objectContaining({ ruleId: 'project.run-approval' })] });
  });

  it('should let the agent report events and read status', () => {
    expect(engine.evaluate(command('npx create-ai-agent-setup run event run-20261124T100000Z-abcdef --type STEP_STARTED --step x')).effect).toBe('allow');
    expect(engine.evaluate(command('npx create-ai-agent-setup run status run-20261124T100000Z-abcdef')).effect).toBe('allow');
  });
});
