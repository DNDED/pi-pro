import { execSync } from "node:child_process";

export interface TestFailure {
  type: "syntax" | "assertion" | "import" | "timeout" | "undefined_ref" | "port_conflict" | "unknown";
  file?: string;
  line?: number;
  message: string;
  suggestion: string;
}

export function analyzeTestFailure(output: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const lines = output.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes("EADDRINUSE")) {
      failures.push({
        type: "port_conflict",
        message: line,
        suggestion: "The server is listening on port 3000 during import. Use `if (import.meta.url === ...)` to only start the server when run directly, not when imported.",
      });
      continue;
    }

    if (line.includes("SyntaxError") || line.includes("Unexpected token")) {
      failures.push({
        type: "syntax",
        message: line,
        suggestion: "Check for missing brackets, unclosed strings, or invalid syntax at the indicated position.",
      });
      continue;
    }

    if (line.includes("Cannot find module") || line.includes("ERR_MODULE_NOT_FOUND") || line.includes("Cannot find package")) {
      const file = line.match(/'(.*?)'/)?.[1];
      failures.push({
        type: "import",
        file,
        message: line,
        suggestion: file ? `Module "${file}" not found. Check the import path and make sure the file exists.` : "Module not found. Check your import paths.",
      });
      continue;
    }

    if (line.includes("AssertionError") || line.includes("Expected values") || line.includes("not ok")) {
      failures.push({
        type: "assertion",
        message: line,
        suggestion: "The test assertion failed. Compare expected vs actual values and fix the code to produce the expected output.",
      });
      continue;
    }

    if (line.includes("is not defined") || line.includes("Cannot read properties of undefined")) {
      failures.push({
        type: "undefined_ref",
        message: line,
        suggestion: "A variable or property is undefined. Add a null check or define the variable before using it.",
      });
    }
  }

  return failures.length > 0 ? failures : [{ type: "unknown", message: output.slice(0, 300), suggestion: "Review the output carefully and fix the errors." }];
}

export function formatFailuresForLLM(failures: TestFailure[]): string {
  if (failures.length === 0) return "";

  const parts = ["## Test Failures Found", ""];
  for (let i = 0; i < failures.length; i++) {
    const f = failures[i];
    parts.push(`### Failure ${i + 1}: ${f.type}`);
    if (f.file) parts.push(`File: ${f.file}`);
    if (f.line) parts.push(`Line: ${f.line}`);
    parts.push(`\`\`\`\n${f.message.slice(0, 500)}\n\`\`\``);
    parts.push(`Fix: ${f.suggestion}`);
    parts.push("");
  }
  return parts.join("\n");
}

export function runTest(wd: string, testCmd: string): { passed: boolean; output: string; failures: TestFailure[] } {
  try {
    const output = execSync(testCmd, { cwd: wd, timeout: 30000, encoding: "utf8" });
    const fm = output.match(/# fail (\d+)/);
    const passed = !fm || fm[1] === "0";
    return { passed, output, failures: passed ? [] : analyzeTestFailure(output) };
  } catch (e) {
    const output = ((e as { stdout?: string; stderr?: string }).stdout ?? "") + ((e as { stdout?: string; stderr?: string }).stderr ?? "");
    const fm = output.match(/# fail (\d+)/);
    const passed = fm ? fm[1] === "0" : false;
    return { passed, output, failures: passed ? [] : analyzeTestFailure(output) };
  }
}
