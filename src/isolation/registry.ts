import type { IsolationCapabilities, IsolationProfile } from '../core/isolation';
import { noneProvider, unsupportedProvider, type IsolationProvider } from './provider';
import { seatbeltProvider } from './seatbelt';

/**
 * Isolation providers per platform (W2.2-09, ADR-017). Only providers proven on a real OS are wired
 * in; the others refuse with the reason, so a request is never met by a plain process.
 */
const OS_USER_REASON =
  'needs a dedicated OS user created by an administrator, with the key directory and runtime state readable only by your account; not configured on this machine (requires your permission)';

function restrictedProvider(platform: NodeJS.Platform): IsolationProvider {
  switch (platform) {
    case 'darwin':
      return seatbeltProvider;
    case 'linux':
      return unsupportedProvider('linux-namespaces', 'linux', 'no Linux provider is implemented yet (bubblewrap or Landlock); not verified on a Linux machine');
    case 'win32':
      return unsupportedProvider('windows-appcontainer', 'win32', 'no Windows provider is implemented yet (AppContainer or restricted token with a Job Object); not verified on a Windows machine');
    default:
      return unsupportedProvider('unknown', platform, `no isolation provider for ${platform}`);
  }
}

export function providerFor(profile: IsolationProfile, platform: NodeJS.Platform = process.platform): IsolationProvider {
  if (profile === 'none') return noneProvider;
  if (profile === 'isolated') return unsupportedProvider('os-user', platform, OS_USER_REASON);
  return restrictedProvider(platform);
}

export type PlatformStatus = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'NOT_VERIFIED';

/** What each platform offers, from what is implemented and, for this platform, proven by a live probe. */
export function platformMatrix(): Array<{ platform: string; status: PlatformStatus; restricted: string; isolated: string }> {
  const darwin = process.platform === 'darwin' ? seatbeltProvider.capabilities().profiles.restricted : null;
  return [
    {
      platform: 'macOS',
      status: darwin === null ? 'NOT_VERIFIED' : darwin.status === 'SUPPORTED' ? 'PARTIAL' : 'UNSUPPORTED',
      restricted: darwin === null ? 'Seatbelt provider implemented; not probed on this machine' : `${darwin.status}: ${darwin.reason}`,
      isolated: `UNSUPPORTED: ${OS_USER_REASON}`,
    },
    { platform: 'Linux', status: 'UNSUPPORTED', restricted: 'UNSUPPORTED: no provider yet', isolated: `UNSUPPORTED: ${OS_USER_REASON}` },
    { platform: 'Windows', status: 'UNSUPPORTED', restricted: 'UNSUPPORTED: no provider yet', isolated: `UNSUPPORTED: ${OS_USER_REASON}` },
  ];
}

export function capabilitiesFor(profile: IsolationProfile): IsolationCapabilities {
  return providerFor(profile).capabilities();
}
