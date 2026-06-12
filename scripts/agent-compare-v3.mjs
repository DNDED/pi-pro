#!/usr/bin/env node
// Agent Comparison v3: Clean, bounded, incremental
// 4 tasks x 2 runs x 2 agents x 2 modes = 32 calls max

import { mkdtemp, cp, rm, readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const OPENCODE = "/home/trader/.npm-global/lib/node_modules/opencode-ai/node_modules/opencode-linux-x64/bin/opencode";
const PROMYRA = "/home/trader/Developer/pi-pro";
const FIXTURES = join(PROMYRA, "bench/fixtures");
const KEY = "sk-lHIIYh7XEReGbuycI5Of1of1tQEeAX61s0y8WsnW27ui5aso3su5YtnYwhOU8qxH";
const LOG = join(PROMYRA, "docs/comparison-v3.jsonl");
const TIMEOUT_OC = 90000;

const TASKS = [
  { id: "refactor-helper", fixture: "tiny-express", prompt: "Refactor: extract the duplicated 'parseUserInput' helper into src/utils/parse-input.ts. Make sure all existing tests still pass." },
  { id: "fix-bug-auth", fixture: "tiny-express", prompt: "Fix bug: the /api/users endpoint leaks password hashes. Strip them before returning. Make sure all existing tests still pass." },
  { id: "add-validation", fixture: "tiny-express", prompt: "Add input validation to the /api/parse-input endpoint: reject inputs longer than 1000 chars, return 400 with { error: 'input too long' }. Add a test for this in test.js." },
  { id: "add-modulo", fixture: "tiny-cli", prompt: "Add a modulo(a, b) function to src/calc.py and add a test for it in test_calc.py. Make sure all existing tests still pass." },
];

async function log(line) {
  console.log(line);
  await appendFile(LOG, line + "\n");
}

function testPass(workdir, fixture) {
  const cmd = fixture === "tiny-cli" ? "python3 -m pytest test_calc.py -q 2>&1" : "node test.js";
  try {
    const out = execSync(cmd, { cwd: workdir, timeout: 30000, encoding: "utf8" });
    const m = out.match(/# fail (\d+)/);
    return m ? m[1] === "0" : out.includes("# fail") ? false : true;
  } catch (e) {
    const out = (e.stdout ?? "") + (e.stderr ?? "");
    const m = out.match(/# fail (\d+)/);
    if (m && m[1] === "0") return true;
    if (out.includes("ok") && out.includes("#") && !out.includes("# fail")) return true;
    return false;
  }
}

async function setupFixture(fixture) {
  const wd = await mkdtemp(join(tmpdir(), `fxt-${fixture}-`));
  await cp(join(FIXTURES, fixture), wd, { recursive: true, filter: s => !s.includes("node_modules") && !s.includes(".git") });
  if (fixture === "tiny-express") execSync("npm install --no-audit --no-fund --silent 2>&1", { cwd: wd, timeout: 60000 });
  return wd;
}

async function freshCopy(base) {
  const f = await mkdtemp(join(tmpdir(), "run-"));
  await cp(base, f, { recursive: true });
  return f;
}

async function runPromyra(baseWd, task, mode, skillsContent) {
  const { LlmBenchRunner } = await import(join(PROMYRA, "bench/dist/src/llm-bench-runner.js"));
  const { OpenCodeGoProvider } = await import(join(PROMYRA, "packages/provider/dist/opencode-go.js"));
  const wr = await mkdtemp(join(tmpdir(), "pi-"));
  const prov = new OpenCodeGoProvider({ apiKey: KEY, model: "minimax-m3" });
  const opts = { workspaceRoot: wr, model: "minimax-m3", bootstrapDeps: true };
  if (mode === "parity" && skillsContent) opts.systemPromptPrefix = skillsContent;

  const runner = new LlmBenchRunner(prov, opts);
  const bt = { id: task.id, fixture: task.fixture, description: task.prompt, expected: { testsPass: true } };

  const t0 = Date.now();
  const result = await runner.runOne(bt);
  const wall = Date.now() - t0;
  const pass = testPass(result.fixtureCopyPath, task.fixture);
  await rm(wr, { recursive: true, force: true });
  return { pass, tokensIn: result.tokensIn, tokensOut: result.tokensOut, wallMs: wall, error: result.error || null };
}

async function runOpenCode(baseWd, task, mode) {
  const wd = await freshCopy(baseWd);
  const env = { ...process.env, OPENCODE_GO_API_KEY: KEY };

  if (mode === "sandbox") {
    const cd = await mkdtemp(join(tmpdir(), "oc-sb-"));
    await writeFile(join(cd, "opencode.jsonc"), JSON.stringify({ provider: { "opencode-go": { apiKey: KEY, models: { "minimax-m3": {} } } } }));
    env.OPENCODE_CONFIG_DIR = cd;
    env.OPENCODE_DISABLE_EXTERNAL_SKILLS = "1";
    env.OPENCODE_DISABLE_PROJECT_CONFIG = "1";
    env.OPENCODE_DISABLE_DEFAULT_PLUGINS = "1";
    env.OPENCODE_DISABLE_CLAUDE_CODE_PROMPT = "1";
    env.OPENCODE_DISABLE_CLAUDE_CODE_SKILLS = "1";
    env.OPENCODE_PURE = "1";
  }

  const p = task.prompt.replace(/"/g, '\\"');
  const t0 = Date.now();
  let pass = false, err = null;
  try {
    execSync(`${OPENCODE} run -m opencode-go/minimax-m3 --dangerously-skip-permissions --dir "${wd}" "${p}"`, { timeout: TIMEOUT_OC, encoding: "utf8", env });
  } catch (e) { err = (e.message || "").slice(0, 100); }
  const wall = Date.now() - t0;
  pass = testPass(wd, task.fixture);
  await rm(wd, { recursive: true, force: true });
  return { pass, wallMs: wall, error: err };
}

async function loadSkills() {
  const sd = "/home/trader/.config/opencode/skills";
  let s = "## Skills\n\n";
  for (const n of ["using-superpowers", "test-driven-development", "systematic-debugging", "verification-before-completion", "tdd"]) {
    const f = join(sd, n, "SKILL.md");
    if (existsSync(f)) s += `### ${n}\n${(await readFile(f, "utf8")).slice(0, 1500)}\n\n`;
  }
  return s;
}

async function runMode(mode, skillsContent) {
  await log(`\n=== MODE: ${mode.toUpperCase()} ===`);
  await log(`Time: ${new Date().toISOString()}`);

  const fixtures = {};
  for (const t of TASKS) { if (!fixtures[t.fixture]) fixtures[t.fixture] = await setupFixture(t.fixture); }

  for (const task of TASKS) {
    await log(`\n--- ${task.id} ---`);
    for (let r = 0; r < 2; r++) {
      try {
        const pi = await runPromyra(fixtures[task.fixture], task, mode, skillsContent);
        const oc = await runOpenCode(fixtures[task.fixture], task, mode);
        await log(JSON.stringify({ mode, task: task.id, run: r + 1, pi: { pass: pi.pass, wall: (pi.wallMs/1000).toFixed(1), in: pi.tokensIn, out: pi.tokensOut }, oc: { pass: oc.pass, wall: (oc.wallMs/1000).toFixed(1), err: oc.error || null } }));
        await log(`  r${r+1}: pi=${pi.pass?"P":"F"}(${(pi.wallMs/1000).toFixed(1)}s,${pi.tokensIn}i) oc=${oc.pass?"P":"F"}(${(oc.wallMs/1000).toFixed(1)}s)`);
      } catch (e) {
        await log(`  r${r+1}: ERR ${e.message?.slice(0,80)}`);
      }
    }
  }

  for (const [, wd] of Object.entries(fixtures)) await rm(wd, { recursive: true, force: true });
}

async function main() {
  await mkdir(join(PROMYRA, "docs"), { recursive: true });
  await writeFile(LOG, `# Agent Comparison v3\nModel: minimax-m3 | Tasks: ${TASKS.length} | Runs: 2\nStarted: ${new Date().toISOString()}\n\n`);

  // Kill orphans
  try { execSync("pkill -9 -f 'opencode-linux-x64' 2>/dev/null; pkill -9 -f '/bin/opencode' 2>/dev/null"); } catch {}

  // Phase 1: Sandbox
  await runMode("sandbox", null);

  // Phase 2: Parity
  const skills = await loadSkills();
  await log(`\nLoaded skills: ${skills.length} chars`);
  await runMode("parity", skills);

  await log(`\nDone: ${new Date().toISOString()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
