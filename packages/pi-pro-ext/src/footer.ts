export interface FooterOpts {
  cwd: string;
  branch: string | null;
  gitIcons: string;
  runtime: string | null;
  mode: string;
  modeReadOnly: boolean;
  nerdFonts: boolean;
  version?: string;
}

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

export function buildStarshipFooter(opts: FooterOpts): string {
  const v = opts.version ?? "0.2.0";
  const cwd = basename(opts.cwd);
  const cwdIcon = opts.nerdFonts ? "󰝰 " : "";
  const modeLabel = opts.mode.toUpperCase() + (opts.modeReadOnly ? " RO" : "");
  const branchPart = opts.branch ? ` on ${opts.branch}${opts.gitIcons ? " " + opts.gitIcons : ""}` : "";
  const runtimePart = opts.runtime ? ` via ${opts.runtime}` : "";
  return `pi-pro v${v} · ${modeLabel} · ${cwdIcon}${cwd}${branchPart}${runtimePart}`;
}
