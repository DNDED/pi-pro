/**
 * v0.6.0 OptimizerIntegration.
 *
 * Wraps v0.5.0's cascade router (`@promyra/optimizer`) with swarm-specific
 * role → model mapping. Per the v0.6.0 design, builder uses the main
 * model (Sonnet-class), and all other subagents use the cheap model
 * (Haiku-class). The per-tool cascade map (v0.5.0) is still applied
 * inside each subagent.
 */

import { resolveCascadeModel, type CascadeDecision } from "@promyra/optimizer";
import type { SwarmRole } from "./types.js";

/**
 * Map each swarm role to its cascade decision. "main" = use the
 * orchestrator's main model; "cheap" = use the cheap subagent model.
 */
export const CASCADE_BY_ROLE: Record<SwarmRole, CascadeDecision> = {
  "planner": "cheap",
  "researcher": "cheap",
  "critic": "cheap",
  "test-runner": "cheap",
  "builder": "main",
};

/**
 * Resolve a subagent's model. `mainModel` is the orchestrator/builder's
 * model. For "cheap" subagents, falls back to the provider's cheap variant
 * via the v0.5.0 cascade router.
 */
export function resolveSubagentModel(
  role: SwarmRole,
  provider: string,
  mainModel: string,
  forceModel?: string,
): string {
  if (forceModel) return forceModel;
  const decision = CASCADE_BY_ROLE[role] ?? "main";
  if (decision === "main") return mainModel;
  return resolveCascadeModel(provider, mainModel);
}
