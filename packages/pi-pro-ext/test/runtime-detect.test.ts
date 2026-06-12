import { describe, it, expect, afterEach } from "vitest";
import { detectRuntime, formatRuntime } from "../src/util/runtime-detect.js";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let dirs: string[] = [];
function tmpCwd(): string {
  const d = mkdtempSync(join(tmpdir(), `pi-pro-rt-${Date.now()}-${Math.random().toString(36).slice(2)}`));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs) if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("detectRuntime", () => {
  it("Node via package.json (no version)", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "package.json"), "{}");
    const r = detectRuntime(cwd);
    expect(r?.name).toBe("node");
    expect(r?.version).toBeNull();
  });

  it("extracts Node version from engines", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ engines: { node: ">=20.0.0" } }));
    const r = detectRuntime(cwd);
    expect(r?.name).toBe("node");
    expect(r?.version).toBe(">=20.0.0");
  });

  it("Go via go.mod", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "go.mod"), "module x\n\ngo 1.21");
    expect(detectRuntime(cwd)?.name).toBe("go");
  });

  it("Rust via Cargo.toml", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "Cargo.toml"), "[package]\nname = \"x\"");
    expect(detectRuntime(cwd)?.name).toBe("rust");
  });

  it("Python via pyproject.toml", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "pyproject.toml"), "[project]\nname=\"x\"");
    expect(detectRuntime(cwd)?.name).toBe("python");
  });

  it("Python via requirements.txt", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "requirements.txt"), "flask");
    expect(detectRuntime(cwd)?.name).toBe("python");
  });

  it("Bun via bun.lock", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "bun.lock"), "");
    expect(detectRuntime(cwd)?.name).toBe("bun");
  });

  it("Ruby via Gemfile", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "Gemfile"), "source 'https://rubygems.org'");
    expect(detectRuntime(cwd)?.name).toBe("ruby");
  });

  it("CMake via CMakeLists.txt", () => {
    const cwd = tmpCwd();
    writeFileSync(join(cwd, "CMakeLists.txt"), "cmake_minimum_required");
    expect(detectRuntime(cwd)?.name).toBe("cmake");
  });

  it("returns null for empty dir", () => {
    expect(detectRuntime(tmpCwd())).toBeNull();
  });
});

describe("formatRuntime", () => {
  it("with version", () => {
    expect(formatRuntime({ name: "node", version: "20.0.0" })).toBe("via node 20.0.0");
  });
  it("without version", () => {
    expect(formatRuntime({ name: "go", version: null })).toBe("via go");
  });
});
