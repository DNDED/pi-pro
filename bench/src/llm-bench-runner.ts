import { execSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Provider } from "@pi/provider";
import { LlmWorker } from "@pi/subagent";
import { createBashTool, createEditTool, createGlobTool, createGrepTool, createReadTool, createWebfetchTool, createWriteTool } from "@pi/tools";
import { TASKS, BenchTask } from "../tasks/index.js";

export interface BenchResult {
  taskId: string;
  fixture: string;
  description: string;
  completed: boolean;
  tokensIn: number;
  tokensOut: number;
  wallMs: number;
  testCommand: string;
  testExitCode: number;
  testOutput: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
  fixtureCopyPath: string;
}

export interface BenchSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  tokensIn: number;
  tokensOut: number;
  wallMs: number;
  results: BenchResult[];
}

export interface LlmBenchRunnerOpts {
  workspaceRoot: string;
  maxIterations?: number;
  benchFixturesRel?: string;
  bootstrapDeps?: boolean;
  model?: string;
}

const FIXTURES_REL_DEFAULT = "bench/fixtures";

function findFixturesDir(opts: LlmBenchRunnerOpts): string {
  const cwd = process.cwd();
  const candidates = [
    opts.benchFixturesRel && existsSync(opts.benchFixturesRel) ? resolve(opts.benchFixturesRel) : null,
    join(cwd, opts.benchFixturesRel ?? FIXTURES_REL_DEFAULT),
    join(cwd, "fixtures"),
    join(cwd, "..", "fixtures"),
    join(cwd, "..", "..", "fixtures"),
    join(cwd, "..", "..", "..", "fixtures"),
  ].filter((p): p is string => p !== null);
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(`Could not locate bench/fixtures from ${cwd} (tried ${candidates.length} paths)`);
}

