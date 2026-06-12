import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import {
  ContextBudget,
  BtwPrompt,
  ContextBreakdown,
  Footer,
  colorForState,
  colorHex,
  buildBar,
  formatBudgetLine,
  buildCategories,
  theme,
} from "../src/index.js";
import type { ContextStats, BtwResult } from "@pi/context-manager";

function mkStats(over: Partial<ContextStats> = {}): ContextStats {
  return {
    totalTokens: 0,
    messageCount: 0,
    budgetUsed: 0,
    state: "ok",
    triggeredReasons: [],
    turnCount: 0,
    totalCostUsd: 0,
    ...over,
  };
}

describe("colorForState", () => {
  it("ok → ok", () => expect(colorForState("ok")).toBe("ok"));
  it("soft-warn → warn", () => expect(colorForState("soft-warn")).toBe("warn"));
  it("hard-trigger → danger", () => expect(colorForState("hard-trigger")).toBe("danger"));
});

describe("colorHex", () => {
  it("maps ok to success", () => expect(colorHex("ok")).toBe(theme.success));
  it("maps warn to warning", () => expect(colorHex("soft-warn")).toBe(theme.warning));
  it("maps danger to error", () => expect(colorHex("hard-trigger")).toBe(theme.error));
});

describe("buildBar", () => {
  it("empty at 0", () => expect(buildBar(0, 10)).toBe("░".repeat(10)));
  it("full at 1", () => expect(buildBar(1, 10)).toBe("█".repeat(10)));
  it("half at 0.5", () => expect(buildBar(0.5, 10)).toBe("█".repeat(5) + "░".repeat(5)));
  it("clamps >1 to full", () => expect(buildBar(1.5, 10)).toBe("█".repeat(10)));
  it("clamps <0 to empty", () => expect(buildBar(-0.5, 10)).toBe("░".repeat(10)));
});

describe("formatBudgetLine", () => {
  it("formats tokens and percentage", () => {
    const line = formatBudgetLine(mkStats({ totalTokens: 1000, budgetUsed: 0.5 }), 2000);
    expect(line).toContain("1.0K");
    expect(line).toContain("2.0K");
    expect(line).toContain("50%");
  });

  it("handles 0 tokens", () => {
    const line = formatBudgetLine(mkStats(), 1000);
    expect(line).toContain("0");
    expect(line).toContain("0%");
  });

  it("uses K formatting above 1k", () => {
    const line = formatBudgetLine(mkStats({ totalTokens: 50_000, budgetUsed: 0.5 }), 100_000);
    expect(line).toContain("50.0K");
    expect(line).toContain("100.0K");
  });
});

describe("ContextBudget — compact mode", () => {
  it("renders 'ctx:off' when stats is null", () => {
    const { lastFrame } = render(<ContextBudget stats={null} compact />);
    expect(lastFrame()).toContain("ctx:off");
  });

  it("renders budget line when stats provided", () => {
    const { lastFrame } = render(
      <ContextBudget stats={mkStats({ totalTokens: 1000, budgetUsed: 0.5 })} compact maxTokens={2000} />,
    );
    const out = lastFrame();
    expect(out).toContain("1.0K");
    expect(out).toContain("50%");
  });

  it("color matches state in compact", () => {
    const { lastFrame } = render(
      <ContextBudget stats={mkStats({ state: "hard-trigger", totalTokens: 950, budgetUsed: 0.95 })} compact />,
    );
    expect(lastFrame()).toContain("95%");
  });
});

describe("ContextBudget — full mode", () => {
  it("renders bar with progress", () => {
    const { lastFrame } = render(
      <ContextBudget stats={mkStats({ totalTokens: 500, budgetUsed: 0.5, turnCount: 5, totalCostUsd: 0.05 })} />,
    );
    const out = lastFrame();
    expect(out).toContain("█");
    expect(out).toContain("░");
    expect(out).toContain("turn 5");
  });

  it("renders triggers when present", () => {
    const { lastFrame } = render(
      <ContextBudget stats={mkStats({ triggeredReasons: ["hard-token-threshold"] })} />,
    );
    expect(lastFrame()).toContain("hard-token-threshold");
  });

  it("does not render triggers when empty", () => {
    const { lastFrame } = render(<ContextBudget stats={mkStats()} />);
    expect(lastFrame()).not.toContain("triggers:");
  });
});

