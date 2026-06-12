import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isSafeBashCommand } from "./policy.js";

const execFileP = promisify(execFile);

export interface BashOpts {
  cwd?: string;
  timeoutMs?: number;
}

export interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  summary: string;
}

export interface BashTool {
  name: "bash";
  description: string;
  input_schema: { type: "object"; properties: { cmd: { type: "string" } }; required: ["cmd"] };
  execute(input: { cmd: string }): Promise<BashResult>;
}

function formatBashOutput(result: Omit<BashResult, 'summary'>): BashResult {
  const combined = (result.stdout + "\n" + result.stderr).trim();

  if (result.exitCode === 0) {
    return { ...result, summary: combined.slice(0, 8000) };
  }

  const lines = combined.split("\n");
  const errorLines: string[] = [];
  const assertionLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes("Error:") || trimmed.includes("error:") || trimmed.includes("FAIL")) {
      errorLines.push(trimmed);
    }
    if (trimmed.includes("not ok") || trimmed.includes("assert") || trimmed.includes("expected") || trimmed.includes("actual")) {
      assertionLines.push(trimmed);
    }
  }

  let summary = "";
  if (errorLines.length > 0) {
    summary += "[ERRORS]\n" + errorLines.slice(0, 8).join("\n");
  }
  if (assertionLines.length > 0) {
    summary += "\n\n[TEST FAILURES]\n" + assertionLines.slice(0, 12).join("\n");
  }
  if (!summary) {
    summary = "[OUTPUT (last 20 lines)]\n" + lines.slice(-20).join("\n");
  }
  summary += `\n\n[exit code: ${result.exitCode}]`;

  return { ...result, summary: summary.slice(0, 8000) };
}

export function createBashTool(opts: BashOpts = {}): BashTool {
  const cwd = opts.cwd ?? process.cwd();
  const timeoutMs = opts.timeoutMs ?? 60_000;
  return {
    name: "bash",
    description: "Run a shell command. Dangerous patterns (rm -rf /, curl|sh, etc.) are blocked.",
    input_schema: { type: "object", properties: { cmd: { type: "string" } }, required: ["cmd"] },
    async execute({ cmd }) {
      const violation = isSafeBashCommand(cmd);
      if (violation) throw new Error(violation.message);
      try {
        const { stdout, stderr } = await execFileP("bash", ["-c", cmd], { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
        return formatBashOutput({ stdout, stderr, exitCode: 0 });
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string; code?: number };
        return formatBashOutput({
          stdout: err.stdout ?? "",
          stderr: err.stderr ?? (e as Error).message,
          exitCode: typeof err.code === "number" ? err.code : 1,
        });
      }
    },
  };
}
