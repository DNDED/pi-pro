import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type AnyHandler = (event: any, ctx: any) => Promise<any> | any;
type CmdHandler = (args: string | undefined, ctx: any) => Promise<any> | any;
type ShortcutHandler = (ctx: any) => Promise<any> | any;
type ToolExecute = (
  toolCallId: string,
  params: any,
  signal: AbortSignal | undefined,
  onUpdate: any,
  ctx: any,
) => Promise<any>;

interface MockPi {
  handlers: Map<string, AnyHandler[]>;
  commands: Map<string, { description: string; handler: CmdHandler }>;
  tools: Map<string, { label: string; description: string; parameters: any; execute: ToolExecute; renderCall?: any; renderResult?: any }>;
  shortcuts: Map<string, { description: string; handler: ShortcutHandler }>;
  flags: Map<string, any>;
  activeTools: string[] | null;
  sentMessages: Array<{ type: "user" | "custom"; content: any; options?: any }>;
  execCalls: Array<{ command: string; args: string[] }>;
  appendEntryCalls: Array<{ type: string; data: any }>;
  getAllTools: () => Array<{ name: string }>;
  on: (event: string, handler: AnyHandler) => void;
  registerCommand: (name: string, opts: { description: string; handler: CmdHandler }) => void;
  registerTool: (tool: any) => void;
  registerShortcut: (key: string, opts: { description: string; handler: ShortcutHandler }) => void;
  registerFlag: (name: string, opts: any) => void;
  setActiveTools: (names: string[]) => void;
  getActiveTools: () => string[];
  sendUserMessage: (content: any, options?: any) => void;
  sendMessage: (message: any, options?: any) => void;
  appendEntry: (type: string, data?: any) => void;
  exec: (command: string, args: string[], options?: any) => Promise<any>;
  getFlag: (name: string) => any;
  getCommands: () => any[];
  setSessionName: (n: string) => void;
  getSessionName: () => string | undefined;
  setLabel: (id: string, label: string | undefined) => void;
  setEditorComponent: (factory: any) => void;
}

function makeMockPi(): MockPi {
  const pi: MockPi = {
    handlers: new Map(),
    commands: new Map(),
    tools: new Map(),
    shortcuts: new Map(),
    flags: new Map(),
    activeTools: null,
    sentMessages: [],
    execCalls: [],
    appendEntryCalls: [],
    getAllTools: () => [],
  } as any;
  pi.on = (event, handler) => { (pi.handlers.get(event) ?? pi.handlers.set(event, []).get(event)!).push(handler); };
  pi.registerCommand = (name, opts) => { pi.commands.set(name, opts); };
  pi.registerTool = (tool) => { pi.tools.set(tool.name, tool); };
  pi.registerShortcut = (key, opts) => { pi.shortcuts.set(key, opts); };
  pi.registerFlag = (name, opts) => { pi.flags.set(name, opts); };
  pi.setActiveTools = (names) => { pi.activeTools = names; };
  pi.getActiveTools = () => pi.activeTools ?? [];
  pi.sendUserMessage = (content, options) => { pi.sentMessages.push({ type: "user", content, options }); };
  pi.sendMessage = (message, options) => { pi.sentMessages.push({ type: "custom", content: message, options }); };
  pi.appendEntry = (type, data) => { pi.appendEntryCalls.push({ type, data }); };
  pi.exec = async () => ({ stdout: "", stderr: "", exitCode: 0 });
  pi.getFlag = (name) => pi.flags.get(name)?.default;
  pi.getCommands = () => Array.from(pi.commands.entries()).map(([name, c]) => ({ name, description: c.description }));
  pi.setSessionName = () => {};
  pi.getSessionName = () => undefined;
  pi.setLabel = () => {};
  pi.setEditorComponent = () => {};
  return pi;
}

interface MockUI {
  notifies: Array<{ message: string; type: "info" | "warning" | "error" }>;
  statuses: Map<string, string | undefined>;
  widgets: Map<string, string[] | undefined>;
  input: (title: string, placeholder?: string) => Promise<string | undefined>;
  setStatus: (key: string, text: string | undefined) => void;
  setWidget: (key: string, content: string[] | undefined, opts?: any) => void;
  notify: (message: string, type?: "info" | "warning" | "error") => void;
  setHeader: (factory: any) => void;
  setFooter: (factory: any) => void;
  setWorkingVisible: (visible: boolean) => void;
  setEditorComponent: (factory: any) => void;
  select: (title: string, options: string[], opts?: any) => Promise<string | undefined>;
  confirm: (title: string, message: string, opts?: any) => Promise<boolean>;
  hasUI: boolean;
}

