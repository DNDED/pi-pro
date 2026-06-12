/**
 * v0.6.0 swarm types.
 *
 * Branded `SwarmId` prevents accidental mixing with plain strings. All
 * state-machine types are explicit string unions so the orchestrator
 * can be exhaustively switched.
 */

// -------- Branded primitives --------

declare const swarmIdBrand: unique symbol;
export type SwarmId = string & { readonly [swarmIdBrand]: true };

export function swarmId(value: string): SwarmId {
  if (!/^swarm_[a-z0-9_]+$/.test(value)) {
    throw new Error(`Invalid swarm id: ${value} (expected /^swarm_[a-z0-9_]+$/)`);
  }
  return value as SwarmId;
}

declare const roleBrand: unique symbol;
export type SwarmRole = "planner" | "researcher" | "builder" | "critic" | "test-runner";

export const SWARM_ROLES: readonly SwarmRole[] = [
  "planner", "researcher", "builder", "critic", "test-runner",
] as const;

export const SWARM_WRITE_ROLES: readonly SwarmRole[] = ["builder"] as const;
export const SWARM_EXEC_ROLES: readonly SwarmRole[] = ["builder", "test-runner"] as const;
export const SWARM_READ_ONLY_ROLES: readonly SwarmRole[] = [
  "planner", "researcher", "critic",
] as const;

export type SwarmPhase =
  | "idle"
  | "plan"
  | "research"
  | "plan2"
  | "build"
  | "test"
  | "critique"
  | "decide"
  | "merge"
  | "done"
  | "paused";

export const SWARM_PHASE_ORDER: readonly SwarmPhase[] = [
  "idle", "plan", "research", "plan2", "build", "test",
  "critique", "decide", "merge", "done",
] as const;

// -------- Cost / budget --------

export interface BudgetState {
  /** Total spent so far, USD. */
  totalUsd: number;
  /** Per-subagent breakdown. */
  bySubagent: Record<SwarmRole, number>;
  /** Limit configured for this swarm, USD. */
  limitUsd: number;
  /** Soft warn threshold (default 0.5 = 50%). */
  warnRatio: number;
}

export interface BudgetOpts {
  limitUsd: number;
  warnRatio?: number;
}

// -------- Roster / plan --------

export interface RosterEntry {
  role: SwarmRole;
  model: string;
  tools: string[];
  maxRetries: number;
}

export interface SwarmPlan {
  swarmId: SwarmId;
  goal: string;
  roster: RosterEntry[];
  /** Ordered execution. Parallel roles grouped via parallelGroups. */
  topo: SwarmPhase[];
  parallelGroups: Array<SwarmPhase[]>;
  budget: BudgetOpts;
  createdAt: number;
}

// -------- Subagent results --------

export type SubagentStatus = "pass" | "fail" | "blocked";

export interface SubagentAttempt {
  attempt: number;
  status: SubagentStatus;
  evidence: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
  error?: string;
}

export interface SubagentResult {
  role: SwarmRole;
  attempts: SubagentAttempt[];
  /** Best (last passing) attempt, or last attempt if all failed. */
  final: SubagentAttempt;
  /** Total cost across all attempts. */
  totalCostUsd: number;
  /** Total tokens across all attempts. */
  totalTokensIn: number;
  totalTokensOut: number;
}

// -------- Verification gate --------

export interface TestResult {
  /** Did the test command exit cleanly with passing tests? */
  passed: boolean;
  /** Test command that was run. */
  command: string;
  /** Exit code (0 = pass, non-zero = fail). */
  exitCode: number;
  /** Last N chars of stdout. */
  stdoutTail: string;
  /** Last N chars of stderr. */
  stderrTail: string;
  /** Parsed failure summary, if any. */
  failures: string[];
  /** True if test infrastructure was missing (e.g. no pytest). */
  skipped: boolean;
  skipReason?: string;
  durationMs: number;
}

// -------- State machine --------

export type SwarmStatus = "running" | "paused" | "done" | "failed";

export interface SwarmState {
  swarmId: SwarmId;
  goal: string;
  status: SwarmStatus;
  currentPhase: SwarmPhase;
  results: Partial<Record<SwarmRole, SubagentResult>>;
  budget: BudgetState;
  startedAt: number;
  updatedAt: number;
  /** Last successful test result (if any). */
  lastTest?: TestResult;
  /** Reasons the swarm paused (if any). */
  pauseReason?: SwarmPauseReason;
}

export type SwarmPauseReason =
  | { kind: "budget-exceeded"; totalUsd: number; limitUsd: number }
  | { kind: "subagent-failed"; role: SwarmRole; attempts: number; lastError: string }
  | { kind: "verifier-failed"; role: SwarmRole; failures: string[] }
  | { kind: "worktree-failed"; role: SwarmRole; error: string };

// -------- Worktree ref --------

export interface WorktreeRef {
  role: SwarmRole;
  path: string;
  branch: string;
  swarmId: SwarmId;
}

// -------- Orchestrator result --------

export interface OrchestratorResult {
  swarmId: SwarmId;
  status: SwarmStatus;
  finalResults: Partial<Record<SwarmRole, SubagentResult>>;
  totalCostUsd: number;
  totalDurationMs: number;
  startedAt: number;
  endedAt: number;
  pauseReason?: SwarmPauseReason;
  /** When status === "done": the merged worktree (if any). */
  mergedWorktree?: WorktreeRef;
}

// -------- Orchestrator options --------

export interface OrchestratorOpts {
  /** Working directory (the repo root). */
  rootDir: string;
  /** Swarm ID. */
  swarmId: SwarmId;
  /** Goal string. */
  goal: string;
  /** Provider name (anthropic, openai, opencode-go, etc.). */
  provider: string;
  /** Main model for builder + orchestrator. */
  mainModel: string;
  /** Per-swarm budget in USD. Default $2.00. */
  budgetUsd?: number;
  /** Max retries per subagent. Default 2 for builder, 1 for test-runner, 0 for others. */
  maxRetries?: number;
  /** Worktree base directory. Default .pi-pro/worktrees. */
  worktreeBase?: string;
  /** Scratchpad base directory. Default .pi-pro/swarm. */
  scratchpadBase?: string;
  /** When true, do not actually dispatch LLM calls; print plan + roster and exit. */
  dryRun?: boolean;
  /** When true, show plan + roster before running. */
  showPlan?: boolean;
  /** When true, skip the critic subagent. */
  noCritic?: boolean;
  /** When true, skip worktree creation (run all in cwd). */
  noWorktree?: boolean;
}
