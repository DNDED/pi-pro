import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import {
  App,
  theme,
  agentColor,
  agentColors,
  BlockLogo,
  UserMessage,
  AssistantMessage,
  ErrorMessage,
  ToolContent,
  Footer,
  Sidebar,
  HomeScreen,
  SessionScreen,
  HeaderRow,
  SubagentFooter,
  PermissionPrompt,
  classifyTool,
  formatToolArgs,
  renderDiff,
  formatTokens,
  formatCost,
  formatTime,
  hexToRgb,
  tint,
} from "../src/index.js";

describe("@promyra/tui-pro theme", () => {
  it("has opencode pure black background", () => {
    expect(theme.background).toBe("#0a0a0a");
  });

  it("has dark gray panel background", () => {
    expect(theme.backgroundPanel).toBe("#141414");
  });

  it("has input fill background", () => {
    expect(theme.backgroundElement).toBe("#1e1e1e");
  });

  it("uses peach primary", () => {
    expect(theme.primary).toBe("#fab283");
  });

  it("uses blue secondary", () => {
    expect(theme.secondary).toBe("#5c9cf5");
  });

  it("uses purple accent", () => {
    expect(theme.accent).toBe("#9d7cd8");
  });

  it("has diff colors", () => {
    expect(theme.diffAdded).toBe("#4fd6be");
    expect(theme.diffRemoved).toBe("#c53b53");
    expect(theme.diffAddedBg).toBe("#20303b");
    expect(theme.diffRemovedBg).toBe("#37222c");
  });

  it("every token is a valid hex color", () => {
    const hex3 = /^#[0-9a-fA-F]{3}$/;
    const hex6 = /^#[0-9a-fA-F]{6}$/;
    for (const [k, v] of Object.entries(theme)) {
      if (k === "name") continue;
      expect(typeof v).toBe("string");
      expect(hex3.test(v) || hex6.test(v), `theme.${k} = ${v}`).toBe(true);
    }
  });

  it("agentColor returns primary for build, secondary for plan", () => {
    expect(agentColor("build")).toBe(theme.primary);
    expect(agentColor("plan")).toBe(theme.secondary);
  });

  it("agentColor returns primary for unknown", () => {
    expect(agentColor("unknown")).toBe(theme.primary);
  });
});

