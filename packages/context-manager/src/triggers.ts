import type { AdaptiveTriggerConfig, ContextState } from "./types.js";

export interface TriggerInput {
  budgetUsed: number;
  state: ContextState;
  turnCount: number;
  costUsd: number;
  forced: boolean;
}

export interface TriggerDecision {
  shouldCompress: boolean;
  reason: string | null;
  force: boolean;
}

export function shouldCompress(
  config: AdaptiveTriggerConfig,
  thresholds: { soft: number; hard: number },
  input: TriggerInput,
): TriggerDecision {
  if (input.forced) {
    return { shouldCompress: true, reason: "forced", force: true };
  }
  if (input.budgetUsed >= thresholds.hard) {
    return { shouldCompress: true, reason: "hard-token-threshold", force: true };
  }
  if (config.enableTurnInterval && config.turnInterval > 0 && input.turnCount > 0) {
    if (input.turnCount % config.turnInterval === 0) {
      return { shouldCompress: true, reason: "turn-interval", force: false };
    }
  }
  if (config.enableCostCap && config.costCapUsd > 0 && input.costUsd >= config.costCapUsd) {
    return { shouldCompress: true, reason: "cost-cap", force: false };
  }
  if (input.state === "soft-warn" && input.budgetUsed >= thresholds.soft) {
    return { shouldCompress: true, reason: "soft-token-threshold", force: false };
  }
  return { shouldCompress: false, reason: null, force: false };
}
