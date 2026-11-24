import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HostConfigDetection } from '../../core/contracts';
import type { Adapter } from '../adapter';
import { generateCodex } from './generate';

/** Paths Codex reads (verified 2026-11-23 against Codex 0.171.0 docs, docs/v2/05 §10.2). */
const KNOWN_ARTIFACTS = [
  'AGENTS.md',
  'AGENTS.override.md',
  '.codex/config.toml',
  '.codex/agents',
  '.codex/hooks.json',
  '.agents/skills',
];

export const codexAdapter: Adapter = {
  id: 'codex',
  version: '0.1.0',
  generate: generateCodex,
  detectExistingConfig(root: string): HostConfigDetection {
    const artifacts = KNOWN_ARTIFACTS.filter((path) => existsSync(join(root, path))).sort();
    // V1 never generated Codex files, so there is no Codex-side V1 fingerprint.
    return { adapter: 'codex', present: artifacts.length > 0, artifacts, v1Fingerprint: false };
  },
};

export { codexDelivery } from './delivery';
