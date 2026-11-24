import type { GenerationContext } from './generation-context';

/** Writes the self-contained policy hook runtime and its policies into `hookDir`. */
export function writePolicyHook(context: GenerationContext, hookDir: string): string[] {
  const outputs: string[] = [];
  for (const [path, content] of Object.entries(context.input.hookFiles).sort(([a], [b]) => a.localeCompare(b))) {
    context.write(`${hookDir}/${path}`, content, null);
    outputs.push(`${hookDir}/${path}`);
  }
  context.write(`${hookDir}/policies.json`, `${JSON.stringify(context.input.policies, null, 2)}\n`, null);
  return [...outputs, `${hookDir}/policies.json`];
}
