import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getConfigPath, getConfigDir } from "../src/index.js";

describe("paths", () => {
  const origHome = process.env.PI_HOME_OVERRIDE;
  const origXdg = process.env.XDG_CONFIG_HOME;
  beforeEach(() => {
    delete process.env.PI_HOME_OVERRIDE;
    delete process.env.XDG_CONFIG_HOME;
  });
  afterEach(() => {
    if (origHome !== undefined) process.env.PI_HOME_OVERRIDE = origHome;
    if (origXdg !== undefined) process.env.XDG_CONFIG_HOME = origXdg;
  });

  it("uses ~/.pi/pi.json by default", () => {
    const path = getConfigPath();
    expect(path.endsWith(".pi/pi.json")).toBe(true);
  });

  it("respects PI_HOME_OVERRIDE", () => {
    process.env.PI_HOME_OVERRIDE = "/tmp/custom-home";
    const path = getConfigPath();
    expect(path.startsWith("/tmp/custom-home")).toBe(true);
  });

  it("returns config dir for editing", () => {
    const dir = getConfigDir();
    expect(dir).toContain(".pi");
  });
});
