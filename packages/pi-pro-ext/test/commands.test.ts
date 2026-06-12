import { describe, it, expect } from "vitest";
import { COMMANDS, formatHelp, type PaletteCommand } from "../src/commands.js";

describe("commands manifest", () => {
  it("has at least 12 commands", () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(12);
  });

  it("every command has required fields", () => {
    for (const c of COMMANDS) {
      expect(c.name, `${c.name} name`).toBeTruthy();
      expect(c.title, `${c.name} title`).toBeTruthy();
      expect(c.description, `${c.name} description`).toBeTruthy();
      expect(c.category, `${c.name} category`).toBeTruthy();
      expect(c.slashName, `${c.name} slashName`).toBeTruthy();
      expect(typeof c.run).toBe("function");
    }
  });

  it("categories are valid", () => {
    const validCats = new Set(["Mode", "Memory", "Config", "Auth", "System", "Help"]);
    for (const c of COMMANDS) {
      expect(validCats.has(c.category), `${c.name} category ${c.category}`).toBe(true);
    }
  });

  it("slash names are unique", () => {
    const seen = new Set<string>();
    for (const c of COMMANDS) {
      expect(seen.has(c.slashName), `duplicate slashName: ${c.slashName}`).toBe(false);
      seen.add(c.slashName);
    }
  });

  it("command names are unique", () => {
    const seen = new Set<string>();
    for (const c of COMMANDS) {
      expect(seen.has(c.name), `duplicate name: ${c.name}`).toBe(false);
      seen.add(c.name);
    }
  });

  it("has at least one suggested command per category", () => {
    const byCat: Record<string, number> = {};
    for (const c of COMMANDS) {
      if (c.suggested) byCat[c.category] = (byCat[c.category] ?? 0) + 1;
    }
    expect(byCat.Mode, "Mode has suggested").toBeGreaterThan(0);
  });

  it("Mode category has mode and plan", () => {
    const names = COMMANDS.filter((c) => c.category === "Mode").map((c) => c.name);
    expect(names).toContain("mode");
    expect(names).toContain("plan");
  });

  it("Memory category has all 4 memory-* commands", () => {
    const names = COMMANDS.filter((c) => c.category === "Memory").map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["memory-add", "memory-list", "memory-search", "memory-clear"]));
  });
});

describe("formatHelp", () => {
  it("renders all commands grouped by category", () => {
    const out = formatHelp(COMMANDS);
    expect(out).toContain("pi-pro v0.2.5");
    expect(out).toContain("MODE");
    expect(out).toContain("MEMORY");
    expect(out).toContain("CONFIG");
    expect(out).toContain("AUTH");
    expect(out).toContain("SYSTEM");
  });

  it("includes keybinds for commands that have them", () => {
    const out = formatHelp(COMMANDS);
    expect(out).toContain("[Tab]");
    expect(out).toContain("[Ctrl+P]");
  });

  it("includes 'press / for built-ins' hint", () => {
    const out = formatHelp(COMMANDS);
    expect(out).toContain("Press `/` for all pi-mono commands + pi-pro");
    expect(out).toContain("Ctrl+P for the palette");
  });
});
