import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { listSkills, loadPrompt } from "@promyra/skill-bundle";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_BUNDLE_ROOT = join(__dirname, "..", "..", "..", "..", "packages", "skill-bundle");

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export async function runChecks(opts: { cwd?: string; skillBundleRoot?: string } = {}): Promise<CheckResult[]> {
  const cwd = opts.cwd ?? process.cwd();
  const skillRoot = opts.skillBundleRoot ?? SKILL_BUNDLE_ROOT;
  const checks: CheckResult[] = [];

  try {
    checks.push({
      name: "git installed",
      ok: true,
      detail: execSync("git --version", { encoding: "utf8" }).trim(),
    });
  } catch (e) {
    checks.push({ name: "git installed", ok: false, detail: (e as Error).message });
  }

  const isRepo = existsSync(join(cwd, ".git"));
  checks.push({
    name: "current dir is a git repo",
    ok: isRepo,
    detail: isRepo ? "yes" : "no — run from inside a repo",
  });

  try {
    const skills = await listSkills(skillRoot);
    const allHaveBody = skills.every(s => s.description.length > 0);
    checks.push({ name: "@promyra/skill-bundle loads", ok: allHaveBody, detail: `${skills.length} skills, all with descriptions` });
  } catch (e) {
    checks.push({ name: "@promyra/skill-bundle loads", ok: false, detail: (e as Error).message });
  }

  try {
    const prompt = await loadPrompt(skillRoot);
    checks.push({ name: "default system prompt", ok: prompt.length > 0, detail: `${prompt.length} chars` });
  } catch (e) {
    checks.push({ name: "default system prompt", ok: false, detail: (e as Error).message });
  }

  return checks;
}

export function formatCheckResults(results: CheckResult[]): string {
  const lines: string[] = [];
  lines.push("\npromyra doctor:\n");
  for (const c of results) {
    lines.push(`  ${c.ok ? "✓" : "✗"} ${c.name} — ${c.detail}`);
  }
  const allOk = results.every(c => c.ok);
  lines.push(`\n${allOk ? "All checks passed." : "Some checks failed."}`);
  return lines.join("\n") + "\n";
}

export async function doctor(): Promise<void> {
  const results = await runChecks();
  process.stdout.write(formatCheckResults(results));
  const allOk = results.every(c => c.ok);
  process.exit(allOk ? 0 : 1);
}
