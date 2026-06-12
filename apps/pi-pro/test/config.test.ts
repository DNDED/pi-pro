import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpHome = join(tmpdir(), `pi-config-test-${Date.now()}`);

beforeEach(async () => {
  await mkdir(join(tmpHome, ".pi"), { recursive: true });
  process.env.PI_HOME_OVERRIDE = tmpHome;
  vi.resetModules();
});

afterEach(async () => {
  await rm(tmpHome, { recursive: true, force: true });
  delete process.env.PI_HOME_OVERRIDE;
  vi.resetModules();
});

describe("pi config command (v0.8.4)", () => {
  it("shows default config when nothing set", async () => {
    const { config } = await import("../src/commands/config.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await config();
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain("provider:");
    expect(out).toContain("opencode-go");
    expect(out).toContain("model:");
    expect(out).toContain("agent:");
    log.mockRestore();
  });

  it("set action updates model", async () => {
    const { config } = await import("../src/commands/config.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await config("set", "model", "minimax-m3");
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain("model = minimax-m3");
    log.mockRestore();
  });

  it("set action updates agent", async () => {
    const { config } = await import("../src/commands/config.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await config("set", "agent", "plan");
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain("agent = plan");
    log.mockRestore();
  });

  it("set action supports dotted keys (ui.copyFriendly)", async () => {
    const { config } = await import("../src/commands/config.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await config("set", "ui.copyFriendly", "true");
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain("ui.copyFriendly = true");
    log.mockRestore();
  });

  it("set action errors on missing key", async () => {
    const { config } = await import("../src/commands/config.js");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation(((code: number) => { throw new Error(`__exit_${code}__`); }) as never);
    try {
      await config("set", undefined, "value");
    } catch (e) {
      if (!(e instanceof Error) || !e.message.startsWith("__exit_")) throw e;
    }
    expect(err).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
    err.mockRestore();
    exit.mockRestore();
  });

  it("path action prints config path", async () => {
    const { config } = await import("../src/commands/config.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await config("path");
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain(".pi/pi.json");
    log.mockRestore();
  });

  it("unknown action errors", async () => {
    const { config } = await import("../src/commands/config.js");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation(((code: number) => { throw new Error(`__exit_${code}__`); }) as never);
    try {
      await config("bogus");
    } catch (e) {
      if (!(e instanceof Error) || !e.message.startsWith("__exit_")) throw e;
    }
    expect(err).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
    err.mockRestore();
    exit.mockRestore();
  });
});

describe("pi mode command (v0.8.4)", () => {
  it("shows current mode + available modes", async () => {
    const { mode } = await import("../src/commands/mode.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await mode();
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain("build");
    expect(out).toContain("plan");
    expect(out).toContain("available:");
    log.mockRestore();
  });

  it("set switches to plan", async () => {
    const { mode } = await import("../src/commands/mode.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await mode("set", "plan");
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain("plan");
    log.mockRestore();
  });
});

describe("pi plan command (v0.8.4)", () => {
  it("toggle enables plan mode", async () => {
    const { plan } = await import("../src/commands/plan.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await plan("toggle");
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain("ON");
    log.mockRestore();
  });
});

describe("pi ui command (v0.8.4)", () => {
  it("show displays ui config", async () => {
    const { ui } = await import("../src/commands/ui.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await ui();
    const out = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(out).toContain("editor:");
    expect(out).toContain("copy-friendly:");
    log.mockRestore();
  });
});
