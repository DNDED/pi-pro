import { readFile, readdir, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

export interface SkillMeta {
  name: string;
  description: string;
  path: string;
}

export interface Skill extends SkillMeta {
  body: string;
}

const SKILLS_DIR = "skills";
const PROMPT_FILE = "prompt.md";
const GLOBAL_SKILLS_DIR = join(process.env.HOME ?? "~", ".pi", "agent", "skills", "promyra");

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

export async function listSkills(packageDir: string = packageRoot()): Promise<SkillMeta[]> {
  const dir = join(packageDir, SKILLS_DIR);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const out: SkillMeta[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const file = join(dir, e.name, "SKILL.md");
    if (!existsSync(file)) continue;
    const raw = await readFile(file, "utf8");
    const parsed = matter(raw);
    out.push({
      name: parsed.data.name ?? e.name,
      description: parsed.data.description ?? "",
      path: file,
    });
  }
  return out;
}

export async function loadSkill(name: string, packageDir: string = packageRoot()): Promise<Skill | null> {
  const file = join(packageDir, SKILLS_DIR, name, "SKILL.md");
  if (!existsSync(file)) return null;
  const raw = await readFile(file, "utf8");
  const parsed = matter(raw);
  return {
    name: parsed.data.name ?? name,
    description: parsed.data.description ?? "",
    path: file,
    body: parsed.content,
  };
}

export async function loadPrompt(packageDir: string = packageRoot()): Promise<string> {
  const file = join(packageDir, PROMPT_FILE);
  if (!existsSync(file)) return "";
  return readFile(file, "utf8");
}

export async function installGlobally(packageDir: string = packageRoot()): Promise<{ installed: number; dest: string }> {
  await mkdir(GLOBAL_SKILLS_DIR, { recursive: true });
  const srcDir = join(packageDir, SKILLS_DIR);
  const entries = await readdir(srcDir, { withFileTypes: true });
  let installed = 0;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const srcFile = join(srcDir, e.name, "SKILL.md");
    if (!existsSync(srcFile)) continue;
    const destDir = join(GLOBAL_SKILLS_DIR, e.name);
    await mkdir(destDir, { recursive: true });
    await copyFile(srcFile, join(destDir, "SKILL.md"));
    installed++;
  }
  return { installed, dest: GLOBAL_SKILLS_DIR };
}
