import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import type { SwarmState, SwarmRole, SubagentStatus, SwarmPauseReason } from "@promyra/swarm";

export interface SwarmPanelProps {
  state: SwarmState | null;
  /** When set, panel reflects an "active" state (e.g. orchestrator is running). */
  active?: boolean;
}

const ROLES_ORDER: SwarmRole[] = ["planner", "researcher", "builder", "critic", "test-runner"];

export function colorForRole(role: SwarmRole): string {
  switch (role) {
    case "planner": return "magenta";
    case "researcher": return "blue";
    case "builder": return "yellow";
    case "critic": return "cyan";
    case "test-runner": return "green";
    default: return "white";
  }
}

export function colorForStatus(status: SubagentStatus | "running" | "pending"): string {
  if (status === "pass") return "green";
  if (status === "fail" || status === "blocked") return "red";
  return "gray";
}

export function colorForBudget(totalUsd: number, limitUsd: number, warnRatio: number): string {
  if (totalUsd >= limitUsd) return "red";
  if (totalUsd >= limitUsd * warnRatio) return "yellow";
  return "green";
}

export function formatSwarmStateLine(state: SwarmState): string {
  const completed = ROLES_ORDER.filter(r => state.results[r] !== undefined);
  const list = completed.length > 0 ? completed.join("+") : "...";
  const costStr = state.budget.totalUsd < 0.01
    ? `$${state.budget.totalUsd.toFixed(4)}`
    : `$${state.budget.totalUsd.toFixed(2)}`;
  const limitStr = `$${state.budget.limitUsd.toFixed(2)}`;
  return `swarm: ${list}  ${costStr}/${limitStr}  ${state.currentPhase}`;
}

function pauseReasonText(reason: SwarmPauseReason | undefined): string {
  if (!reason) return "";
  switch (reason.kind) {
    case "budget-exceeded":
      return `budget exceeded ($${reason.totalUsd.toFixed(2)} / $${reason.limitUsd.toFixed(2)})`;
    case "subagent-failed":
      return `${reason.role} failed after ${reason.attempts} attempts: ${reason.lastError}`;
    case "verifier-failed":
      return `verifier failed on ${reason.role}: ${reason.failures.join(", ")}`;
    case "worktree-failed":
      return `worktree creation failed for ${reason.role}: ${reason.error}`;
    default: return "unknown reason";
  }
}

function elapsed(state: SwarmState): string {
  const ms = state.updatedAt - state.startedAt;
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

export function SwarmPanel({ state, active = true }: SwarmPanelProps): React.ReactElement {
  if (!state) {
    return (
      <Box flexDirection="column" paddingX={2} borderStyle="single" borderColor={theme.borderSubtle}>
        <Text color={theme.textMuted}>no active swarm</Text>
      </Box>
    );
  }

  const budgetColor = colorForBudget(state.budget.totalUsd, state.budget.limitUsd, state.budget.warnRatio);
  const costStr = state.budget.totalUsd < 0.01
    ? `$${state.budget.totalUsd.toFixed(4)}`
    : `$${state.budget.totalUsd.toFixed(2)}`;
  const isPaused = state.status === "paused";
  const isDone = state.status === "done";

  return (
    <Box flexDirection="column" paddingX={2} borderStyle="single" borderColor={isPaused ? theme.error : isDone ? theme.success : theme.border}>
      <Box justifyContent="space-between">
        <Box>
          <Text color={theme.textMuted}>swarm </Text>
          <Text color={theme.text} bold>{`\`${state.swarmId}\``}</Text>
          <Text color={theme.textMuted}> · {state.currentPhase}</Text>
          {isPaused ? <Text color={theme.error}>  PAUSED</Text> : null}
          {isDone ? <Text color={theme.success}>  DONE</Text> : null}
        </Box>
        <Box>
          <Text color={budgetColor}>{`${costStr} / $${state.budget.limitUsd.toFixed(2)}`}</Text>
          <Text color={theme.textMuted}>  {elapsed(state)}</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {ROLES_ORDER.map(role => {
          const r = state.results[role];
          const status: SubagentStatus | "running" | "pending" = r
            ? r.final.status
            : (active && !isPaused && !isDone ? "running" : "pending");
          const roleColor = colorForRole(role);
          const statusColor = colorForStatus(status);
          const cost = r ? `$${r.totalCostUsd.toFixed(4)}` : "...";
          return (
            <Box key={role}>
              <Text color={roleColor}>{role.padEnd(13)}</Text>
              <Text color={statusColor}>{status.padEnd(9)}</Text>
              <Text color={theme.textMuted}>{cost.padStart(10)}</Text>
              {r && r.attempts.length > 1 ? (
                <Text color={theme.textMuted}>  ({r.attempts.length} attempts)</Text>
              ) : null}
            </Box>
          );
        })}
      </Box>

      {isPaused && state.pauseReason ? (
        <Box marginTop={1}>
          <Text color={theme.error}>  </Text>
          <Text color={theme.warning}>{pauseReasonText(state.pauseReason)}</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text color={theme.textMuted}>  {state.goal}</Text>
      </Box>
    </Box>
  );
}

export default SwarmPanel;
