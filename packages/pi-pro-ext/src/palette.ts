/**
 * Command palette — fuzzy-searchable list of pi-pro commands.
 *
 * Strategy: two-step dialog.
 *   Step 1: ctx.ui.input("pi-pro > ", "") — get query
 *   Step 2: ctx.ui.select(title, options) — pick from filtered list
 *
 * Each option is formatted as "[Category] Title — description" so the user
 * sees what each does. Suggested commands are pinned to the top.
 */
import type { PaletteCommand } from "./commands.js";

export interface PaletteOpts {
  ui: {
    input: (title: string, placeholder?: string) => Promise<string | undefined>;
    select: (title: string, options: string[], opts?: any) => Promise<string | undefined>;
    notify: (m: string, t?: "info" | "warning" | "error") => void;
  };
}

interface ScoredCommand { cmd: PaletteCommand; score: number; }

/** Substring + token scoring. Suggested commands get a small +5 boost ONLY
 *  on top of an actual match — not enough to surface them with no query. */
export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...commands].sort((a, b) => {
      const sa = a.suggested ? 1 : 0;
      const sb = b.suggested ? 1 : 0;
      return sb - sa || a.title.localeCompare(b.title);
    });
  }
  const scored: ScoredCommand[] = [];
  for (const c of commands) {
    const title = c.title.toLowerCase();
    const name = c.name.toLowerCase();
    const desc = c.description.toLowerCase();
    let matchScore = 0;
    if (title.includes(q)) matchScore += 10;
    if (name.includes(q)) matchScore += 8;
    if (desc.includes(q)) matchScore += 4;
    for (const word of q.split(/\s+/).filter(Boolean)) {
      if (word.length > 1) {
        if (title.includes(word)) matchScore += 2;
        if (name.includes(word)) matchScore += 1;
      }
    }
    if (matchScore === 0) continue; // no actual match — skip
    const total = matchScore + (c.suggested ? 5 : 0);
    scored.push({ cmd: c, score: total });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.cmd.title.localeCompare(b.cmd.title))
    .map((s) => s.cmd);
}

/** Format a command for the palette select list. */
export function formatOption(c: PaletteCommand): string {
  const cat = c.category.padEnd(8);
  return `[${cat}] ${c.title}${c.keybind ? `  (${c.keybind})` : ""}`;
}

export interface PaletteContext {
  ui: PaletteOpts["ui"];
  args?: string | undefined;
  pi: { sendUserMessage: (content: string) => void; getModel?: () => unknown; getThinkingLevel?: () => string };
  ctx: unknown;
}

export async function openPalette(ctx: unknown, pi: PaletteContext["pi"], commands: PaletteCommand[], opts: PaletteOpts): Promise<void> {
  const { ui } = opts;
  const query = await ui.input("pi-pro palette >", "(type to filter, esc to cancel)");
  if (query === undefined) return;
  const filtered = filterCommands(commands, query);
  if (filtered.length === 0) {
    ui.notify("no commands matched", "info");
    return;
  }
  if (filtered.length === 1) {
    const choice = filtered[0]!;
    ui.notify(`running: ${choice.title}`, "info");
    await choice.run({ ui, args: undefined, pi, ctx } as any);
    return;
  }
  const options = filtered.map(formatOption);
  const picked = await ui.select(
    `pi-pro palette · ${filtered.length} command${filtered.length === 1 ? "" : "s"} (press / for all pi-mono)`,
    options,
  );
  if (picked === undefined) return;
  const idx = options.indexOf(picked);
  if (idx < 0) return;
  const choice = filtered[idx]!;
  await choice.run({ ui, args: undefined, pi, ctx } as any);
}
