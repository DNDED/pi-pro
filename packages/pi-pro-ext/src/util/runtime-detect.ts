import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface RuntimeInfo {
  name: string;
  version: string | null;
}

const RUNTIME_MARKERS: Array<{
  name: string;
  files: string[];
  versionFrom?: { file: string; regex: RegExp };
}> = [
  { name: "node", files: ["package.json"], versionFrom: { file: "package.json", regex: /"engines"\s*:\s*\{[^}]*"node"\s*:\s*"?([^",}]+)/ } },
  { name: "bun", files: ["bun.lock", "bun.lockb", "package.json"] },
  { name: "deno", files: ["deno.json", "deno.jsonc", "deno.lock"] },
  { name: "go", files: ["go.mod"] },
  { name: "rust", files: ["Cargo.toml"] },
  { name: "python", files: ["pyproject.toml", "setup.py", "requirements.txt", "Pipfile"] },
  { name: "ruby", files: ["Gemfile", ".ruby-version"] },
  { name: "cmake", files: ["CMakeLists.txt", "CMakeCache.txt"] },
  { name: "java", files: [".java-version", "pom.xml", "build.gradle", "build.gradle.kts"] },
  { name: "swift", files: ["Package.swift"] },
];

export function detectRuntime(cwd: string): RuntimeInfo | null {
  for (const marker of RUNTIME_MARKERS) {
    for (const f of marker.files) {
      const p = join(cwd, f);
      if (existsSync(p)) {
        let version: string | null = null;
        if (marker.versionFrom && marker.versionFrom.file === f) {
          try {
            const content = readFileSync(p, "utf8");
            const m = content.match(marker.versionFrom.regex);
            if (m && m[1]) version = m[1];
          } catch {
            // ignore
          }
        }
        return { name: marker.name, version };
      }
    }
  }
  return null;
}

export function formatRuntime(info: RuntimeInfo): string {
  return info.version ? `via ${info.name} ${info.version}` : `via ${info.name}`;
}