describe("@promyra/tui-pro helpers", () => {
  it("hexToRgb parses hex", () => {
    expect(hexToRgb("#fab283")).toEqual({ r: 0xfa, g: 0xb2, b: 0x83 });
    expect(hexToRgb("invalid")).toBeNull();
  });

  it("tint blends colors", () => {
    const result = tint("#000000", "#ffffff", 0.5);
    expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("formatTokens abbreviates", () => {
    expect(formatTokens(500)).toBe("500");
    expect(formatTokens(1500)).toBe("1.5K");
    expect(formatTokens(2_000_000)).toBe("2.0M");
  });

  it("formatCost formats USD", () => {
    expect(formatCost(0.04)).toBe("$0.04");
    expect(formatCost(1.5)).toBe("$1.50");
  });

  it("formatTime produces 12-hour format", () => {
    const t = formatTime(new Date(2024, 0, 1, 15, 30).getTime());
    expect(t).toMatch(/03:30 PM/);
  });
});

describe("@promyra/tui-pro event classification", () => {
  it("classifies tools", () => {
    expect(classifyTool("read")).toBe("read");
    expect(classifyTool("write")).toBe("write");
    expect(classifyTool("edit")).toBe("edit");
    expect(classifyTool("bash")).toBe("bash");
    expect(classifyTool("grep")).toBe("grep");
    expect(classifyTool("glob")).toBe("glob");
    expect(classifyTool("webfetch")).toBe("webfetch");
    expect(classifyTool("task")).toBe("task");
    expect(classifyTool("todowrite")).toBe("todo");
    expect(classifyTool("unknown")).toBe("other");
  });

  it("formatToolArgs extracts fields", () => {
    expect(formatToolArgs({ path: "/x.ts" })).toBe("/x.ts");
    expect(formatToolArgs({ command: "ls" })).toBe("ls");
    expect(formatToolArgs({ pattern: "TODO" })).toBe("TODO");
    expect(formatToolArgs({ url: "https://x" })).toBe("https://x");
    expect(formatToolArgs(undefined)).toBe("");
  });
});

describe("@promyra/tui-pro diff", () => {
  it("renders unchanged lines as context", () => {
    const lines = renderDiff("a\nb\nc", "a\nb\nc");
    expect(lines.every((l) => l.kind === "context")).toBe(true);
  });

  it("detects added lines", () => {
    const lines = renderDiff("a", "a\nb");
    expect(lines.some((l) => l.kind === "added" && l.text === "b")).toBe(true);
  });

  it("detects removed lines", () => {
    const lines = renderDiff("a\nb", "a");
    expect(lines.some((l) => l.kind === "removed" && l.text === "b")).toBe(true);
  });
});

describe("@promyra/tui-pro BlockLogo", () => {
  it("renders block-letter PROMYRA", () => {
    const { lastFrame } = render(<BlockLogo />);
    const out = lastFrame();
    expect(out).toContain("▀");
  });

  it("shows tagline by default", () => {
    const { lastFrame } = render(<BlockLogo />);
    expect(lastFrame()).toContain("coding agent");
  });

  it("hides tagline when disabled", () => {
    const { lastFrame } = render(<BlockLogo showTagline={false} />);
    expect(lastFrame()).not.toContain("coding agent");
  });
});

describe("@promyra/tui-pro HeaderRow", () => {
  it("shows title in accent", () => {
    const { lastFrame } = render(<HeaderRow title="Fix auth bug" />);
    expect(lastFrame()).toContain("Fix auth bug");
  });

  it("shows tokens and cost", () => {
    const { lastFrame } = render(
      <HeaderRow title="X" tokensIn={2230} tokensOut={608} cost={0.04} />
    );
    const out = lastFrame();
    expect(out).toContain("2.8K");
    expect(out).toContain("$0.04");
  });

  it("shows share URL", () => {
    const { lastFrame } = render(
      <HeaderRow title="X" shareUrl="https://x.com/s/abc" />
    );
    expect(lastFrame()).toContain("https://x.com/s/abc");
  });

  it("shows context percentage", () => {
    const { lastFrame } = render(
      <HeaderRow title="X" tokensIn={5000} contextLimit={10000} />
    );
    expect(lastFrame()).toContain("50%");
  });
});

describe("@promyra/tui-pro UserMessage", () => {
  it("renders title in accent color", () => {
    const { lastFrame } = render(
      <UserMessage text="# Fix the auth bug" agent="build" />
    );
    const out = lastFrame();
    expect(out).toContain("Fix the auth bug");
  });

  it("renders body text", () => {
    const { lastFrame } = render(
      <UserMessage text="please add a health check endpoint" />
    );
    expect(lastFrame()).toContain("please add a health check endpoint");
  });

  it("renders timestamp", () => {
    const t = new Date(2024, 0, 1, 14, 30).getTime();
    const { lastFrame } = render(<UserMessage text="hi" time={t} />);
    expect(lastFrame()).toMatch(/02:30 PM/);
  });

  it("renders share URL", () => {
    const { lastFrame } = render(
      <UserMessage text="hi" shareUrl="https://x.com/s/abc" />
    );
    expect(lastFrame()).toContain("https://x.com/s/abc");
  });
});

describe("@promyra/tui-pro AssistantMessage", () => {
  it("renders plain text", () => {
    const { lastFrame } = render(
      <AssistantMessage parts={[{ kind: "text", text: "I'll fix that." }]} />
    );
    expect(lastFrame()).toContain("I'll fix that.");
  });

  it("shows agent meta line at end", () => {
    const { lastFrame } = render(
      <AssistantMessage
        parts={[{ kind: "text", text: "Done." }]}
        model="minimax-m3"
        agent="build"
        time={new Date(2024, 0, 1, 14, 30).getTime()}
      />
    );
    const out = lastFrame();
    expect(out).toContain("build");
    expect(out).toContain("minimax-m3");
    expect(out).toContain("02:30 PM");
  });

  it("renders reasoning in dim italic", () => {
    const { lastFrame } = render(
      <AssistantMessage parts={[{ kind: "reasoning", text: "thinking..." }]} />
    );
    expect(lastFrame()).toContain("thinking");
  });

  it("renders tool call inline", () => {
    const { lastFrame } = render(
      <AssistantMessage
        parts={[
          { kind: "text", text: "Reading file." },
          {
            kind: "tool",
            tool: "read",
            toolName: "read",
            args: { path: "/foo.ts" },
            status: "done",
            result: "const x = 1;",
          },
        ]}
      />
    );
    const out = lastFrame();
    expect(out).toContain("read");
    expect(out).toContain("/foo.ts");
    expect(out).toContain("const x = 1;");
  });
});

describe("@promyra/tui-pro ToolContent", () => {
  it("renders read tool with file content", () => {
    const { lastFrame } = render(
      <ToolContent
        tool="read"
        args={{ path: "/x.ts" }}
        result="const x = 1;\nconst y = 2;"
        status="done"
      />
    );
    const out = lastFrame();
    expect(out).toContain("read");
    expect(out).toContain("/x.ts");
    expect(out).toContain("const x = 1;");
  });

  it("renders grep with file:line format", () => {
    const { lastFrame } = render(
      <ToolContent
        tool="grep"
        args={{ pattern: "TODO" }}
        result="src/foo.ts:10:  // TODO: fix\nsrc/bar.ts:20:  // TODO: refactor"
        status="done"
      />
    );
    const out = lastFrame();
    expect(out).toContain("grep");
    expect(out).toContain("src/foo.ts");
    expect(out).toContain("10");
  });

  it("renders bash output", () => {
    const { lastFrame } = render(
      <ToolContent
        tool="bash"
        args={{ command: "ls" }}
        result="file1.txt\nfile2.txt"
        status="done"
      />
    );
    const out = lastFrame();
    expect(out).toContain("$");
    expect(out).toContain("file1.txt");
  });

  it("renders glob results", () => {
    const { lastFrame } = render(
      <ToolContent
        tool="glob"
        args={{ pattern: "**/*.ts" }}
        result="src/a.ts\nsrc/b.ts"
        status="done"
      />
    );
    expect(lastFrame()).toContain("src/a.ts");
  });

  it("renders running status with ellipsis", () => {
    const { lastFrame } = render(
      <ToolContent tool="read" args={{ path: "/x" }} status="running" />
    );
    const out = lastFrame();
    expect(out).toContain("...");
  });

  it("renders done with check", () => {
    const { lastFrame } = render(
      <ToolContent tool="read" args={{ path: "/x" }} status="done" />
    );
    const out = lastFrame();
    expect(out).toContain("✓");
  });

  it("truncates long file content", () => {
    const longContent = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const { lastFrame } = render(
      <ToolContent tool="read" args={{ path: "/x" }} result={longContent} status="done" />
    );
    expect(lastFrame()).toContain("more lines");
  });
});

describe("@promyra/tui-pro ErrorMessage", () => {
  it("renders with X icon and red text", () => {
    const { lastFrame } = render(<ErrorMessage text="test failed" />);
    const out = lastFrame();
    expect(out).toContain("✗");
    expect(out).toContain("test failed");
  });
});

describe("@promyra/tui-pro Footer", () => {
  it("shows workdir and version", () => {
    const { lastFrame } = render(<Footer workdir="/tmp" version="0.8.0" />);
    const out = lastFrame();
    expect(out).toContain("/tmp");
    expect(out).toContain("promyra");
    expect(out).toContain("0.8.0");
  });

  it("shows branch with workdir", () => {
    const { lastFrame } = render(<Footer workdir="/tmp" branch="dev" />);
    expect(lastFrame()).toContain(":dev");
  });

  it("shows permission count", () => {
    const { lastFrame } = render(<Footer permissions={3} />);
    expect(lastFrame()).toContain("△");
  });

  it("shows MCP count", () => {
    const { lastFrame } = render(<Footer mcp={2} />);
    const out = lastFrame();
    expect(out).toContain("⊙");
    expect(out).toContain("2");
    expect(out).toContain("MCP");
  });

  it("shows get started when disconnected", () => {
    const { lastFrame } = render(<Footer connected={false} />);
    expect(lastFrame()).toContain("Get started");
  });

  it("shows tab badge", () => {
    const { lastFrame } = render(<Footer tab="[BUILD]" />);
    expect(lastFrame()).toContain("[BUILD]");
  });
});

describe("@promyra/tui-pro Sidebar", () => {
  it("shows title and workdir", () => {
    const { lastFrame } = render(
      <Sidebar title="My session" workdir="/tmp" />
    );
    const out = lastFrame();
    expect(out).toContain("My session");
    expect(out).toContain("/tmp");
  });

  it("shows agent and model", () => {
    const { lastFrame } = render(
      <Sidebar agent="build" model="minimax-m3" provider="opencode-go" />
    );
    const out = lastFrame();
    expect(out).toContain("build");
    expect(out).toContain("minimax-m3");
    expect(out).toContain("opencode-go");
  });

  it("shows session id", () => {
    const { lastFrame } = render(<Sidebar sessionId="tsk_abc" />);
    expect(lastFrame()).toContain("tsk_abc");
  });
});

describe("@promyra/tui-pro SubagentFooter", () => {
  it("shows label and index", () => {
    const { lastFrame } = render(
      <SubagentFooter label="Search" index={2} total={5} />
    );
    const out = lastFrame();
    expect(out).toContain("Search");
    expect(out).toContain("2 of 5");
  });

  it("shows tokens and cost", () => {
    const { lastFrame } = render(
      <SubagentFooter label="X" tokens={1500} cost={0.05} />
    );
    const out = lastFrame();
    expect(out).toContain("1,500");
    expect(out).toContain("$0.05");
  });

  it("shows Parent/Prev/Next jumpers when handlers provided", () => {
    const { lastFrame } = render(
      <SubagentFooter
        label="X"
        onParent={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />
    );
    const out = lastFrame();
    expect(out).toContain("Parent");
    expect(out).toContain("Prev");
    expect(out).toContain("Next");
  });
});

describe("@promyra/tui-pro PermissionPrompt", () => {
  it("renders permission header", () => {
    const { lastFrame } = render(
      <PermissionPrompt
        request={{ id: "1", permission: "bash", tool: "bash", args: { command: "rm -rf" } }}
      />
    );
    const out = lastFrame();
    expect(out).toContain("Permission required");
    expect(out).toContain("Once");
    expect(out).toContain("Always");
    expect(out).toContain("Reject");
    expect(out).toContain("rm -rf");
  });

  it("highlights selected option", () => {
    const { lastFrame } = render(
      <PermissionPrompt
        request={{ id: "1", permission: "edit", tool: "edit", args: {} }}
        selected={1}
      />
    );
    const out = lastFrame();
    expect(out).toContain("Always");
  });
});

describe("@promyra/tui-pro HomeScreen", () => {
  it("renders logo and prompt", () => {
    const { lastFrame } = render(
      <HomeScreen
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        agent="build"
        model="minimax-m3"
        provider="opencode-go"
      />
    );
    const out = lastFrame();
    expect(out).toContain("▀");
  });

  it("shows footer with workdir", () => {
    const { lastFrame } = render(
      <HomeScreen value="" onChange={() => {}} onSubmit={() => {}} workdir="/tmp" />
    );
    expect(lastFrame()).toContain("/tmp");
  });
});

describe("@promyra/tui-pro SessionScreen", () => {
  it("renders empty state", () => {
    const { lastFrame } = render(
      <SessionScreen
        messages={[]}
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        running={false}
      />
    );
    expect(lastFrame()).toContain("Start typing");
  });

  it("renders user message and assistant", () => {
    const { lastFrame } = render(
      <SessionScreen
        messages={[
          { id: "1", role: "user", parts: [{ kind: "text", text: "fix auth" }], time: Date.now() },
          {
            id: "2",
            role: "assistant",
            parts: [
              { kind: "text", text: "Looking at it." },
              { kind: "tool", tool: "read", toolName: "read", args: { path: "/x.ts" }, status: "done", result: "code" },
            ],
            time: Date.now(),
            model: "minimax-m3",
            agent: "build",
          },
        ]}
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        running={false}
      />
    );
    const out = lastFrame();
    expect(out).toContain("fix auth");
    expect(out).toContain("Looking at it");
    expect(out).toContain("read");
    expect(out).toContain("/x.ts");
  });

  it("shows header row with tokens", () => {
    const { lastFrame } = render(
      <SessionScreen
        messages={[]}
        meta={{
          id: "tsk_x",
          title: "Fix bug",
          agent: "build",
          model: "minimax-m3",
          provider: "opencode-go",
          workdir: "/tmp",
          tokensIn: 1000,
          tokensOut: 500,
          cost: 0.04,
        }}
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        running={false}
      />
    );
    expect(lastFrame()).toContain("Fix bug");
  });

  it("shows permission prompt when requested", () => {
    const { lastFrame } = render(
      <SessionScreen
        messages={[]}
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        running={false}
        permissionRequest={{ id: "1", permission: "bash", tool: "bash", args: { command: "rm" } }}
      />
    );
    expect(lastFrame()).toContain("Permission required");
  });

  it("shows subagent footer when subagent active", () => {
    const { lastFrame } = render(
      <SessionScreen
        messages={[]}
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        running={false}
        subagent={{ label: "Search", index: 1, total: 3, tokens: 500, cost: 0.01 }}
      />
    );
    expect(lastFrame()).toContain("Search");
  });
});

describe("@promyra/tui-pro App", () => {
  it("renders home screen when no initial task", () => {
    const { lastFrame } = render(<App />);
    expect(lastFrame()).toContain("▀");
  });

  it("renders session screen with initial task", () => {
    const { lastFrame } = render(<App initialTask="fix the auth bug" />);
    expect(lastFrame()).toContain("fix the auth bug");
  });
});
