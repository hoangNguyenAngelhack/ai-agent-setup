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
  /** A session total (Claude Code `result`): its tokens count only when no per-message usage was seen. */
  total?: boolean;
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

  constructor(private readonly host: string) {}

  add(sample: UsageSample): void {
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
    const counted = perMessage.length ? perMessage : this.totals;
    const tokens = zeroTokens();
    const byModel: Record<string, TokenCounts> = {};
    for (const sample of counted) {
      addTokens(tokens, sample.tokens!);
      const model = sample.model && MODEL_ID.test(sample.model) ? sample.model : null;
      if (model) byModel[model] = addTokens(byModel[model] ?? zeroTokens(), sample.tokens!);
    }
    const basis = perMessage.length
      ? `${this.messages.size + this.unnamed.length} usage record(s) in the ${this.host} stream${this.messages.size ? ', each message id counted once' : ''}`
      : this.totals.length
        ? `session total reported by ${this.host}`
        : `no usage in the ${this.host} stream`;
    return {
      schemaVersion: 'host-usage/v1',
      host: this.host,
      samples: this.samples,
      tokens,
      byModel,
      label: 'measured',
      basis,
      cost: this.costSeen ? { usd: roundUsd(this.costUsd), label: 'estimated', basis: `${this.host}'s own price calculation; not an invoice` } : null,
    };
  }
}
