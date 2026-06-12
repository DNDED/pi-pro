import { describe, it, expect } from "vitest";
import { detectNerdFontsFromEnv } from "../src/util/nerd-fonts.js";

describe("detectNerdFontsFromEnv", () => {
  it("detects via TERM=*nerd*", () => {
    expect(detectNerdFontsFromEnv({ TERM: "xterm-256color-nerd" })).toBe(true);
  });

  it("detects via TERM=*nfont*", () => {
    expect(detectNerdFontsFromEnv({ TERM: "alacritty-nfont" })).toBe(true);
  });

  it("detects via FONT_NAME=JetBrains Mono NF", () => {
    expect(detectNerdFontsFromEnv({ FONT_NAME: "JetBrainsMono NF" })).toBe(true);
  });

  it("detects via PROMYRA_NERD_FONTS=1", () => {
    expect(detectNerdFontsFromEnv({ PROMYRA_NERD_FONTS: "1" })).toBe(true);
  });

  it("overrides detection: PROMYRA_NERD_FONTS=0 forces false", () => {
    expect(detectNerdFontsFromEnv({ TERM: "xterm-nerd", PROMYRA_NERD_FONTS: "0" })).toBe(false);
  });

  it("returns false for plain xterm", () => {
    expect(detectNerdFontsFromEnv({ TERM: "xterm-256color" })).toBe(false);
  });

  it("returns false for empty env", () => {
    expect(detectNerdFontsFromEnv({})).toBe(false);
  });
});