function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "venv" || entry.name === ".git") continue;
      copyDir(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

const INSTALL_HINTS: Record<string, string> = {
  "tiny-express": "cd into the fixture and run: npm install",
  "tiny-cli": "install pytest with: apt install python3-pytest  OR  pip install pytest",
  "tiny-go-svc": "install the go toolchain from https://go.dev/dl/ and ensure 'go' is in your PATH",
};

export function installHintFor(fixture: string): string {
  return INSTALL_HINTS[fixture] ?? `install dependencies for fixture '${fixture}' manually`;
}

function bootstrapDeps(fixtureCopy: string, fixture: string): { bootstrapped: boolean; message?: string } {
  switch (fixture) {
    case "tiny-express": {
      const pkg = join(fixtureCopy, "package.json");
      if (!existsSync(pkg)) {
        return { bootstrapped: false, message: `fixture ${fixture}: no package.json. ${INSTALL_HINTS[fixture]}` };
      }
      try {
        execSync("npm install --no-audit --no-fund --silent", { cwd: fixtureCopy, stdio: "pipe", timeout: 120_000 });
        return { bootstrapped: true };
      } catch (e) {
        const detail = (e as Error).message;
        return { bootstrapped: false, message: `fixture ${fixture}: npm install failed (${detail}). ${INSTALL_HINTS[fixture]}` };
      }
    }
    case "tiny-cli": {
      try {
        execSync("python3 -m pip install --user pytest 2>&1 || python3 -m pip install pytest 2>&1", { cwd: fixtureCopy, stdio: "pipe", timeout: 60_000 });
        return { bootstrapped: true };
      } catch (e) {
        const detail = (e as Error).message;
        return { bootstrapped: false, message: `fixture ${fixture}: pytest not available (${detail}). ${INSTALL_HINTS[fixture]}` };
      }
    }
    case "tiny-go-svc":
      return { bootstrapped: false, message: `fixture ${fixture}: ${INSTALL_HINTS[fixture]}` };
    default:
      return { bootstrapped: false, message: `unknown fixture '${fixture}'. ${INSTALL_HINTS[fixture]}` };
  }
}

function testCommandFor(fixture: string): string {
  switch (fixture) {
    case "tiny-express": return "node test.js";
    case "tiny-cli": return "python3 -m pytest test_calc.py -q 2>&1";
    case "tiny-go-svc": return "go test ./... 2>&1";
    default: return "echo 'SKIP: unknown fixture'";
  }
}

export class LlmBenchRunner {
  private readonly fixturesDir: string;

  constructor(
    private readonly provider: Provider,
    private readonly opts: LlmBenchRunnerOpts,
  ) {
    this.fixturesDir = findFixturesDir(opts);
  }

  async runOne(task: BenchTask): Promise<BenchResult> {
    const start = Date.now();
    const fixtureSrc = join(this.fixturesDir, task.fixture);
    if (!existsSync(fixtureSrc)) {
      return this.skipResult(task, `Fixture missing: ${fixtureSrc}`, start);
    }
    const fixtureCopy = join(this.opts.workspaceRoot, `${task.fixture}-run-${task.id}-${Date.now()}`);
    copyDir(fixtureSrc, fixtureCopy);
    const bootstrap = this.opts.bootstrapDeps === false
      ? { bootstrapped: false, message: "deps bootstrap disabled" }
      : bootstrapDeps(fixtureCopy, task.fixture);

    const toolInstances = [
      createBashTool({ cwd: fixtureCopy }) as unknown as never,
      createReadTool({ cwd: fixtureCopy }) as unknown as never,
      createWriteTool({ cwd: fixtureCopy }) as unknown as never,
      createEditTool({ cwd: fixtureCopy }) as unknown as never,
      createGrepTool({ cwd: fixtureCopy }) as unknown as never,
      createGlobTool({ cwd: fixtureCopy }) as unknown as never,
      createWebfetchTool() as unknown as never,
    ];
    const worker = new LlmWorker(this.provider, toolInstances, fixtureCopy, {
      maxIterations: this.opts.maxIterations ?? 12,
      model: this.opts.model,
    });

    let tokensIn = 0;
    let tokensOut = 0;
    let llmError: string | undefined;
    try {
      const result = await worker.run("build", {
        taskId: `bench-${task.id}`,
        stepId: task.id,
        description: task.description,
        worktreePath: fixtureCopy,
      });
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      if (result.status === "blocked") {
        llmError = `LLM blocked: ${result.evidence}`;
      }
    } catch (e) {
      llmError = `LLM error: ${(e as Error).message}`;
    }

    const testCmd = testCommandFor(task.fixture);
    let testExitCode = 0;
    let testOutput = "";
    let execError: string | undefined;
    try {
      testOutput = execSync(testCmd, { cwd: fixtureCopy, encoding: "utf8", timeout: 60_000 });
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      testExitCode = err.status ?? 1;
      testOutput = (err.stdout ?? "") + (err.stderr ?? "");
      execError = `${testCmd} exited with code ${testExitCode}`;
    }

    const skipped = testOutput.includes("SKIP:") || !bootstrap.bootstrapped;
    const skipReason = !bootstrap.bootstrapped
      ? (bootstrap.message ?? "deps bootstrap failed")
      : testOutput.includes("SKIP:") ? (testOutput.match(/SKIP:[^\n]*/)?.[0] ?? "skipped") : undefined;
    const completed = !skipped && testExitCode === 0;

    return {
      taskId: task.id,
      fixture: task.fixture,
      description: task.description,
      completed,
      tokensIn,
      tokensOut,
      wallMs: Date.now() - start,
      testCommand: testCmd,
      testExitCode,
      testOutput: testOutput.slice(-2000),
      error: llmError ?? execError,
      skipped,
      skipReason,
      fixtureCopyPath: fixtureCopy,
    };
  }

  async runAll(filter?: (t: BenchTask) => boolean): Promise<BenchSummary> {
    const tasks = filter ? TASKS.filter(filter) : TASKS;
    const start = Date.now();
    const results: BenchResult[] = [];
    for (const task of tasks) {
      const result = await this.runOne(task);
      results.push(result);
    }
    return this.summarize(results, Date.now() - start);
  }

  async runAllParallel(filter?: (t: BenchTask) => boolean, concurrency?: number): Promise<BenchSummary> {
    const tasks = filter ? TASKS.filter(filter) : TASKS;
    const start = Date.now();
    const limit = concurrency ?? tasks.length;
    const results: BenchResult[] = new Array(tasks.length);
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < tasks.length) {
        const idx = cursor++;
        results[idx] = await this.runOne(tasks[idx]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
    return this.summarize(results, Date.now() - start);
  }

  private summarize(results: BenchResult[], wallMs: number): BenchSummary {
    return {
      total: results.length,
      completed: results.filter(r => r.completed).length,
      failed: results.filter(r => !r.completed && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
      tokensIn: results.reduce((a, r) => a + r.tokensIn, 0),
      tokensOut: results.reduce((a, r) => a + r.tokensOut, 0),
      wallMs,
      results,
    };
  }

  private skipResult(task: BenchTask, reason: string, start: number): BenchResult {
    return {
      taskId: task.id,
      fixture: task.fixture,
      description: task.description,
      completed: false,
      tokensIn: 0,
      tokensOut: 0,
      wallMs: Date.now() - start,
      testCommand: "",
      testExitCode: 0,
      testOutput: reason,
      skipped: true,
      skipReason: reason,
      fixtureCopyPath: "",
    };
  }
}
