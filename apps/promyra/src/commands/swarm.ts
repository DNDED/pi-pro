import { SubagentRouter } from "@promyra/subagent";
import { loadConfig, getApiKey, createProvider } from "@promyra/provider";
import { LlmWorker, Role } from "@promyra/subagent";
import { createBashTool, createReadTool, createEditTool, createWriteTool, createGrepTool, createGlobTool, createWebfetchTool } from "@promyra/tools";

const AGENT_ROLES = [
  "build",
  "test-runner",
  "code-reviewer",
  "security-auditor",
  "planner",
  "researcher",
] as const;

type SwarmRole = typeof AGENT_ROLES[number];

interface SwarmTask {
  role: SwarmRole;
  goal: string;
}

interface SwarmResult {
  role: SwarmRole;
  goal: string;
  status: string;
  evidence: string;
  tokensIn: number;
  tokensOut: number;
}

async function dispatchSwarm(
  tasks: SwarmTask[],
  apiKey: string,
  workdir: string,
): Promise<SwarmResult[]> {
  const capped = tasks.slice(0, 10);
  if (tasks.length > 10) {
    console.log(`  capping at 10 subagents (${tasks.length} requested)`);
  }

  const provider = createProvider({ apiKey });
  const results: Promise<SwarmResult>[] = [];

  for (const task of capped) {
    const result = (async () => {
      const router = SubagentRouter.withProvider(provider, workdir, "minimax-m3");
      const rr = await router.dispatch(task.role, {
        taskId: `swarm-${Date.now()}`,
        stepId: task.role,
        description: task.goal,
        worktreePath: workdir,
      });
      return {
        role: task.role,
        goal: task.goal,
        status: rr.status,
        evidence: rr.evidence,
        tokensIn: rr.tokensIn,
        tokensOut: rr.tokensOut,
      };
    })();
    results.push(result);
  }

  return Promise.all(results);
}

export async function swarmGoal(goal: string, workdir: string = process.cwd()) {
  const config = await loadConfig();
  const apiKey = await getApiKey(config.provider);
  if (!apiKey) { console.error("No API key configured."); process.exit(1); }

  console.log(`\n🔥 SWARM: ${goal}\n`);

  const tasks: SwarmTask[] = [
    { role: "researcher", goal: `Research and analyze: ${goal}. Read relevant files and report findings.` },
    { role: "planner", goal: `Create implementation plan for: ${goal}. List files to modify, changes to make, verification steps.` },
    { role: "build", goal: `Implement: ${goal}. Write code, run tests.` },
    { role: "test-runner", goal: `Verify: ${goal}. Run all tests, report pass/fail.` },
    { role: "code-reviewer", goal: `Review changes for: ${goal}. Check quality, style, edge cases.` },
    { role: "security-auditor", goal: `Audit changes for: ${goal}. Find secrets, injection vectors, unsafe code.` },
  ];

  const results = await dispatchSwarm(tasks, apiKey, workdir);

  console.log("═══════════════════════════════════════");
  console.log("  SWARM RESULTS");
  console.log("═══════════════════════════════════════\n");

  let passCount = 0;
  for (const r of results) {
    const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "~";
    console.log(`${icon} ${r.role.padEnd(16)} | ${r.evidence.slice(0, 80)}`);
    if (r.status === "pass") passCount++;
  }

  console.log(`\n${passCount}/${results.length} agents passed`);
  console.log(`total tokens: ${results.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0)}`);
}

export async function swarmSearch(query: string, workdir: string = process.cwd()) {
  const results: SwarmTask[] = [
    { role: "researcher", goal: `Search the codebase for: ${query}. Read all matching files and report what you found.` },
  ];

  const config = await loadConfig();
  const apiKey = await getApiKey(config.provider);
  if (!apiKey) { console.error("No API key configured."); process.exit(1); }

  console.log(`\n🔍 SEARCH: ${query}\n`);
  const r = await dispatchSwarm(results, apiKey, workdir);
  console.log(r[0].evidence);
}

export async function swarmAudit(workdir: string = process.cwd()) {
  const results: SwarmTask[] = [
    { role: "security-auditor", goal: "Audit the entire codebase for security issues: hardcoded secrets, SQL injection, XSS, path traversal, unsafe shell commands, missing auth." },
    { role: "code-reviewer", goal: "Review the codebase for quality issues: naming, error handling, edge cases, maintainability." },
  ];

  const config = await loadConfig();
  const apiKey = await getApiKey(config.provider);
  if (!apiKey) { console.error("No API key configured."); process.exit(1); }

  console.log(`\n🛡 AUDIT\n`);
  const r = await dispatchSwarm(results, apiKey, workdir);
  for (const rr of r) {
    console.log(`\n### ${rr.role}\n${rr.evidence}`);
  }
}

export async function swarmReview(workdir: string = process.cwd()) {
  const results: SwarmTask[] = [
    { role: "code-reviewer", goal: "Review all recent changes. Score quality on: idiomatic patterns, efficiency, safety, maintainability, edge cases. List specific issues with file:line." },
  ];

  const config = await loadConfig();
  const apiKey = await getApiKey(config.provider);
  if (!apiKey) { console.error("No API key configured."); process.exit(1); }

  console.log(`\n📝 REVIEW\n`);
  const r = await dispatchSwarm(results, apiKey, workdir);
  console.log(r[0].evidence);
}
