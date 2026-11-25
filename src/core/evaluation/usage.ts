/**
 * Token usage a host reports in its own stream (W2.2-04, OQ-03). Tokens are measured: read from the
 * host, never computed. A cost in money is never computed here either: only the host's own figure
 * is kept, and it is labelled `estimated` because it is the host's price calculation, not an invoice.
 * Token kinds are kept as each host reports them; figures from different hosts are never added up.
 */
export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** One usage record parsed from a host stream line. */
export interface UsageSample {
  /** Set when the host repeats one message over several lines (Claude Code); counted once. */
  messageId?: string;
  model?: string;
  tokens?: Partial<TokenCounts>;
  /** The host's cost figure for the whole session (Claude Code `total_cost_usd`). */
  costUsd?: number;
  /**
   * A session total (Claude Code `result`). When present it is what counts: per-message usage in a
   * Claude Code stream carries the output count from the start of each message, not the final one
   * (verified 2026-11-25 on Claude Code 2.1.332: 23 output tokens per message vs 321 in the total).
   */
  total?: boolean;
  /** Tokens per model in a session total (Claude Code `modelUsage`, which includes auxiliary calls). */
  models?: Record<string, Partial<TokenCounts>>;
  /** Ids of tool calls started on this line (W2.2-07); each id is counted once. */
  toolCalls?: string[];
}

export interface HostUsage {
  schemaVersion: 'host-usage/v1';
  host: string;
  /** Usage records read from the stream; 0 means the stream carried no usage at all. */
  samples: number;
  tokens: TokenCounts;
  /** Tokens per model, when the host names the model. */
  byModel: Record<string, TokenCounts>;
  label: 'measured';
  basis: string;
  cost: { usd: number; label: 'estimated'; basis: string } | null;
  /** Distinct tool calls the host started (W2.2-07); absent in files written before it. */
  toolCalls?: number;
}

export const TOKEN_KINDS = ['input', 'output', 'cacheRead', 'cacheWrite'] as const;

/** Money figures keep micro-dollar precision. */
export const roundUsd = (value: number): number => Math.round(value * 1e6) / 1e6;

export const zeroTokens = (): TokenCounts => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

export function addTokens(target: TokenCounts, more: Partial<TokenCounts>): TokenCounts {
  for (const kind of TOKEN_KINDS) target[kind] += more[kind] ?? 0;
  return target;
}

/** A count the host printed; anything else (negative, fractional, text) is not a count. */
export function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/** Model names end up in evidence files; anything that does not look like a model id is dropped. */
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,99}$/;

export class UsageMeter {
  private readonly messages = new Map<string, UsageSample>();
  private readonly unnamed: UsageSample[] = [];
  private readonly totals: UsageSample[] = [];
  private samples = 0;
  private costUsd = 0;
  private costSeen = false;
  private readonly toolCalls = new Set<string>();

  constructor(private readonly host: string) {}

  add(sample: UsageSample): void {
    for (const id of sample.toolCalls ?? []) this.toolCalls.add(id);
    if (!sample.tokens && sample.costUsd === undefined) return;
    this.samples += 1;
    if (sample.costUsd !== undefined) {
      this.costUsd += sample.costUsd;
      this.costSeen = true;
    }
    if (!sample.tokens) return;
    if (sample.total) this.totals.push(sample);
    // The same message id carries the same usage on every line it appears on: keep the first.
    else if (sample.messageId !== undefined) {
      if (!this.messages.has(sample.messageId)) this.messages.set(sample.messageId, sample);
    } else this.unnamed.push(sample);
  }

  result(): HostUsage {
    const perMessage = [...this.messages.values(), ...this.unnamed];
    const counted = this.totals.length ? this.totals : perMessage;
    const tokens = zeroTokens();
    const byModel: Record<string, TokenCounts> = {};
    const addModel = (name: string | undefined, counts: Partial<TokenCounts>) => {
      if (name && MODEL_ID.test(name)) byModel[name] = addTokens(byModel[name] ?? zeroTokens(), counts);
    };
    for (const sample of counted) {
      addTokens(tokens, sample.tokens!);
      if (sample.models) for (const [name, counts] of Object.entries(sample.models)) addModel(name, counts);
      else addModel(sample.model, sample.tokens!);
    }
    return { schemaVersion: 'host-usage/v1', host: this.host, samples: this.samples, tokens, byModel, label: 'measured', basis: this.basis(perMessage.length), ...this.costAndToolCalls() };
  }

  private basis(perMessage: number): string {
    if (this.totals.length) return `session total reported by ${this.host}`;
    if (!perMessage) return `no usage in the ${this.host} stream`;
    // Without a session total (the host did not finish), per-message output counts can be low.
    const incomplete = this.messages.size ? ', each message id counted once; no session total, so output tokens can be incomplete' : '';
    return `${perMessage} usage record(s) in the ${this.host} stream${incomplete}`;
  }

  private costAndToolCalls(): Pick<HostUsage, 'cost' | 'toolCalls'> {
    return {
      cost: this.costSeen ? { usd: roundUsd(this.costUsd), label: 'estimated', basis: `${this.host}'s own price calculation; not an invoice` } : null,
      toolCalls: this.toolCalls.size,
    };
  }
}
