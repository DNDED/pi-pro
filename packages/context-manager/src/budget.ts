import type { TokenBudgetConfig, ContextState } from "./types.js";

export class TokenBudget {
  private total = 0;
  private readonly config: TokenBudgetConfig;

  constructor(config: TokenBudgetConfig) {
    this.config = config;
  }

  record(tokens: number): void {
    if (tokens < 0) return;
    this.total += tokens;
  }

  getTotal(): number {
    return this.total;
  }

  getBudgetUsed(): number {
    if (this.config.maxTokens <= 0) return 0;
    return this.total / this.config.maxTokens;
  }

  getState(): ContextState {
    const pct = this.getBudgetUsed();
    if (pct >= this.config.hardTriggerThreshold) return "hard-trigger";
    if (pct >= this.config.softWarnThreshold) return "soft-warn";
    return "ok";
  }

  reset(): void {
    this.total = 0;
  }

  remaining(): number {
    return Math.max(0, this.config.maxTokens - this.total);
  }
}
