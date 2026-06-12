// Agent Comparison v2: True Sandbox + Parity
// Optimized: pre-install deps, shorter timeouts, background-safe

import { mkdtemp, cp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const OPENCODE = "/home/trader/.npm-global/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin/opencode";
const PROMYRA_ROOT = "/home/trader/Developer/pi-pro";
const FIXTURES_DIR = join(PROMYRA_ROOT, "bench/fixtures");
const API_KEY = "sk-lHIIYh7XEReGbuycI5Of1of1tQEeAX61s0y8WsnW27ui5aso3su5YtnYwhOU8qxH";
const RESULTS_FILE = "/home/trader/Developer/pi-pro/docs/agent-comparison-v0.4-raw.json";

const TASKS = [
  { id: "refactor-helper", fixture: "tiny-express", prompt: "Refactor: extract the duplicated 'parseUserInput' helper into src/utils/parse-input.ts. Make sure all existing tests still pass." },
  { id: "add-healthz", fixture: "tiny-express", prompt: "Add a /healthz endpoint that returns { status: 'ok' } with HTTP 200. Make sure all existing tests still pass." },
  { id: "fix-bug-auth", fixture: "tiny-express", prompt: "Fix bug: the /api/users endpoint leaks password hashes. Strip them before returning. Make sure all existing tests still pass." },
  { id: "add-validation", fixture: "tiny-express", prompt: "Add input validation to the /api/parse-input endpoint: reject inputs longer than 1000 chars, return 400 with { error: 'input too long' }. Add a test for this in test.js." },
  { id: "add-rate-limit", fixture: "tiny-express", prompt: "Add a simple in-memory rate limiter to all GET endpoints: max 5 requests per IP per 10 seconds. Return 429 with { error: 'rate limited' } when exceeded. Add a test." },
  { id: "add-tests-legacy", fixture: "tiny-cli", prompt: "Add tests: write pytest cases for the untested src/calc.py module. Cover all functions and edge cases." },
  { id: "add-modulo-test", fixture: "tiny-cli", prompt: "Add a modulo(a, b) function to src/calc.py and add a test for it. Make sure all existing tests still pass." },
  { id: "security-audit", fixture: "tiny-go-svc", prompt: "Security audit: review the code and report any hardcoded secrets or unsafe shell patterns. List findings with file:line." },
];

// Pre-install once per fixture, cache the installed copies
const fixtureCache = new Map();

async function getFixtureWorkdir(fixture) {
  if (fixtureCache.has(fixture)) return fixtureCache.get(fixture);
  const workdir = await mkdtemp(join(tmpdir(), `cmp-${fixture}-`));
  await cp(join(FIXTURES_DIR, fixture), workdir, { recursive: true, filter: (s) => !s.includes("node_modules") && !s.includes(".git") });
  if (fixture === "tiny-express") {
    execSync("npm install --no-audit --no-fund --silent 2>&1", { cwd: workdir, timeout: 60000 });
  }
  fixtureCache.set(fixture, workdir);
  return workdir;
}

function runTest(workdir, fixture) {
  const cmd = fixture === "tiny-cli" ? "python3 -m pytest test_calc.py -q 2>&1" :
              fixture === "tiny-go-svc" ? "go test ./... 2>&1" :
              "node test.js";
  try {
    const output = execSync(cmd, { cwd: workdir, timeout: 30000, encoding: "utf8" });
    const failMatch = output.match(/# fail (\d+)/);
    return { pass: !failMatch || failMatch[1] === "0", output: output.slice(0, 200) };
  } catch (e) {
    const output = (e.stdout ?? "") + (e.stderr ?? "");
    const failMatch = output.match(/# fail (\d+)/);
    return { pass: failMatch && failMatch[1] === "0", output: output.slice(0, 200) };
  }
}

async function freshCopy(fixture) {
  const baseWorkdir = await getFixtureWorkdir(fixture);
  const fresh = await mkdtemp(join(tmpdir(), `run-${fixture}-`));
  await cp(baseWorkdir, fresh, { recursive: true });
  return fresh;
}

async function runPromyra(task, mode, opencodeSkillsContent) {
  const { LlmBenchRunner } = await import(join(PROMYRA_ROOT, "bench/dist/src/llm-bench-runner.js"));
  const { OpenCodeGoProvider } = await import(join(PROMYRA_ROOT, "packages/provider/dist/opencode-go.js"));

  const workspaceRoot = await mkdtemp(join(tmpdir(), "pi-pro-"));
  const provider = new OpenCodeGoProvider({ apiKey: API_KEY, model: "minimax-m3" });

  const opts = { workspaceRoot, model: "minimax-m3", bootstrapDeps: true };
  if (mode === "parity" && opencodeSkillsContent) {
    opts.systemPromptPrefix = opencodeSkillsContent;
  }

  const runner = new LlmBenchRunner(provider, opts);
  const benchTask = { id: task.id, fixture: task.fixture, description: task.prompt, expected: { testsPass: true } };

  const start = Date.now();
  const result = await runner.runOne(benchTask);
  const wallMs = Date.now() - start;

  const testResult = runTest(result.fixtureCopyPath, task.fixture);
  await rm(workspaceRoot, { recursive: true, force: true });

  return {
    pass: testResult.pass,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    wallMs,
  };
}

async function runOpenCode(task, mode) {
  const workdir = await freshCopy(task.fixture);

  const env = { ...process.env, OPENCODE_GO_API_KEY: API_KEY };

  if (mode === "sandbox") {
    const configDir = await mkdtemp(join(tmpdir(), "oc-sandbox-"));
    await writeFile(join(configDir, "opencode.jsonc"), JSON.stringify({
      provider: { "opencode-go": { apiKey: API_KEY, models: { "minimax-m3": {} } } }
    }));
    env.OPENCODE_CONFIG_DIR = configDir;
    env.OPENCODE_DISABLE_EXTERNAL_SKILLS = "1";
    env.OPENCODE_DISABLE_PROJECT_CONFIG = "1";
    env.OPENCODE_DISABLE_DEFAULT_PLUGINS = "1";
    env.OPENCODE_DISABLE_CLAUDE_CODE_PROMPT = "1";
    env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS = "1";
    env.OPENCODE_PURE = "1";
  }

  const prompt = task.prompt.replace(/"/g, '\\"');
  const start = Date.now();
  let output = "";
  try {
    output = execSync(
      `${OPENCODE} run -m opencode-go/minimax-m3 --dangerously-skip-permissions --dir "${workdir}" "${prompt}"`,
      { timeout: 180000, encoding: "utf8", env }
    );
  } catch (e) {
    output = (e.stdout ?? "") + (e.stderr ?? "");
  }
  const wallMs = Date.now() - start;

  const testResult = runTest(workdir, task.fixture);
  await rm(workdir, { recursive: true, force: true });

  return { pass: testResult.pass, wallMs };
}

async function loadOpencodeSkills() {
  const skillsDir = "/home/trader/.config/opencode/skills";
  const skillNames = ["using-superpowers", "test-driven-development", "systematic-debugging", "verification-before-completion", "tdd"];
  let combined = "## Skills loaded for parity test\n\n";
  for (const name of skillNames) {
    const path = join(skillsDir, name, "SKILL.md");
    if (existsSync(path)) {
      const content = await readFile(path, "utf8");
      combined += `### ${name}\n${content.slice(0, 2000)}\n\n`;
    }
  }
  return combined;
}

function median(arr) {
  const sorted = [...arr].filter(x => x > 0).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

async function runMode(mode, opencodeSkillsContent) {
  log(`\n${"=".repeat(60)}`);
  log(`MODE: ${mode.toUpperCase()}`);
  log("=".repeat(60));

  const results = [];
  for (const task of TASKS) {
    log(`\n--- ${task.id} ---`);
    const runs = [];
    for (let run = 0; run < 3; run++) {
      try {
        const pi = await runPromyra(task, mode, opencodeSkillsContent);
        const oc = await runOpenCode(task, mode);
        runs.push({ run: run + 1, pi, oc });
        log(`  run ${run+1}: pi=${pi.pass?"P":"F"}(${(pi.wallMs/1000).toFixed(1)}s,${pi.tokensIn}in) oc=${oc.pass?"P":"F"}(${(oc.wallMs/1000).toFixed(1)}s)`);
      } catch (e) {
        log(`  run ${run+1}: ERROR ${e.message?.slice(0,80)}`);
        runs.push({ run: run + 1, pi: { pass: false, tokensIn: 0, tokensOut: 0, wallMs: 0 }, oc: { pass: false, wallMs: 0 } });
      }
    }
    results.push({ task: task.id, fixture: task.fixture, runs });
  }
  return results;
}

function summarize(results, label) {
  log(`\n${"=".repeat(60)}`);
  log(`SUMMARY: ${label}`);
  log("=".repeat(60));
  log("Task                  | pi-pro          | opencode        | Winner");
  log("----------------------|-----------------|-----------------|--------");

  let piPasses = 0, ocPasses = 0, piWins = 0, ocWins = 0;

  for (const r of results) {
    const piRuns = r.runs.map(x => x.pi);
    const ocRuns = r.runs.map(x => x.oc);
    const piPC = piRuns.filter(x => x.pass).length;
    const ocPC = ocRuns.filter(x => x.pass).length;
    const piMT = median(piRuns.map(x => x.wallMs));
    const ocMT = median(ocRuns.map(x => x.wallMs));
    const piMI = median(piRuns.map(x => x.tokensIn || 0));

    piPasses += piPC; ocPasses += ocPC;

    let winner;
    if (piPC > ocPC) { piWins++; winner = "pi-pro"; }
    else if (ocPC > piPC) { ocWins++; winner = "opencode"; }
    else if (piMT < ocMT) { winner = "pi-pro (fast)"; }
    else { winner = "opencode (fast)"; }

    log(`${r.task.padEnd(22)}| ${piPC}/3 (${(piMT/1000).toFixed(1)}s) | ${ocPC}/3 (${(ocMT/1000).toFixed(1)}s) | ${winner}`);
  }

  log(`\nTotal: pi-pro ${piPasses}/${results.length*3} | opencode ${ocPasses}/${results.length*3}`);
  log(`Task wins: pi-pro ${piWins}, opencode ${ocWins}`);
  return { piPasses, ocPasses, total: results.length * 3, piWins, ocWins };
}

function log(msg) {
  console.log(msg);
  appendFileSync(RESULTS_FILE, msg + "\n");
}

import { appendFileSync } from "node:fs";

async function main() {
  await mkdir(join(PROMYRA_ROOT, "docs"), { recursive: true });
  await writeFile(RESULTS_FILE, `=== Agent Comparison v2 ===\nModel: minimax-m3 | Tasks: ${TASKS.length} | Runs: 3\nStarted: ${new Date().toISOString()}\n\n`);

  log("Pre-installing fixtures...");
  for (const f of ["tiny-express", "tiny-cli", "tiny-go-svc"]) {
    await getFixtureWorkdir(f);
  }
  log("Fixtures ready.\n");

  // Phase 1: Sandbox
  const sandboxResults = await runMode("sandbox", null);
  const sandboxSummary = summarize(sandboxResults, "SANDBOX");

  // Phase 2: Parity
  log("\nLoading opencode skills...");
  const opencodeSkills = await loadOpencodeSkills();
  log(`Loaded ${opencodeSkills.length} chars`);

  const parityResults = await runMode("parity", opencodeSkills);
  const paritySummary = summarize(parityResults, "PARITY");

  // Final
  log(`\n${"=".repeat(60)}`);
  log("FINAL");
  log("=".repeat(60));
  log(`Sandbox: pi-pro ${sandboxSummary.piPasses}/${sandboxSummary.total} | opencode ${sandboxSummary.ocPasses}/${sandboxSummary.total}`);
  log(`Parity:  pi-pro ${paritySummary.piPasses}/${paritySummary.total} | opencode ${paritySummary.ocPasses}/${paritySummary.total}`);
  log(`Wins - Sandbox: pi ${sandboxSummary.piWins} oc ${sandboxSummary.ocWins}`);
  log(`Wins - Parity:  pi ${paritySummary.piWins} oc ${paritySummary.ocWins}`);

  await writeFile(RESULTS_FILE.replace("-raw.json", "-data.json"), JSON.stringify({
    sandbox: { results: sandboxResults, summary: sandboxSummary },
    parity: { results: parityResults, summary: paritySummary },
  }, null, 2));
  log(`\nData written to ${RESULTS_FILE.replace("-raw.json", "-data.json")}`);
  log(`Done: ${new Date().toISOString()}`);
}

main().catch(e => { log(`FATAL: ${e.message}\n${e.stack}`); process.exit(1); });