function makeMockUI(): MockUI {
  const ui: MockUI = {
    notifies: [],
    statuses: new Map(),
    widgets: new Map(),
    input: async () => undefined,
    select: async () => undefined,
    confirm: async () => false,
    hasUI: true,
  } as any;
  ui.setStatus = (key, text) => ui.statuses.set(key, text);
  ui.setWidget = (key, content) => ui.widgets.set(key, content);
  ui.setHeader = () => {};
  ui.setFooter = () => {};
  ui.setWorkingVisible = () => {};
  ui.setEditorComponent = () => {};
  ui.notify = (message, type = "info") => ui.notifies.push({ message, type });
  return ui;
}

function makeMockCtx(overrides: any = {}) {
  return {
    hasUI: true,
    ui: overrides.ui ?? makeMockUI(),
    getContextUsage: overrides.getContextUsage ?? (() => ({ tokens: 5000, contextWindow: 200000, percent: 0.025 })),
    abort: () => {},
    shutdown: () => {},
    getModel: overrides.getModel ?? (() => ({ provider: "opencode-go", id: "kimi-k2.6" })),
    isIdle: () => true,
    compact: () => {},
    newSession: async () => ({}),
    hasPendingMessages: () => false,
    getSystemPrompt: () => "",
    waitForIdle: async () => {},
    reload: () => {},
  };
}

let tmpHome: string;
let originalHome: string;
let originalXdg: string | undefined;
let originalOverride: string | undefined;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "pi-pro-int-"));
  originalHome = process.env.HOME ?? "";
  originalXdg = process.env.XDG_CONFIG_HOME;
  originalOverride = process.env.PI_HOME_OVERRIDE;
  process.env.HOME = tmpHome;
  process.env.PI_HOME_OVERRIDE = tmpHome;
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.OPENCODE_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  process.env.HOME = originalHome;
  if (originalXdg !== undefined) process.env.XDG_CONFIG_HOME = originalXdg;
  else delete process.env.XDG_CONFIG_HOME;
  if (originalOverride !== undefined) process.env.PI_HOME_OVERRIDE = originalOverride;
  else delete process.env.PI_HOME_OVERRIDE;
  if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
});

const configPath = () => join(tmpHome, ".pi", "agent", "pi.json");
const getAuthPath = () => join(tmpHome, ".pi", "agent");
const writeConfig = (data: object) => {
  mkdirSync(join(tmpHome, ".pi", "agent"), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(data) as string);
};

/** Invoke all handlers for an event with the same ctx (multiple handlers may
 *  exist for session_start, agent_end, etc.) */
async function fireAll(pi: MockPi, event: string, payload: any, ctx: any): Promise<void> {
  const handlers = pi.handlers.get(event) ?? [];
  for (const h of handlers) {
    await h(payload, ctx);
  }
}

async function loadExtension(): Promise<{ pi: MockPi; ui: MockUI; reload: () => Promise<{ pi: MockPi; ui: MockUI }> }> {
  const { default: factory } = await import("../index.js");
  const pi = makeMockPi();
  factory(pi as any);
  const ui = makeMockUI();
  return {
    pi,
    ui,
    reload: async () => {
      vi.resetModules();
      const { default: f2 } = await import("../index.js");
      const pi2 = makeMockPi();
      f2(pi2 as any);
      const ui2 = makeMockUI();
      return { pi: pi2, ui: ui2 };
    },
  };
}

const EXPECTED_COMMANDS = [
  "mode", "plan", "todos", "config", "doctor", "theme", "apikey",
  "memory-add", "memory-list", "memory-search", "memory-clear",
  "palette", "help", "btw", "context",
];

describe("extension wiring", () => {
  it("registers all 15 commands with / prefix", async () => {
    const { pi } = await loadExtension();
    for (const name of EXPECTED_COMMANDS) {
      expect(pi.commands.has(name), `/${name}`).toBe(true);
    }
  });

  it("registers the todo tool", async () => {
    const { pi } = await loadExtension();
    expect(pi.tools.has("todo")).toBe(true);
  });

  it("registers the tab + ctrl+p shortcuts", async () => {
    const { pi } = await loadExtension();
    expect(pi.shortcuts.has("tab")).toBe(true);
    expect(pi.shortcuts.has("ctrl+p")).toBe(true);
  });

  it("registers all event handlers", async () => {
    const { pi } = await loadExtension();
    for (const e of ["session_start", "tool_call", "before_agent_start", "agent_end", "turn_end", "session_shutdown", "agent_start"]) {
      expect((pi.handlers.get(e) ?? []).length, `event ${e}`).toBeGreaterThan(0);
    }
  });
});