describe("BtwPrompt", () => {
  it("returns null when not visible", () => {
    const { lastFrame } = render(
      <BtwPrompt visible={false} question="" result={null} loading={false} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />,
    );
    expect(lastFrame()).toBe("");
  });

  it("shows 'btw' header when visible", () => {
    const { lastFrame } = render(
      <BtwPrompt visible={true} question="what is 6*7?" result={null} loading={false} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />,
    );
    const out = lastFrame();
    expect(out).toContain("btw");
    expect(out).toContain("side question");
  });

  it("shows the question", () => {
    const { lastFrame } = render(
      <BtwPrompt visible={true} question="What is the answer?" result={null} loading={false} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />,
    );
    expect(lastFrame()).toContain("What is the answer?");
  });

  it("shows 'thinking...' when loading", () => {
    const { lastFrame } = render(
      <BtwPrompt visible={true} question="hi" result={null} loading={true} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />,
    );
    expect(lastFrame()).toContain("thinking");
  });

  it("shows the result when present", () => {
    const result: BtwResult = { question: "What is 6*7?", answer: "42", tokensUsed: 50, costUsd: 0.001 };
    const { lastFrame } = render(
      <BtwPrompt visible={true} question="What is 6*7?" result={result} loading={false} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />,
    );
    expect(lastFrame()).toContain("42");
    expect(lastFrame()).toContain("esc to dismiss");
  });

  it("shows 'enter to ask' when idle", () => {
    const { lastFrame } = render(
      <BtwPrompt visible={true} question="" result={null} loading={false} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />,
    );
    expect(lastFrame()).toContain("enter to ask");
  });
});

describe("buildCategories", () => {
  it("returns 5 categories with token counts", () => {
    const cats = buildCategories({ system: 100, memory: 50, codebase: 75, tools: 200, conversation: 300 });
    expect(cats).toHaveLength(5);
    const labels = cats.map(c => c.label);
    expect(labels).toEqual(["system", "memory", "codebase", "tools", "conversation"]);
    expect(cats[0].tokens).toBe(100);
    expect(cats[4].tokens).toBe(300);
  });
});

describe("ContextBreakdown", () => {
  it("renders all 5 categories", () => {
    const { lastFrame } = render(
      <ContextBreakdown
        stats={mkStats({ totalTokens: 725, turnCount: 10, totalCostUsd: 0.05, messageCount: 12 })}
        breakdown={{ system: 100, memory: 50, codebase: 75, tools: 200, conversation: 300 }}
        maxTokens={1000}
      />,
    );
    const out = lastFrame();
    expect(out).toContain("system");
    expect(out).toContain("memory");
    expect(out).toContain("codebase");
    expect(out).toContain("tools");
    expect(out).toContain("conversation");
  });

  it("shows OK state in green", () => {
    const { lastFrame } = render(
      <ContextBreakdown
        stats={mkStats({ state: "ok" })}
        breakdown={{ system: 100, memory: 0, codebase: 0, tools: 0, conversation: 0 }}
        maxTokens={1000}
      />,
    );
    expect(lastFrame()).toContain("OK");
  });

  it("shows WARN state in yellow", () => {
    const { lastFrame } = render(
      <ContextBreakdown
        stats={mkStats({ state: "soft-warn", totalTokens: 800 })}
        breakdown={{ system: 100, memory: 0, codebase: 0, tools: 0, conversation: 700 }}
        maxTokens={1000}
      />,
    );
    expect(lastFrame()).toContain("WARN");
  });

  it("shows HARD state in red", () => {
    const { lastFrame } = render(
      <ContextBreakdown
        stats={mkStats({ state: "hard-trigger", totalTokens: 950 })}
        breakdown={{ system: 100, memory: 0, codebase: 0, tools: 0, conversation: 850 }}
        maxTokens={1000}
      />,
    );
    expect(lastFrame()).toContain("HARD");
  });

  it("shows OFF state when stats is null", () => {
    const { lastFrame } = render(
      <ContextBreakdown stats={null} breakdown={{ system: 0, memory: 0, codebase: 0, tools: 0, conversation: 0 }} maxTokens={1000} />,
    );
    expect(lastFrame()).toContain("OFF");
  });

  it("shows triggered reasons", () => {
    const { lastFrame } = render(
      <ContextBreakdown
        stats={mkStats({ triggeredReasons: ["turn-interval", "cost-cap"] })}
        breakdown={{ system: 0, memory: 0, codebase: 0, tools: 0, conversation: 0 }}
        maxTokens={1000}
      />,
    );
    expect(lastFrame()).toContain("turn-interval");
    expect(lastFrame()).toContain("cost-cap");
  });

  it("computes percentages", () => {
    const { lastFrame } = render(
      <ContextBreakdown
        stats={mkStats({ totalTokens: 500 })}
        breakdown={{ system: 250, memory: 0, codebase: 0, tools: 0, conversation: 250 }}
        maxTokens={1000}
      />,
    );
    const out = lastFrame();
    expect(out).toContain("25%");
  });
});

