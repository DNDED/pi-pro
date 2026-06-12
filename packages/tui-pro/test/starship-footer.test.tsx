import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { StarshipFooter } from "../src/index.js";

describe("StarshipFooter", () => {
  it("renders cwd + branch + git icons", () => {
    const { lastFrame } = render(
      <StarshipFooter workdir="/x/proj" branch="main" gitIcons="!2?1" version="" />,
    );
    const out = lastFrame();
    expect(out).toContain("on main");
    expect(out).toContain("!2?1");
  });

  it("renders runtime when provided", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" runtime="node 20.0.0" />);
    expect(lastFrame()).toContain("via node 20.0.0");
  });

  it("renders agent mode badge", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" agentMode="plan" agentModeReadOnly />);
    const out = lastFrame();
    expect(out).toContain("[PLAN RO]");
  });

  it("renders todo progress", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" todoDone={3} todoTotal={7} />);
    expect(lastFrame()).toContain("☰ 3/7");
  });

  it("renders plan progress", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" planDone={2} planTotal={5} />);
    expect(lastFrame()).toContain("📋 2/5");
  });

  it("renders context bar with percentage", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" contextUsed={42000} contextMax={200000} />);
    const out = lastFrame();
    expect(out).toContain("ctx:42.0K/200.0K");
    expect(out).toContain("(21%)");
  });

  it("renders cache hit rate", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" cacheHitRate={0.74} />);
    expect(lastFrame()).toContain("cache:74%");
  });

  it("renders cost when > 0", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" costUsd={0.42} />);
    expect(lastFrame()).toContain("$0.42");
  });

  it("omits cost when 0", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" costUsd={0} />);
    expect(lastFrame()).not.toContain("$0.00");
  });

  it("falls back to ASCII cwd icon when nerdFonts=false", () => {
    const { lastFrame } = render(<StarshipFooter workdir="/x" nerdFonts={false} />);
    const out = lastFrame();
    expect(out).not.toContain("󰝰");
  });
});