describe("session_start", () => {
  it("sets pi-pro status with mode + version", async () => {
    const { pi, ui } = await loadExtension();
    await fireAll(pi, "session_start", {}, makeMockCtx({ ui }));
    const status = ui.statuses.get("pi-pro");
    expect(status).toBeDefined();
    expect(status).toContain("pi-pro v0.2.5");
    expect(status).toContain("BUILD");
  });

  it("shows PLAN RO status in plan mode", async () => {
    writeConfig({ version: 1, provider: { name: "opencode-go", model: "kimi-k2.6" }, agent: { name: "plan", maxIterations: 10, toolBudget: 6 }, theme: { name: "default" } });
    const { pi, ui } = await loadExtension();
    await fireAll(pi, "session_start", {}, makeMockCtx({ ui }));
    const status = ui.statuses.get("pi-pro");
    expect(status).toContain("PLAN RO");
  });

  it("writes orange to zentui.json on first session_start", async () => {
    const { pi } = await loadExtension();
    await fireAll(pi, "session_start", {}, makeMockCtx({}));
    const zentui = join(tmpHome, ".pi", "agent", "zentui.json");
    expect(existsSync(zentui)).toBe(true);
    const z = JSON.parse(readFileSync(zentui, "utf8"));
    expect(z.colors.editorAccent).toBe("#EC5B2B");
  });

  it("writes keybindings.json on first session_start", async () => {
    const { pi } = await loadExtension();
    await fireAll(pi, "session_start", {}, makeMockCtx({}));
    const kb = join(tmpHome, ".pi", "agent", "keybindings.json");
    expect(existsSync(kb)).toBe(true);
    const k = JSON.parse(readFileSync(kb, "utf8"));
    expect(k["app.model.cycleForward"]).toEqual(["f2"]);
  });

  it("calls setEditorComponent to install chrome", async () => {
    const { pi } = await loadExtension();
    await expect(fireAll(pi, "session_start", {}, makeMockCtx({}))).resolves.not.toThrow();
  });
});

describe("plan mode enforcement", () => {
  it("blocks rm -rf in plan mode", async () => {
    writeConfig({ version: 1, provider: { name: "opencode-go", model: "kimi-k2.6" }, agent: { name: "plan", maxIterations: 10, toolBudget: 6 }, theme: { name: "default" } });
    const { pi } = await loadExtension();
    const handler = pi.handlers.get("tool_call")![0]!;
    const r = await handler({ toolName: "bash", input: { command: "rm -rf /tmp/x" } }, makeMockCtx());
    expect(r).toEqual({ block: true, reason: expect.stringContaining("destructive") });
  });

  it("blocks write in plan mode", async () => {
    writeConfig({ version: 1, provider: { name: "opencode-go", model: "kimi-k2.6" }, agent: { name: "plan", maxIterations: 10, toolBudget: 6 }, theme: { name: "default" } });
    const { pi } = await loadExtension();
    const handler = pi.handlers.get("tool_call")![0]!;
    const r = await handler({ toolName: "write", input: {} }, makeMockCtx());
    expect(r).toEqual({ block: true, reason: expect.stringContaining("read-only") });
  });

  it("allows safe bash in plan mode", async () => {
    writeConfig({ version: 1, provider: { name: "opencode-go", model: "kimi-k2.6" }, agent: { name: "plan", maxIterations: 10, toolBudget: 6 }, theme: { name: "default" } });
    const { pi } = await loadExtension();
    const handler = pi.handlers.get("tool_call")![0]!;
    const r = await handler({ toolName: "bash", input: { command: "ls /tmp" } }, makeMockCtx());
    expect(r).toBeUndefined();
  });

  it("does not block in build mode", async () => {
    const { pi } = await loadExtension();
    const handler = pi.handlers.get("tool_call")![0]!;
    const r = await handler({ toolName: "bash", input: { command: "rm -rf /tmp/x" } }, makeMockCtx());
    expect(r).toBeUndefined();
  });
});

