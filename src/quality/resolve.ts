import type { Ecosystem, GateDefinition } from './gates';

/** What the engine needs to know about the project to find gate commands. */
export interface ProjectFacts {
  ecosystems: Ecosystem[];
  /** npm, pnpm, yarn or bun; null when there is no Node package manager. */
  nodePackageManager: string | null;
  scripts: Record<string, string>;
  /** Relative paths of lockfiles present (package-lock.json, …). */
  lockfiles: string[];
}

/** `.ai-agent-setup/gates.json`: per-gate commands and extra required gates (policy can only add). */
export interface GateConfig {
  gates?: Record<string, { command?: string; timeoutMs?: number; artifact?: string }>;
  required?: string[];
}

export interface ResolvedCommand {
  command: string | null;
  source: 'config' | 'script' | 'default' | 'built-in' | 'none';
  timeoutMs: number;
}

function scriptCommand(packageManager: string, script: string): string {
  return packageManager === 'yarn' ? `yarn ${script}` : `${packageManager} run ${script}`;
}

/** Finds the command for a gate: configuration first, then a known script, then a stack default. */
export function resolveCommand(definition: GateDefinition, facts: ProjectFacts, config: GateConfig): ResolvedCommand {
  const configured = config.gates?.[definition.id];
  const timeoutMs = configured?.timeoutMs ?? definition.timeoutMs;
  if (configured?.command) return { command: configured.command, source: 'config', timeoutMs };
  const script = facts.nodePackageManager ? definition.scripts.find((name) => facts.scripts[name] !== undefined) : undefined;
  if (script && facts.nodePackageManager) return { command: scriptCommand(facts.nodePackageManager, script), source: 'script', timeoutMs };
  if (definition.check === 'secret-scan') return { command: 'git diff HEAD --no-color --unified=0', source: 'built-in', timeoutMs };
  if (definition.check === 'npm-audit' && facts.lockfiles.includes('package-lock.json')) return { command: 'npm audit --json', source: 'built-in', timeoutMs };
  const ecosystem = facts.ecosystems.find((name) => definition.defaults[name]);
  if (ecosystem) return { command: definition.defaults[ecosystem]!, source: 'default', timeoutMs };
  return { command: null, source: 'none', timeoutMs };
}

/** Why a gate has no command, with the fix. */
export function missingCommandReason(definition: GateDefinition): string {
  const scripts = definition.scripts.length ? `add a "${definition.scripts[0]}" script or ` : '';
  if (definition.check === 'npm-audit') return `no built-in dependency audit for this project (needs package-lock.json); ${scripts}set gates["${definition.id}"].command in .ai-agent-setup/gates.json`;
  return `no command found; ${scripts}set gates["${definition.id}"].command in .ai-agent-setup/gates.json`;
}

/** Validates the shape of gates.json; returns problems instead of guessing. */
export function validateGateConfig(value: unknown): { config: GateConfig; problems: string[] } {
  const problems: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { config: {}, problems: ['gates.json must be an object'] };
  const raw = value as Record<string, unknown>;
  const config: GateConfig = {};
  for (const key of Object.keys(raw)) if (key !== 'gates' && key !== 'required') problems.push(`unknown key "${key}"`);
  if (raw.required !== undefined) {
    if (Array.isArray(raw.required) && raw.required.every((item) => typeof item === 'string')) config.required = raw.required as string[];
    else problems.push('"required" must be a list of gate ids');
  }
  if (raw.gates !== undefined) {
    if (typeof raw.gates !== 'object' || raw.gates === null) problems.push('"gates" must be an object');
    else {
      config.gates = {};
      for (const [id, entry] of Object.entries(raw.gates as Record<string, unknown>)) {
        const item = (entry ?? {}) as Record<string, unknown>;
        const ok =
          (item.command === undefined || (typeof item.command === 'string' && item.command.trim() !== '')) &&
          (item.timeoutMs === undefined || (Number.isInteger(item.timeoutMs) && (item.timeoutMs as number) > 0)) &&
          (item.artifact === undefined || typeof item.artifact === 'string');
        if (!ok) problems.push(`gates["${id}"]: command must be a non-empty string, timeoutMs a positive integer, artifact a path`);
        else config.gates[id] = item as NonNullable<GateConfig['gates']>[string];
      }
    }
  }
  return { config, problems };
}
