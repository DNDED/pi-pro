/**
 * v0.6.0 PlanWriter.
 *
 * Pure formatter for the orchestrator's plan-as-markdown. Renders a
 * human-readable plan to `<swarmDir>/plan.md` so the user can review
 * the planned execution via `pi swarm --plan "<goal>"`.
 *
 * Markdown sections:
 *   - # Title + goal
 *   - ## Roster (table of role, model, tools, max retries)
 *   - ## Execution order (topo with parallel-group annotations)
 *   - ## Budget (limit, warn ratio, expected cost ceiling)
 */

import type { SwarmPlan } from "./types.js";

export function renderPlan(plan: SwarmPlan): string {
  const lines: string[] = [];
  lines.push(`# Swarm plan: ${plan.goal}`);
  lines.push("");
  lines.push(`**Swarm ID:** \`${plan.swarmId}\`  `);
  lines.push(`**Created:** ${new Date(plan.createdAt).toISOString()}  `);
  lines.push(`**Budget:** $${plan.budget.limitUsd.toFixed(2)} (soft warn at ${Math.round((plan.budget.warnRatio ?? 0.5) * 100)}%)`);
  lines.push("");

  lines.push("## Roster");
  lines.push("");
  lines.push("| Role | Model | Tools | Max retries |");
  lines.push("|------|-------|-------|-------------|");
  for (const r of plan.roster) {
    const retryStr = r.maxRetries === 0 ? "0" : `${r.maxRetries} ${r.maxRetries === 1 ? "retry" : "retries"}`;
    lines.push(`| ${r.role} | \`${r.model}\` | ${r.tools.join(", ")} | ${retryStr} |`);
  }
  lines.push("");

  lines.push("## Execution order");
  lines.push("");
  const topoDisplay = plan.topo.map((phase, i) => {
    // Check if this phase is in a parallel group
    const inParallel = plan.parallelGroups.some(g => g.includes(phase) && g.length > 1);
    const label = inParallel ? `${phase} (parallel)` : phase;
    return i === 0 ? label : `→ ${label}`;
  }).join(" ");
  lines.push(topoDisplay);
  lines.push("");

  if (plan.parallelGroups.length > 0) {
    lines.push("### Parallel groups");
    for (const g of plan.parallelGroups) {
      if (g.length > 1) lines.push(`- \`${g.join(", ")}\` run concurrently`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export interface ParsedPlan {
  goal: string;
  swarmId?: string;
}

/**
 * Best-effort parser for a `plan.md` written by `renderPlan`. Used by
 * `--status` and resume to recover basic info from disk.
 */
export function parsePlan(markdown: string): ParsedPlan {
  const lines = markdown.split("\n");
  // Title is the first H1
  const titleLine = lines.find(l => l.startsWith("# "));
  const goal = titleLine ? titleLine.slice(2).replace(/^Swarm plan:\s*/, "").trim() : "";
  // Swarm ID is in the meta line
  const metaLine = lines.find(l => l.includes("**Swarm ID:**"));
  const idMatch = metaLine?.match(/`([^`]+)`/);
  return {
    goal: goal || "(recovered from plan.md)",
    swarmId: idMatch?.[1],
  };
}