describe("before_agent_start", () => {
  it("injects plan-mode system prompt", async () => {
    writeConfig({ version: 1, provider: { name: "opencode-go", model: "kimi-k2.6" }, agent: { name: "plan", maxIterations: 10, toolBudget: 6 }, theme: { name: "default" } });
    const { pi } = await loadExtension();
    const handler = pi.handlers.get("before_agent_start")![0]!;
    const r = await handler({}, makeMockCtx());
    expect(r.message).toBeDefined();
    expect(r.message.customType).toBe("pi-pro-plan-mode");
    expect(r.message.content).toContain("PLAN MODE ACTIVE");
  });

  it("does nothing in build mode", async () => {
    const { pi } = await loadExtension();
    const handler = pi.handlers.get("before_agent_start")![0]!;
    const r = await handler({}, makeMockCtx());
    expect(r).toBeUndefined();
  });
});

describe(":apikey command (replaces dead :login)", () => {
  it("writes key to auth.json with mode 0600", async () => {
    const { pi, ui } = await loadExtension();
    const cmd = pi.commands.get("apikey")!;
    await cmd.handler("opencode-go sk-test-1234567890", makeMockCtx({ ui }));
    const authPath = join(getAuthPath(), "auth.json");
    const stat = statSync(authPath);
    expect(stat.mode & 0o777).toBe(0o600);
    const data = JSON.parse(readFileSync(authPath, "utf8"));
    expect(data["opencode-go"].key).toBe("sk-test-1234567890");
  });

  it("rejects missing provider", async () => {
    const { pi, ui } = await loadExtension();
    const cmd = pi.commands.get("apikey")!;
    await cmd.handler("", makeMockCtx({ ui }));
    expect(ui.notifies.some((n) => n.type === "error" && n.message.includes("usage"))).toBe(true);
  });

  it("prompts via ctx.ui.input when key missing", async () => {
    const { pi, ui } = await loadExtension();
    ui.input = async () => "sk-prompted-key";
    const cmd = pi.commands.get("apikey")!;
    await cmd.handler("opencode-go", makeMockCtx({ ui }));
    const authPath = join(getAuthPath(), "auth.json");
    const data = JSON.parse(readFileSync(authPath, "utf8"));
    expect(data["opencode-go"].key).toBe("sk-prompted-key");
  });

  it("cancels on empty input", async () => {
    const { pi, ui } = await loadExtension();
    ui.input = async () => undefined;
    const cmd = pi.commands.get("apikey")!;
    await cmd.handler("opencode-go", makeMockCtx({ ui }));
    expect(ui.notifies.some((n) => n.message.includes("cancelled"))).toBe(true);
  });
});

describe(":palette command", () => {
  it("exists and is registered", async () => {
    const { pi } = await loadExtension();
    expect(pi.commands.has("palette")).toBe(true);
  });
});

describe("Tab shortcut two-way cycle", () => {
  it("build -> plan -> build restores all tools", async () => {
    const { pi, ui } = await loadExtension();
    pi.getAllTools = () => [{ name: "bash" }, { name: "read" }, { name: "write" }, { name: "edit" }, { name: "todo" }] as any;
    await fireAll(pi, "session_start", undefined, makeMockCtx({ ui }));

    const sc = pi.shortcuts.get("tab")!;
    await sc.handler(makeMockCtx({ ui }));
    expect(pi.activeTools).toEqual(["read", "bash", "grep", "find", "ls", "questionnaire"]);

    await sc.handler(makeMockCtx({ ui }));
    expect(pi.activeTools).toEqual(["bash", "read", "write", "edit", "todo"]);
  });
});

describe("plan widget lifecycle", () => {
  it("sets widget on agent_end when plan parsed", async () => {
    writeConfig({ version: 1, provider: { name: "opencode-go", model: "kimi-k2.6" }, agent: { name: "plan", maxIterations: 10, toolBudget: 6 }, theme: { name: "default" } });
    const { pi, ui } = await loadExtension();
    await fireAll(pi, "agent_end", { messages: [{ role: "assistant", content: "Plan:\n1. A\n2. B" }] }, makeMockCtx({ ui }));
    expect(ui.widgets.has("pi-pro-plan")).toBe(true);
  });

  it("re-parses on new plan in same session", async () => {
    writeConfig({ version: 1, provider: { name: "opencode-go", model: "kimi-k2.6" }, agent: { name: "plan", maxIterations: 10, toolBudget: 6 }, theme: { name: "default" } });
    const { pi, ui } = await loadExtension();
    await fireAll(pi, "agent_end", { messages: [{ role: "assistant", content: "Plan:\n1. A\n2. B" }] }, makeMockCtx({ ui }));
    await fireAll(pi, "agent_end", { messages: [{ role: "assistant", content: "Plan:\n1. New A\n2. New B" }] }, makeMockCtx({ ui }));
    const lines = ui.widgets.get("pi-pro-plan")!;
    expect(lines.join(" ")).toMatch(/New A|New B/);
  });
});
