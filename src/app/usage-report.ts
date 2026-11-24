import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { addTokens, roundUsd, TOKEN_KINDS, zeroTokens, type HostUsage, type TokenCounts } from '../core/evaluation';
import type { SchemaValidator } from '../registry';
import { RUNS_DIR } from './run-files';
import { signedEvidence } from './runs';

/**
 * Token usage per delivery and per host across runs (W2.2-04). A delivery's tokens count only when
 * they are proved: read from a usage file signed with the run (integrity VERIFIED). Anything else is
 * listed with its status and makes the host's totals incomplete, and then no figure per accepted
 * outcome is given. An accepted outcome is a SUCCEEDED run.
 */
export const HOST_USAGE_SCHEMA = 'urn:ai-agent-setup:contracts:v1:host-usage';

export const DELIVERY_USAGE = ['MEASURED', 'NOT_STARTED', 'NOT_REPORTED', 'UNSIGNED', 'NOT_RECORDED', 'INVALID'] as const;
export type DeliveryUsageStatus = (typeof DELIVERY_USAGE)[number];
/** Statuses whose tokens are proved (NOT_STARTED: the host printed nothing in a verified run). */
const COUNTED: ReadonlySet<DeliveryUsageStatus> = new Set(['MEASURED', 'NOT_STARTED']);

export interface ReportDelivery {
  host: string;
  status: DeliveryUsageStatus;
  tokens: TokenCounts | null;
  /** The host's own cost figure (estimated); null when it reports none. */
  costUsd: number | null;
}

export interface HostUsageSummary {
  host: string;
  deliveries: number;
  byStatus: Record<DeliveryUsageStatus, number>;
  /** Sum over counted deliveries only; a lower bound when `complete` is false. */
  tokens: TokenCounts;
  complete: boolean;
  acceptedOutcomes: number;
  perAcceptedOutcome: TokenCounts | null;
  reason: string;
  cost: { usd: number; perAcceptedOutcomeUsd: number | null; label: 'estimated'; basis: string } | null;
}

const TRANSCRIPT = /^host-([a-z-]+)-(\d+)\.jsonl$/;

/** Every delivery of one run, from its evidence directory. `integrity` is null for an unreadable run. */
export function runDeliveries(root: string, runId: string, integrity: string | null, validator: SchemaValidator): ReportDelivery[] {
  const dir = join(root, RUNS_DIR, runId, 'evidence');
  if (!existsSync(dir)) return [];
  const verified = integrity === 'VERIFIED';
  const signed = verified ? signedEvidence(root, runId) : new Set<string>();
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const match = TRANSCRIPT.exec(name);
      if (!match) return [];
      const [host, stamp] = [match[1]!, match[2]!];
      const started = statSync(join(dir, name)).size > 0;
      return [deliveryUsage(root, host, `${RUNS_DIR}/${runId}/evidence/usage-${host}-${stamp}.json`, { started, verified, signed, validator })];
    });
}

function deliveryUsage(
  root: string,
  host: string,
  usageFile: string,
  context: { started: boolean; verified: boolean; signed: Set<string>; validator: SchemaValidator },
): ReportDelivery {
  const { started, verified, signed, validator } = context;
  const delivery = (status: DeliveryUsageStatus, usage: HostUsage | null = null): ReportDelivery => ({
    host,
    status,
    tokens: status === 'NOT_STARTED' ? zeroTokens() : (usage?.tokens ?? null),
    costUsd: status === 'NOT_STARTED' ? 0 : (usage?.cost?.usd ?? null),
  });
  // An empty transcript in a verified run: the host never printed anything, so it used nothing.
  const notStarted = !started && verified;
  if (!existsSync(join(root, usageFile))) return delivery(notStarted ? 'NOT_STARTED' : 'NOT_RECORDED');
  let usage: HostUsage;
  try {
    usage = JSON.parse(readFileSync(join(root, usageFile), 'utf8')) as HostUsage;
  } catch {
    return delivery('INVALID');
  }
  if (!validator.validate(HOST_USAGE_SCHEMA, usage).valid || usage.host !== host) return delivery('INVALID');
  if (usage.samples === 0 && notStarted) return delivery('NOT_STARTED');
  // Figures nothing proves are never shown: they could be the ones that were changed.
  if (!signed.has(usageFile)) return delivery('UNSIGNED');
  return usage.samples === 0 ? delivery('NOT_REPORTED') : delivery('MEASURED', usage);
}

const perOutcome = (value: number, outcomes: number) => Math.round((value / outcomes) * 10) / 10;

/** Per host: proved totals, and tokens per accepted outcome when every delivery is proved. */
export function usageByHost(runs: ReadonlyArray<{ status: string; deliveries: ReportDelivery[] }>): HostUsageSummary[] {
  const hosts = [...new Set(runs.flatMap((run) => run.deliveries.map((delivery) => delivery.host)))].sort();
  return hosts.map((host) => hostSummary(host, runs));
}

function hostSummary(host: string, runs: ReadonlyArray<{ status: string; deliveries: ReportDelivery[] }>): HostUsageSummary {
  const deliveries = runs.flatMap((run) => run.deliveries.filter((delivery) => delivery.host === host));
  const counted = deliveries.filter((delivery) => COUNTED.has(delivery.status));
  const tokens = counted.reduce((sum, delivery) => addTokens(sum, delivery.tokens!), zeroTokens());
  const complete = counted.length === deliveries.length;
  const accepted = runs.filter((run) => run.status === 'SUCCEEDED' && run.deliveries.some((delivery) => delivery.host === host)).length;
  const byStatus = Object.fromEntries(DELIVERY_USAGE.map((status) => [status, deliveries.filter((delivery) => delivery.status === status).length])) as Record<DeliveryUsageStatus, number>;
  const given = complete && accepted > 0;
  // A money figure needs the host's own figure on every measured delivery; none is ever computed.
  const costs = counted.filter((delivery) => delivery.status === 'MEASURED').map((delivery) => delivery.costUsd);
  const costed = complete && costs.length > 0 && costs.every((cost) => cost !== null);
  const usd = costed ? roundUsd(costs.reduce((sum, cost) => sum + cost, 0)) : 0;
  return {
    host,
    deliveries: deliveries.length,
    byStatus,
    tokens,
    complete,
    acceptedOutcomes: accepted,
    perAcceptedOutcome: given ? (Object.fromEntries(TOKEN_KINDS.map((kind) => [kind, perOutcome(tokens[kind], accepted)])) as unknown as TokenCounts) : null,
    reason: summaryReason(byStatus, deliveries.length - counted.length, deliveries.length, accepted),
    cost: costed ? { usd, perAcceptedOutcomeUsd: given ? roundUsd(usd / accepted) : null, label: 'estimated', basis: `${host}'s own price calculation; not an invoice` } : null,
  };
}

function summaryReason(byStatus: Record<DeliveryUsageStatus, number>, unproved: number, total: number, accepted: number): string {
  if (unproved > 0) {
    const excluded = DELIVERY_USAGE.filter((status) => !COUNTED.has(status) && byStatus[status] > 0).map((status) => `${byStatus[status]} ${status}`);
    return `${unproved} of ${total} deliveries have no proved usage (${excluded.join(', ')}); totals are a lower bound`;
  }
  if (accepted === 0) return 'no accepted outcome (SUCCEEDED run) in the period';
  return `measured tokens of all ${total} deliveries, accepted or not, divided by ${accepted} SUCCEEDED run(s)`;
}
