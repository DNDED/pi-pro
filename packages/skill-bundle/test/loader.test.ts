import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listSkills, loadSkill, loadPrompt } from "../src/loader.js";

let pkgDir: string;

beforeAll(async () => {
  pkgDir = await mkFixture();
});

afterAll(async () => {
  await rm(pkgDir, { recursive: true, force: true });
});

describe("skill-bundle loader", () => {
  it("lists skills from skills/ directory", async () => {
    const skills = await listSkills(pkgDir);
    expect(skills.map(s => s.name).sort()).toEqual(["test-skill-a", "test-skill-b"]);
  });

  it("loads a single skill body", async () => {
    const skill = await loadSkill("test-skill-a", pkgDir);
    expect(skill).not.toBeNull();
    expect(skill!.body).toContain("hello from a");
  });

  it("returns null for missing skill", async () => {
    const skill = await loadSkill("nope", pkgDir);
    expect(skill).toBeNull();
  });

  it("loads the package prompt", async () => {
    const prompt = await loadPrompt(pkgDir);
    expect(prompt).toContain("plan -> branch -> test -> verify -> PR");
  });
});

async function mkFixture(): Promise<string> {
  const root = join(tmpdir(), `pi-pro-test-${Date.now()}`);
  await mkdir(root, { recursive: true });
  await mkdir(join(root, "src"));
  await mkdir(join(root, "skills", "test-skill-a"), { recursive: true });
  await mkdir(join(root, "skills", "test-skill-b"), { recursive: true });
  await writeFile(
    join(root, "skills", "test-skill-a", "SKILL.md"),
    "---\nname: test-skill-a\ndescription: First test skill\n---\nhello from a\n"
  );
  await writeFile(
    join(root, "skills", "test-skill-b", "SKILL.md"),
    "---\nname: test-skill-b\ndescription: Second test skill\n---\nhello from b\n"
  );
  await writeFile(join(root, "prompt.md"), "Default prompt: plan -> branch -> test -> verify -> PR\n");
  return root;
}
