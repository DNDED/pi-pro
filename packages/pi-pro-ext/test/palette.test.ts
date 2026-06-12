import { describe, it, expect } from "vitest";
import { filterCommands, formatOption } from "../src/palette.js";
import type { PaletteCommand } from "../src/commands.js";

const cmds: PaletteCommand[] = [
  { name: "mode", title: "Cycle Agent Mode", description: "Switch between build and plan", category: "Mode", slashName: "mode", keybind: "Tab", suggested: true, run: () => {} },
  { name: "plan", title: "Toggle Plan Mode", description: "Switch to read-only mode", category: "Mode", slashName: "plan", keybind: "Tab", suggested: true, run: () => {} },
  { name: "memory-add", title: "Memory: Add", description: "Add a chunk to cross-session memory", category: "Memory", slashName: "memory-add", run: () => {} },
  { name: "memory-list", title: "Memory: List", description: "List memory entries", category: "Memory", slashName: "memory-list", run: () => {} },
  { name: "config", title: "Show Config", description: "Show pi-pro config", category: "Config", slashName: "config", run: () => {} },
  { name: "help", title: "Show Help", description: "List all commands", category: "Help", slashName: "help", suggested: true, run: () => {} },
];

describe("filterCommands", () => {
  it("returns all sorted (suggested first) on empty query", () => {
    const out = filterCommands(cmds, "");
    expect(out.length).toBe(cmds.length);
    // First two are suggested (mode, plan)
    expect(out[0]!.suggested).toBe(true);
  });

  it("filters by title substring (case-insensitive)", () => {
    const out = filterCommands(cmds, "memory");
    expect(out.map((c) => c.name)).toEqual(["memory-add", "memory-list"]);
  });

  it("filters by name substring (e.g. 'plan' matches only plan cmd's name)", () => {
    const out = filterCommands(cmds, "config");
    expect(out.map((c) => c.name)).toContain("config");
  });

  it("filters by description substring", () => {
    const out = filterCommands(cmds, "cross-session");
    expect(out.map((c) => c.name)).toEqual(["memory-add"]);
  });

  it("ranks title match above name match above description match", () => {
    const out = filterCommands(cmds, "memory");
    // memory-add's title contains "Memory" (10) + word match (2) = 12
    // memory-list's title contains "Memory" (10) + word match (2) = 12
    // tie → alphabetical
    expect(out[0]!.name).toBe("memory-add");
    expect(out[1]!.name).toBe("memory-list");
  });

  it("returns empty for no matches", () => {
    const out = filterCommands(cmds, "xyzzy");
    expect(out).toEqual([]);
  });

  it("supports multi-word queries", () => {
    const out = filterCommands(cmds, "memory list");
    expect(out.length).toBeGreaterThan(0);
    expect(out.map((c) => c.name)).toContain("memory-list");
  });
});

describe("formatOption", () => {
  it("includes category + title + keybind", () => {
    const out = formatOption(cmds[0]!);
    expect(out).toContain("[Mode");
    expect(out).toContain("Cycle Agent Mode");
    expect(out).toContain("(Tab)");
  });

  it("omits keybind for commands without one", () => {
    const out = formatOption(cmds[2]!);
    expect(out).toContain("Memory: Add");
    expect(out).not.toContain("(");
  });
});
