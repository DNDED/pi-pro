import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = ".pi-pro/worktrees";

export interface WorktreeInfo {
  taskId: string;
  branch: string;
  path: string;
}

export class WorktreeStore {
  constructor(private readonly rootDir: string = process.cwd()) {}

  private worktreePath(taskId: string): string {
    return join(this.rootDir, BASE, taskId);
  }

  private branchName(taskId: string): string {
    return `pi-pro/${taskId.replace(/^tsk_/, "")}`;
  }

  create(taskId: string): WorktreeInfo {
    const branch = this.branchName(taskId);
    const path = this.worktreePath(taskId);
    mkdirSync(join(this.rootDir, BASE), { recursive: true });

    if (existsSync(path)) {
      throw new Error(`Worktree already exists: ${path}`);
    }

    this.run(["worktree", "add", "-b", branch, path]);
    return { taskId, branch, path };
  }

  remove(taskId: string): void {
    const path = this.worktreePath(taskId);
    if (!existsSync(path)) return;
    try {
      this.run(["worktree", "remove", "--force", path]);
    } catch {
      // fall through to filesystem cleanup
    }
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  }

  list(): WorktreeInfo[] {
    const out = this.run(["worktree", "list", "--porcelain"]);
    return parsePorcelain(out, this.rootDir);
  }

  private run(args: string[]): string {
    return execSync(`git ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`, {
      cwd: this.rootDir,
      encoding: "utf8",
    }).trim();
  }
}

function parsePorcelain(out: string, rootDir: string): WorktreeInfo[] {
  const blocks = out.split("\n\n");
  const results: WorktreeInfo[] = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    const pathLine = block.split("\n").find(l => l.startsWith("worktree "));
    const branchLine = block.split("\n").find(l => l.startsWith("branch "));
    if (!pathLine || !branchLine) continue;
    const path = pathLine.replace(/^worktree /, "").trim();
    if (!path.startsWith(join(rootDir, BASE))) continue;
    const branch = branchLine.replace(/^branch /, "").replace(/^refs\/heads\//, "").trim();
    const id = path.split("/").pop() ?? "";
    results.push({ taskId: id, branch, path });
  }
  return results;
}
