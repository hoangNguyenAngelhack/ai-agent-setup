import type { Capability, IsolationCapabilities, IsolationControl, IsolationPolicy, PreparedLaunch } from '../core/isolation';
import { ISOLATION_CONTROLS } from '../core/isolation';

/** An isolation mechanism for one platform. `prepare` never starts anything. */
export interface IsolationProvider {
  id: string;
  capabilities(): IsolationCapabilities;
  prepare(policy: IsolationPolicy, command: string, args: string[]): PreparedLaunch;
}

export function allControls(capability: Capability): Record<IsolationControl, Capability> {
  return Object.fromEntries(ISOLATION_CONTROLS.map((control) => [control, capability])) as Record<IsolationControl, Capability>;
}

/** A provider that can only refuse: the reason says what is missing. Never falls back to a plain process. */
export function unsupportedProvider(id: string, platform: string, reason: string): IsolationProvider {
  const refused: Capability = { status: 'UNSUPPORTED', reason };
  return {
    id,
    capabilities: () => ({
      provider: id,
      platform,
      profiles: { none: { status: 'SUPPORTED', reason: 'no isolation' }, restricted: refused, isolated: refused },
      controls: allControls(refused),
    }),
    prepare: () => {
      throw new Error(`Isolation provider ${id} cannot start anything: ${reason}`);
    },
  };
}

/** Profile none: today's behaviour, nothing claimed. The full environment is passed, as before. */
export const noneProvider: IsolationProvider = {
  id: 'none',
  capabilities: () => ({
    provider: 'none',
    platform: process.platform,
    profiles: {
      none: { status: 'SUPPORTED', reason: 'no isolation: the agent runs as a normal process of this user' },
      restricted: { status: 'UNSUPPORTED', reason: 'profile none enforces nothing' },
      isolated: { status: 'UNSUPPORTED', reason: 'profile none enforces nothing' },
    },
    controls: allControls({ status: 'UNSUPPORTED', reason: 'profile none enforces nothing' }),
  }),
  prepare: (policy, command, args) => ({
    requested: policy.profile,
    applied: 'none',
    provider: 'none',
    platform: process.platform,
    command,
    args,
    env: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    scratch: null,
    enforced: [],
    notEnforced: ISOLATION_CONTROLS.map((control) => ({ control, reason: 'profile none' })),
    cleanup: () => undefined,
  }),
};
