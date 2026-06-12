import { describe, it, expect } from "vitest";
import { detectNerdFontsFromEnv } from "../src/util/nerd-fonts.js";

describe("detectNerdFontsFromEnv", () => {
  it("detects via TERM=*nerd*", () => {
    expect(detectNerdFontsFromEnv({ TERM: "xterm-256color-nerd" })).toBe(true);
  });
  it("detects via TERM=*nfont*", () => {
    expect(detectNerdFontsFromEnv({ TERM: "alacritty-nfont" })).toBe(true);
  });
  it("detects via FONT_NAME", () => {
    expect(detectNerdFontsFromEnv({ FONT_NAME: "JetBrainsMono NF" })).toBe(true);
  });
  it("PROMYRA_NERD_FONTS=1", () => {
    expect(detectNerdFontsFromEnv({ PROMYRA_NERD_FONTS: "1" })).toBe(true);
  });
  it("PROMYRA_NERD_FONTS=0 overrides positive detection", () => {
    expect(detectNerdFontsFromEnv({ TERM: "xterm-nerd", PROMYRA_NERD_FONTS: "0" })).toBe(false);
  });
  it("plain xterm returns false", () => {
    expect(detectNerdFontsFromEnv({ TERM: "xterm-256color" })).toBe(false);
  });
  it("empty env returns false", () => {
    expect(detectNerdFontsFromEnv({})).toBe(false);
  });
});
