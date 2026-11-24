import type { IsolationCapabilities, IsolationControl, IsolationPolicy, IsolationProfile } from './contracts';

/** Controls a profile must actually enforce; a provider that cannot is refused for that profile. */
export const REQUIRED_CONTROLS: Record<IsolationProfile, IsolationControl[]> = {
  none: [],
  restricted: ['filesystem-read', 'filesystem-write', 'secret-isolation', 'process-exec', 'process-signal', 'approval-boundary'],
  isolated: ['identity-separation', 'filesystem-read', 'filesystem-write', 'secret-isolation', 'process-exec', 'process-signal', 'approval-boundary'],
};

/**
 * Problems that make a launch unsafe or impossible with this provider. Empty means it may start.
 * Never upgrades or downgrades the profile: a request that cannot be met is refused.
 */
export function policyProblems(policy: IsolationPolicy, capabilities: IsolationCapabilities): string[] {
  const problems: string[] = [];
  const profile = capabilities.profiles[policy.profile];
  if (profile.status !== 'SUPPORTED') problems.push(`profile ${policy.profile} is ${profile.status} with ${capabilities.provider} on ${capabilities.platform}: ${profile.reason}`);
  for (const control of REQUIRED_CONTROLS[policy.profile]) {
    const capability = capabilities.controls[control];
    if (capability.status !== 'SUPPORTED') problems.push(`${control} is ${capability.status}: ${capability.reason}`);
  }
  if (policy.profile !== 'none') {
    if (policy.network.mode === 'deny-all' && capabilities.controls['network-deny'].status !== 'SUPPORTED') problems.push(`network deny-all cannot be enforced: ${capabilities.controls['network-deny'].reason}`);
    if (policy.network.mode === 'allowlist' && capabilities.controls['network-allowlist'].status !== 'SUPPORTED') {
      problems.push(`network allowlist cannot be enforced: ${capabilities.controls['network-allowlist'].reason}`);
    }
  } else if (policy.network.mode !== 'allow-all') {
    problems.push('a network restriction needs an isolation profile; profile none enforces nothing');
  }
  if (!policy.workspace.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(policy.workspace)) problems.push('workspace must be an absolute path');
  for (const path of policy.protected) {
    if (path === policy.workspace || policy.workspace.startsWith(`${path}/`)) problems.push(`the workspace ${policy.workspace} lies inside a protected path ${path}`);
  }
  return problems;
}
