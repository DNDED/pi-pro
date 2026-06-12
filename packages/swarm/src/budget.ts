/**
 * v0.6.0 BudgetTracker.
 *
 * Per-swarm cost accumulator with soft-warn at 50% and hard-kill at 100%.
 * State persists to `cost.json` in the scratchpad so a paused swarm
 * can be resumed with full cost continuity.
 *
 * Pure logic — no I/O on the hot path beyond scratchpad writes. The
 * orchestrator queries `shouldKill()` after each subagent completes.
 */

import type { BudgetState, BudgetOpts, SwarmRole } from "./types.js";
import type { Scratchpad } from "./scratchpad.js";

const COST_FILE = "cost.json";

const ZERO_BREAKDOWN: Record<SwarmRole, number> = {
  "planner": 0,
  "researcher": 0,
  "builder": 0,
  "critic": 0,
  "test-runner": 0,
};

export class BudgetTracker {
  private state: BudgetState;
  private readonly pad: Scratchpad;
  private readonly limit: number;
  private readonly warn: number;
  private dirty = true;

  constructor(opts: { pad: Scratchpad; limitUsd: number; warnRatio?: number; initial?: Partial<BudgetState> }) {
    this.pad = opts.pad;
    this.limit = opts.limitUsd;
    this.warn = opts.warnRatio ?? 0.5;
    this.state = {
      totalUsd: opts.initial?.totalUsd ?? 0,
      bySubagent: { ...ZERO_BREAKDOWN, ...(opts.initial?.bySubagent ?? {}) },
      limitUsd: opts.limitUsd,
      warnRatio: this.warn,
    };
    this.dirty = true; // trigger lazy load on first recordSubagentCost
  }

  /** Load state from the scratchpad if present; otherwise the in-memory state is used. */
  async load(): Promise<void> {
    try {
      const persisted = await this.pad.readJSON<BudgetState>(COST_FILE);
      this.state = {
        totalUsd: persisted.totalUsd ?? 0,
        bySubagent: { ...ZERO_BREAKDOWN, ...(persisted.bySubagent ?? {}) },
        limitUsd: this.limit,
        warnRatio: this.warn,
      };
    } catch {
      // No persisted state — keep current in-memory state
    }
    this.dirty = false;
  }

  totalUsd(): number { return this.state.totalUsd; }
  limitUsd(): number { return this.limit; }
  warnRatio(): number { return this.warn; }
  getState(): BudgetState { return { ...this.state, bySubagent: { ...this.state.bySubagent } }; }

  /**
   * Record a subagent's cost. Persists to scratchpad synchronously
   * (callers wrap in their own try/catch if they want to defer).
   * Auto-loads persisted state on first call so a new tracker instance
   * resumes from the previous swarm's cost.
   */
  async recordSubagentCost(role: SwarmRole, costUsd: number): Promise<void> {
    if (this.dirty) await this.load();
    if (costUsd < 0 || !Number.isFinite(costUsd)) return;
    this.state.bySubagent[role] = (this.state.bySubagent[role] ?? 0) + costUsd;
    this.state.totalUsd += costUsd;
    await this.persist();
  }

  /** True when total has reached the soft-warn ratio (default 50%). */
  shouldWarn(): boolean {
    return this.state.totalUsd >= this.state.limitUsd * this.warn;
  }

  /** True when total has reached or exceeded the hard-kill limit. */
  shouldKill(): boolean {
    return this.state.totalUsd >= this.state.limitUsd;
  }

  /** Remaining budget in USD. */
  remaining(): number {
    return Math.max(0, this.state.limitUsd - this.state.totalUsd);
  }

  private async persist(): Promise<void> {
    try {
      await this.pad.writeJSON(COST_FILE, this.state);
    } catch {
      // best-effort; in-memory state is still authoritative
    }
    this.dirty = false;
  }
}
