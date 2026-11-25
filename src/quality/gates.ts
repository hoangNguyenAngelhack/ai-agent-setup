import type { GateCategory } from '../core/contracts';

/**
 * How the engine obtains a result for a gate:
 * - `project-command`: runs the project's own command (known script name, stack default or config);
 * - `built-in`: the engine performs the check itself (secret scan, coverage threshold, audit parse);
 * - `composite`: derived from other gates of the same run.
 */
export type GateSupport = 'project-command' | 'built-in' | 'composite';

/**
 * Stack keys for default commands: a language or build tool, or a tool the project declares (test
 * runner, linter, type checker), so a gate runs only what the project actually uses.
 */
export type Ecosystem = 'node' | 'go' | 'maven' | 'gradle' | 'python' | 'dotnet' | 'rust' | 'rspec' | 'minitest' | 'rubocop' | 'phpunit' | 'pest' | 'phpstan' | 'ruff' | 'mypy';

export interface GateDefinition {
  id: string;
  version: string;
  category: GateCategory;
  title: string;
  support: GateSupport;
  /** package.json scripts tried in order. */
  scripts: string[];
  /** Stack defaults when no script matches. */
  defaults: Partial<Record<Ecosystem, string>>;
  timeoutMs: number;
  /** Built-in check applied after (or instead of) the command. */
  check?: 'secret-scan' | 'coverage' | 'npm-audit';
  threshold?: number;
  /** Composite gates: the gates that must PASS. */
  requires?: string[];
}

const MINUTE = 60_000;

function gate(definition: Omit<GateDefinition, 'version' | 'scripts' | 'defaults' | 'timeoutMs'> & Partial<GateDefinition>): GateDefinition {
  return { version: '1.0.0', scripts: [], defaults: {}, timeoutMs: 10 * MINUTE, ...definition };
}

/** Gate registry (V2.2). Every category has at least one gate with an explicit support status. */
export const GATES: readonly GateDefinition[] = [
  gate({
    id: 'gate.build',
    category: 'build',
    title: 'Build',
    support: 'project-command',
    scripts: ['build'],
    defaults: { go: 'go build ./...', maven: 'mvn -q -DskipTests package', gradle: './gradlew assemble', dotnet: 'dotnet build', rust: 'cargo build' },
  }),
  gate({
    id: 'gate.unit-tests',
    category: 'unit',
    title: 'Unit tests',
    support: 'project-command',
    scripts: ['test:unit', 'test'],
    defaults: { go: 'go test ./...', maven: 'mvn -q test', gradle: './gradlew test', python: 'pytest -q', dotnet: 'dotnet test', rust: 'cargo test', rspec: 'bundle exec rspec', minitest: 'bundle exec rake test', phpunit: 'vendor/bin/phpunit', pest: 'vendor/bin/pest' },
  }),
  gate({ id: 'gate.integration-tests', category: 'integration', title: 'Integration tests', support: 'project-command', scripts: ['test:integration', 'test:int'] }),
  gate({ id: 'gate.e2e-tests', category: 'e2e', title: 'End-to-end tests', support: 'project-command', scripts: ['test:e2e', 'e2e'], timeoutMs: 20 * MINUTE }),
  gate({
    id: 'gate.lint',
    category: 'static-analysis',
    title: 'Lint',
    support: 'project-command',
    scripts: ['lint'],
    defaults: { go: 'go vet ./...', rust: 'cargo clippy -- -D warnings', dotnet: 'dotnet format --verify-no-changes', rubocop: 'bundle exec rubocop', phpstan: 'vendor/bin/phpstan analyse --no-progress', ruff: 'ruff check .' },
  }),
  gate({ id: 'gate.typecheck', category: 'static-analysis', title: 'Type check', support: 'project-command', scripts: ['typecheck', 'type-check', 'tsc'], defaults: { mypy: 'mypy .', rust: 'cargo check' } }),
  gate({ id: 'gate.security-scan', category: 'security', title: 'Secret scan of uncommitted and untracked changes', support: 'built-in', defaults: {}, check: 'secret-scan', timeoutMs: MINUTE }),
  gate({ id: 'gate.dependency-audit', category: 'dependency-audit', title: 'Dependency audit (high and critical)', support: 'built-in', check: 'npm-audit', timeoutMs: 2 * MINUTE }),
  // 1.1.0: every metric (statements, branches, functions, lines) must meet the threshold; 1.0.0 checked lines only.
  gate({ id: 'gate.coverage-80', version: '1.1.0', category: 'unit', title: 'Coverage >= 80% (statements, branches, functions, lines)', support: 'built-in', scripts: ['test:coverage', 'coverage'], check: 'coverage', threshold: 80 }),
  gate({ id: 'gate.coverage-95', version: '1.1.0', category: 'unit', title: 'Coverage >= 95% (statements, branches, functions, lines)', support: 'built-in', scripts: ['test:coverage', 'coverage'], check: 'coverage', threshold: 95 }),
  gate({ id: 'gate.performance', category: 'performance', title: 'Performance budget', support: 'project-command', scripts: ['test:perf', 'perf', 'bench'] }),
  gate({ id: 'gate.accessibility', category: 'accessibility', title: 'Accessibility check', support: 'project-command', scripts: ['test:a11y', 'a11y'] }),
  gate({ id: 'gate.documentation', category: 'documentation', title: 'Documentation check', support: 'project-command', scripts: ['docs:check', 'lint:docs'] }),
  gate({
    id: 'gate.deployment-readiness',
    category: 'deployment-readiness',
    title: 'Deployment readiness',
    support: 'composite',
    requires: ['gate.build', 'gate.unit-tests', 'gate.security-scan'],
    timeoutMs: 0,
  }),
];

export function gateById(id: string): GateDefinition | undefined {
  return GATES.find((definition) => definition.id === id);
}
