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

export interface FooterSegment {
  text: string;
  color?: "accent" | "muted" | "success" | "warning" | "danger" | "info";
  bold?: boolean;
}

export function buildColoredFooter(
  opts: FooterOpts & { gitState: "clean" | "modified" | "untracked" | "ahead" | "diverged" | "none" },
): FooterSegment[] {
  const v = opts.version ?? "0.2.0";
  const cwd = basename(opts.cwd);
  const cwdIcon = opts.nerdFonts ? "󰝰 " : "";
  const modeLabel = opts.mode.toUpperCase() + (opts.modeReadOnly ? " RO" : "");
  const modeColor = opts.modeReadOnly ? "warning" : "success";
  const segs: FooterSegment[] = [
    { text: `pi-pro v${v}`, color: "accent", bold: true },
    { text: " · " },
    { text: modeLabel, color: modeColor, bold: true },
    { text: " · " },
  ];
  segs.push({ text: `${cwdIcon}${cwd}`, color: "muted" });
  if (opts.branch) {
    segs.push({ text: " on " });
    segs.push({ text: opts.branch, color: "info" });
    if (opts.gitIcons) {
      const gitColor: FooterSegment["color"] =
        opts.gitState === "clean"
          ? "success"
          : opts.gitState === "diverged"
            ? "danger"
            : opts.gitState === "ahead"
              ? "info"
              : "warning";
      segs.push({ text: ` ${opts.gitIcons}`, color: gitColor });
    }
  }
  if (opts.runtime) {
    segs.push({ text: " via " });
    segs.push({ text: opts.runtime, color: "muted" });
  }
  return segs;
}
