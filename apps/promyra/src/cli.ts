import { Command } from "commander";
import { loadConfig } from "@promyra/provider";
import { resume } from "./commands/resume.js";
import { replay } from "./commands/replay.js";
import { runMerge } from "./commands/merge.js";
import { doctor } from "./commands/doctor.js";
import { config } from "./commands/config.js";
import { benchCommand } from "./commands/bench.js";

const VERSION = "0.8.0";

async function launchTui(initialTask?: string): Promise<void> {
  process.stderr.write(`\x1b[2m[promyra v${VERSION}] starting TUI...\x1b[0m\r\n`);
  try {
    const { render } = await import("ink");
    const React = await import("react");
    const { App } = await import("@promyra/tui-pro");

    const cfg = await loadConfig().catch(() => ({ provider: "opencode-go", model: "minimax-m3" }));

    process.stdin.resume();

    const instance = render(React.createElement(App, {
      initialTask,
      workdir: process.cwd(),
      model: cfg.model,
    }));
    await instance.waitUntilExit();
  } catch (e) {
    process.stderr.write(`\x1b[31m[promyra] TUI failed: ${(e as Error).message}\x1b[0m\r\n`);
    process.stderr.write(`\x1b[2mFalling back to text mode. Run with --plain to skip the TUI.\x1b[0m\r\n`);
    if (initialTask) {
      await launchText(initialTask);
    } else {
      console.log("usage: promyra \"<task>\"");
      console.log("       promyra --plain \"<task>\"");
      console.log("       promyra --help");
    }
  }
}

async function launchText(task: string): Promise<void> {
  const { onEvent } = await import("@promyra/tui-pro");
  const unsub = onEvent((event) => {
    if (event.type === "status") console.log("  " + event.text);
    if (event.type === "stream") process.stdout.write(event.text || "");
    if (event.type === "error") console.error("\n  ✗ " + event.text);
    if (event.type === "done") console.log(`\n  ✓ done · ${event.tokensIn}↗ ${event.tokensOut}↘`);
    if (event.type === "tool_call") console.log("  " + event.tool + " " + (event.args ? JSON.stringify(event.args).slice(0, 40) : ""));
  });

  const { start } = await import("./commands/start.js");
  await start(task);
  unsub();
}

async function printEnv(): Promise<void> {
  console.log(`promyra v${VERSION}`);
  console.log("─".repeat(40));
  console.log(`  stdout.isTTY: ${process.stdout.isTTY}`);
  console.log(`  stdin.isTTY:  ${process.stdin.isTTY}`);
  console.log(`  TERM:         ${process.env.TERM ?? "(unset)"}`);
  console.log(`  COLUMNS:      ${process.stdout.columns ?? "(unknown)"}`);
  console.log(`  cwd:          ${process.cwd()}`);
  console.log(`  node:         ${process.version}`);
  try {
    const cfg = await loadConfig();
    console.log(`  config:       ${cfg.provider} / ${cfg.model}${cfg.baseUrl ? ` @ ${cfg.baseUrl}` : ""}`);
  } catch (e) {
    console.log(`  config:       error: ${(e as Error).message}`);
  }
}

export async function main(): Promise<void> {
  const hasArgs = process.argv.length > 2;

  if (hasArgs) {
    const firstArg = process.argv[2];

    if (firstArg === "--check" || firstArg === "--env" || firstArg === "--debug-env") {
      await printEnv();
      return;
    }

    if (firstArg === "bench" || firstArg === "doctor" || firstArg === "config" ||
        firstArg === "merge" || firstArg === "resume" || firstArg === "replay" ||
        firstArg === "start" || firstArg === "goal" || firstArg === "search" ||
        firstArg === "help" ||
        firstArg === "-h" || firstArg === "--help" || firstArg === "-V" ||
        firstArg === "--version") {
      runCommander();
      return;
    }

    if (firstArg === "--plain" || firstArg === "-p") {
      const task = process.argv.slice(3).join(" ");
      await launchText(task || "interactive session");
      return;
    }

    if (process.stdout.isTTY) {
      const task = process.argv.slice(2).join(" ");
      await launchTui(task);
      return;
    }

    console.error("promyra: not running in a TTY (stdout.isTTY is false).");
    console.error("  Run from a real terminal, or use 'promyra --plain \"<task>\"' for text mode.");
    process.exit(1);
  }

  if (process.stdout.isTTY) {
    await launchTui();
    return;
  }

  console.error("promyra: not running in a TTY (stdout.isTTY is false).");
  console.error("  Run from a real terminal, or use 'promyra --plain \"<task>\"' for text mode.");
  process.exit(1);
}

function runCommander(): void {
  const program = new Command();
  program
    .name("promyra")
    .description("coding agent · run 'promyra' to start")
    .version(VERSION);

  program
    .command("start [task...]")
    .description("start a coding task")
    .action(async (task: string[]) => {
      const { start } = await import("./commands/start.js");
      await start(task.join(" "));
    });

  program
    .command("bench")
    .description("run benchmark")
    .option("-p, --parallel", "run in parallel")
    .option("-c, --concurrency <n>", "max concurrent")
    .option("-m, --model <id>", "model to use")
    .option("--json", "JSON output")
    .option("--pipeline", "use multi-stage pipeline")
    .option("--model-map <json>", "difficulty→model mapping")
    .action(async (opts) => {
      await benchCommand({ parallel: opts.parallel, concurrency: opts.concurrency, model: opts.model, json: opts.json, modelMap: opts.modelMap, pipeline: opts.pipeline });
    });

  program.command("resume [taskId]").description("resume a task").action(async (taskId?: string) => resume(taskId));
  program.command("replay <taskId>").description("replay a session").action(async (taskId: string) => replay(taskId));
  program.command("merge <taskId>").description("open a PR").action(async (taskId: string) => runMerge(taskId));
  program.command("doctor").description("check system").action(async () => doctor());
  program.command("config [action] [key] [value]").description("manage config").action(async (action?: string, key?: string, value?: string) => config(action, key, value));
  program.command("help").description("show help").action(() => program.help());

  program.command("goal <description>").description("swarm agents").option("-d, --dir <path>", "workdir").action(async (desc, opts) => {
    const { swarmGoal } = await import("./commands/swarm.js");
    await swarmGoal(desc, opts.dir);
  });

  program.command("search <query>").description("search codebase").option("-d, --dir <path>", "workdir").action(async (query, opts) => {
    const { swarmSearch } = await import("./commands/swarm.js");
    await swarmSearch(query, opts.dir);
  });

  program.command("audit").description("security audit").option("-d, --dir <path>", "workdir").action(async (opts) => {
    const { swarmAudit } = await import("./commands/swarm.js");
    await swarmAudit(opts.dir);
  });

  program.command("review").description("code review").option("-d, --dir <path>", "workdir").action(async (opts) => {
    const { swarmReview } = await import("./commands/swarm.js");
    await swarmReview(opts.dir);
  });

  program.parse();
}
