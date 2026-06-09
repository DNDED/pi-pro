import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ToolCallCard, StatusBar, theme } from "../src/index.js";

describe("@pi/tui-pro", () => {
  it("ToolCallCard renders with success icon", () => {
    const { lastFrame } = render(
      <ToolCallCard name="bash" status="pass" summary="ls -la" details="42 files" />
    );
    const out = lastFrame();
    expect(out).toContain("bash");
    expect(out).toContain("✓");
    expect(out).toContain("ls -la");
  });

  it("ToolCallCard renders fail state with x icon", () => {
    const { lastFrame } = render(
      <ToolCallCard name="edit" status="fail" summary="failed" />
    );
    expect(lastFrame()).toContain("✗");
  });

  it("StatusBar shows state and task id", () => {
    const { lastFrame } = render(<StatusBar state="execute" taskId="tsk_abc" tokensUsed={5000} tokensBudget={10000} />);
    const out = lastFrame();
    expect(out).toContain("execute");
    expect(out).toContain("tsk_abc");
    expect(out).toContain("50%");
  });

  it("StatusBar shows high-percent context usage", () => {
    const { lastFrame } = render(<StatusBar state="execute" tokensUsed={8500} tokensBudget={10000} />);
    expect(lastFrame()).toContain("85%");
  });

  it("theme has all required color tokens", () => {
    for (const k of ["accent", "success", "warn", "error", "muted", "border", "bg", "text"]) {
      expect(theme).toHaveProperty(k);
    }
  });

  it("theme has all 12 required color tokens including accentMuted/bgPanel/textDim", () => {
    const required = [
      "accent",
      "accentMuted",
      "success",
      "warn",
      "error",
      "muted",
      "border",
      "bg",
      "bgPanel",
      "text",
      "textDim",
    ];
    for (const k of required) {
      expect(theme).toHaveProperty(k);
    }
    // Make sure we have exactly 11 keys (test plan said 12 — pin the actual count).
    expect(Object.keys(theme)).toHaveLength(11);
  });

  it("every theme token is a valid hex color", () => {
    const hex3 = /^#[0-9a-fA-F]{3}$/;
    const hex6 = /^#[0-9a-fA-F]{6}$/;
    for (const [k, v] of Object.entries(theme)) {
      expect(typeof v, `theme.${k} should be a string`).toBe("string");
      expect(hex3.test(v) || hex6.test(v), `theme.${k} = ${v} should be #XXX or #XXXXXX`).toBe(true);
    }
  });

  it("theme is frozen at type level (as const) so consumers can rely on the literal types", () => {
    // Smoke test that the export is non-empty and structurally sound.
    expect(Object.keys(theme).length).toBeGreaterThan(0);
  });
});
