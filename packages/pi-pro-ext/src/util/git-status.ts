export type GitFileStatus = "modified" | "untracked" | "staged" | "deleted" | "renamed" | "conflicted" | "typechanged";

export interface GitFile {
  status: GitFileStatus;
  path: string;
  origPath?: string;
}

export interface GitStatusIcons {
  modified: string;
  untracked: string;
  staged: string;
  deleted: string;
  renamed: string;
  conflicted: string;
  typechanged: string;
  ahead: string;
  behind: string;
  diverged: string;
}

export const NERD_FONT_ICONS: GitStatusIcons = {
  modified: "!",
  untracked: "?",
  staged: "+",
  deleted: "✘",
  renamed: "»",
  conflicted: "=",
  typechanged: "T",
  ahead: "↑",
  behind: "↓",
  diverged: "⇕",
};

export const ASCII_ICONS: GitStatusIcons = {
  modified: "!",
  untracked: "?",
  staged: "+",
  deleted: "X",
  renamed: ">",
  conflicted: "=",
  typechanged: "T",
  ahead: "^",
  behind: "v",
  diverged: "<>",
};

export function parsePorcelainLine(line: string): GitFile | null {
  if (!line || line.length < 3) return null;
  const x = line[0] ?? " ";
  const y = line[1] ?? " ";
  const rest = line.slice(3);
  const STATUS_CODES: Record<string, GitFileStatus> = {
    "M": "modified",
    "A": "staged",
    "D": "deleted",
    "R": "renamed",
    "C": "renamed",
    "U": "conflicted",
    "?": "untracked",
    "T": "typechanged",
  };
  let status: GitFileStatus | null = null;
  if (x === "?" && y === "?") {
    status = "untracked";
  } else if (x === "!" && y === "!") {
    return null;
  } else if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
    status = "conflicted";
  } else if (x !== " " && x !== "?") {
    const mapped = STATUS_CODES[x];
    if (mapped) status = mapped;
  } else if (y !== " " && y !== "?") {
    const mapped = STATUS_CODES[y];
    if (mapped) status = mapped;
  }
  if (!status) return null;
  if (status === "renamed") {
    const arrowIdx = rest.indexOf("->");
    if (arrowIdx !== -1) {
      return { status, path: rest.slice(arrowIdx + 2).trim(), origPath: rest.slice(0, arrowIdx).trim() };
    }
  }
  return { status, path: rest.trim() };
}

export function parsePorcelain(output: string): GitFile[] {
  if (!output) return [];
  const files: GitFile[] = [];
  for (const line of output.split("\n")) {
    const f = parsePorcelainLine(line);
    if (f) files.push(f);
  }
  return files;
}

export function formatStatusIcons(files: GitFile[], icons: GitStatusIcons = NERD_FONT_ICONS): string {
  const counts: Record<GitFileStatus, number> = {
    modified: 0, untracked: 0, staged: 0, deleted: 0, renamed: 0, conflicted: 0, typechanged: 0,
  };
  for (const f of files) counts[f.status]++;
  const parts: string[] = [];
  if (counts.staged > 0) parts.push(`${icons.staged}${counts.staged}`);
  if (counts.modified > 0) parts.push(`${icons.modified}${counts.modified}`);
  if (counts.deleted > 0) parts.push(`${icons.deleted}${counts.deleted}`);
  if (counts.untracked > 0) parts.push(`${icons.untracked}${counts.untracked}`);
  if (counts.renamed > 0) parts.push(`${icons.renamed}${counts.renamed}`);
  if (counts.conflicted > 0) parts.push(`${icons.conflicted}${counts.conflicted}`);
  return parts.join("");
}

export type GitState = "clean" | "modified" | "untracked" | "ahead" | "diverged" | "none";

export interface GitStatusSummary {
  files: GitFile[];
  branch: string | null;
  ahead: number;
  behind: number;
  icons: string;
  state: GitState;
}

export function summarizeGitStatus(
  porcelainOutput: string,
  branch: string | null,
  ahead: number,
  behind: number,
  nerdFonts: boolean,
): GitStatusSummary {
  const files = parsePorcelain(porcelainOutput);
  const icons = nerdFonts ? NERD_FONT_ICONS : ASCII_ICONS;
  let state: GitState = "none";
  if (!branch) {
    state = "none";
  } else if (ahead > 0 && behind > 0) {
    state = "diverged";
  } else if (ahead > 0) {
    state = "ahead";
  } else if (files.some((f) => f.status === "untracked")) {
    state = "untracked";
  } else if (files.length > 0) {
    state = "modified";
  } else {
    state = "clean";
  }
  return { files, branch, ahead, behind, icons: formatStatusIcons(files, icons), state };
}