describe("Footer — context integration", () => {
  it("does not show ctx line when contextStats is null", () => {
    const { lastFrame } = render(<Footer connected={true} contextStats={null} />);
    expect(lastFrame()).not.toContain("ctx:");
  });

  it("shows ctx line when contextStats provided", () => {
    const { lastFrame } = render(
      <Footer connected={true} contextStats={mkStats({ totalTokens: 1000, budgetUsed: 0.5 })} contextMaxTokens={2000} />,
    );
    expect(lastFrame()).toContain("ctx:");
    expect(lastFrame()).toContain("1.0K");
    expect(lastFrame()).toContain("50%");
  });

  it("back-compat: no contextStats prop", () => {
    const { lastFrame } = render(<Footer connected={true} />);
    expect(lastFrame()).not.toContain("ctx:");
  });
});

describe("Footer — per-turn delta (v0.8.0)", () => {
  it("does not show delta when turnDelta is null", () => {
    const { lastFrame } = render(<Footer connected={true} turnDelta={null} />);
    expect(lastFrame()).not.toContain("Δtok:");
  });

  it("shows delta when turnDelta provided", () => {
    const { lastFrame } = render(
      <Footer connected={true} turnDelta={{ tokensIn: 200, tokensOut: 100, costUsd: 0.005 }} />,
    );
    const out = lastFrame();
    expect(out).toContain("Δtok:200↗/100↘");
    expect(out).toContain("$0.01");
  });

  it("omits cost when 0", () => {
    const { lastFrame } = render(
      <Footer connected={true} turnDelta={{ tokensIn: 100, tokensOut: 50, costUsd: 0 }} />,
    );
    expect(lastFrame()).toContain("Δtok:100↗/50↘");
    expect(lastFrame()).not.toContain("$0.00");
  });

  it("includes tool count when > 0", () => {
    const { lastFrame } = render(
      <Footer connected={true} turnDelta={{ tokensIn: 100, tokensOut: 50, costUsd: 0.001, toolCalls: 3 }} />,
    );
    expect(lastFrame()).toContain("3🔧");
  });

  it("omits tool count when 0 or undefined", () => {
    const { lastFrame } = render(
      <Footer connected={true} turnDelta={{ tokensIn: 100, tokensOut: 50, costUsd: 0.001 }} />,
    );
    expect(lastFrame()).not.toContain("🔧");
  });

  it("includes duration when provided", () => {
    const { lastFrame } = render(
      <Footer connected={true} turnDelta={{ tokensIn: 100, tokensOut: 50, costUsd: 0.001, durationMs: 1500 }} />,
    );
    expect(lastFrame()).toContain("1s");
  });

  it("formats duration in seconds and minutes", () => {
    const { lastFrame } = render(
      <Footer connected={true} turnDelta={{ tokensIn: 100, tokensOut: 50, costUsd: 0, durationMs: 90000 }} />,
    );
    expect(lastFrame()).toContain("1m30s");
  });

  it("uses K formatting for large token counts", () => {
    const { lastFrame } = render(
      <Footer connected={true} turnDelta={{ tokensIn: 1500, tokensOut: 500, costUsd: 0.01 }} />,
    );
    expect(lastFrame()).toContain("1.5K");
  });

  it("shows delta + cost + ctx together", () => {
    const { lastFrame } = render(
      <Footer
        connected={true}
        tokensIn={10000}
        tokensOut={5000}
        costUsd={0.5}
        contextStats={mkStats({ totalTokens: 5000, budgetUsed: 0.5 })}
        contextMaxTokens={10000}
        turnDelta={{ tokensIn: 200, tokensOut: 100, costUsd: 0.005 }}
      />,
    );
    const out = lastFrame();
    expect(out).toContain("Δtok:200↗/100↘");
    expect(out).toContain("tok:10.0K↗/5.0K↘");
    expect(out).toContain("ctx:");
    expect(out).toContain("50%");
  });

  it("back-compat: Footer without turnDelta prop works", () => {
    const { lastFrame } = render(<Footer connected={true} />);
    expect(lastFrame()).not.toContain("Δtok:");
  });
});
