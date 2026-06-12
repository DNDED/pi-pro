import { loadConfig, getApiKey, createProvider } from "@promyra/provider";
import { SubagentRouter } from "@promyra/subagent";
import { Plan } from "@promyra/tasks";

export function buildPlan(taskId: string, taskDescription: string, hasGit: boolean): Plan {
  if (hasGit) {
    return {
      taskId, title: taskDescription,
      steps: [
        { id: "intake", description: "load", done: false },
        { id: "plan", description: "plan", done: false },
        { id: "branch", description: "worktree", done: false },
        { id: "execute", description: "build", done: false },
        { id: "verify", description: "verify", done: false },
        { id: "done", description: "done", done: false },
      ],
    };
  }
  return {
    taskId, title: taskDescription,
    steps: [
      { id: "intake", description: "load", done: false },
      { id: "execute", description: "build", done: false },
      { id: "done", description: "done", done: false },
    ],
  };
}

export async function start(taskDescription: string): Promise<void> {
  const startTime = Date.now();

  const config = await loadConfig();
  const apiKey = await getApiKey(config.provider);
  if (!apiKey) {
    const { emit } = await import("@promyra/tui-pro");
    emit({ type: "error", text: "No API key. Set OPENCODE_GO_API_KEY env var." });
    return;
  }

  const provider = createProvider({ apiKey, baseUrl: config.baseUrl, defaultModel: config.model });

  let hasGit = false;
  try {
    const { execSync } = await import("node:child_process");
    execSync("git rev-parse --git-dir 2>/dev/null", { stdio: "pipe" });
    hasGit = true;
  } catch { hasGit = false; }

  const { emit } = await import("@promyra/tui-pro");

  emit({
    type: "route",
    route: "session",
  });

  emit({
    type: "session_meta",
    meta: {
      id: `tsk_${Date.now().toString(16)}`,
      title: taskDescription.slice(0, 60),
      agent: "build",
      model: config.model,
      provider: config.provider,
      workdir: process.cwd(),
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
    },
  });

  emit({
    type: "user_message",
    text: taskDescription,
    agent: "build",
  });

  emit({ type: "assistant_start", agent: "build", model: config.model, provider: config.provider });

  emit({ type: "status", text: `model: ${config.model}  provider: ${config.provider}` });

  let worktreePath = process.cwd();
  if (!hasGit) {
    emit({ type: "status", text: "no git — working directly" });
  }

  emit({ type: "status", text: "building..." });

  const taskId = `tsk_${Date.now().toString(16)}`;
  const router = SubagentRouter.withProvider(provider, worktreePath, config.model);

  let result;
  try {
    result = await router.dispatch("build", {
      taskId, stepId: "execute", description: taskDescription, worktreePath,
    });
  } catch (e) {
    emit({ type: "error", text: (e as Error).message });
    return;
  }

  if (result.status !== "pass") {
    emit({ type: "status", text: "retrying..." });
    result = await router.dispatch("build", {
      taskId, stepId: "retry",
      description: `Fix: ${result.evidence}. Task: ${taskDescription}`,
      worktreePath,
    });
  }

  emit({ type: "stream", text: result.evidence.slice(0, 500) });

  const tokensIn = result.tokensIn ?? 0;
  const tokensOut = result.tokensOut ?? 0;

  emit({ type: "tokens", tokensIn, tokensOut });

  emit({
    type: "done",
    tokensIn,
    tokensOut,
    duration: Math.round(Date.now() - startTime),
  });

  if (hasGit) {
    emit({ type: "status", text: `merge: promyra merge ${taskId}` });
  }
}

export function formatCompletionMessage(taskId: string, _plan: Plan, _worktreePath: string): string {
  return `✓ promyra: task ${taskId} completed. Run 'promyra merge ${taskId}' to inspect.`;
}
