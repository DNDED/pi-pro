/**
 * v0.5.0 + v0.7.0 PROMYRA_* environment flags.
 *
 * Per spec §5:
 *   PROMYRA_CACHE=0          # disable prompt cache
 *   PROMYRA_REPO_MAP=0       # disable repo map (block + tool)
 *   PROMYRA_CASCADE=0        # disable cascade routing
 *   PROMYRA_PARALLEL_TOOLS=0 # disable parallel tool execution
 *   PROMYRA_TELEMETRY=0      # disable cost telemetry
 *
 * v0.7.0:
 *   PROMYRA_MEMORY=0         # disable context-manager memory injection
 *   PROMYRA_COMPRESSION=off  # off | extractive | llm | hybrid
 *   PROMYRA_EMBEDDINGS=...   # openai | anthropic | opencode-go | null
 *   PROMYRA_MEMORY_QUERY_K=20
 *   PROMYRA_SOFT_WARN=0.75
 *   PROMYRA_HARD_TRIGGER=0.90
 *
 * All default ON (set to "0", "false", or "no" to disable).
 */

import type { OptimizerFlags } from "@pi/optimizer";

export type CompressionChoice = "off" | "extractive" | "llm" | "hybrid";
export type EmbeddingsChoice = "openai" | "anthropic" | "opencode-go" | "null";

export interface ContextFlags {
  memory: boolean;
  compression: CompressionChoice;
  embeddings: EmbeddingsChoice;
  memoryQueryK: number;
  softWarn: number;
  hardTrigger: number;
}

function envFlag(name: string): boolean {
  const v = process.env[name];
  if (v === undefined) return true;
  const s = v.toLowerCase().trim();
  return !(s === "0" || s === "false" || s === "no" || s === "off");
}

function envString(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function envNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return fallback;
  return n;
}

export function readFlagsFromEnv(): Required<OptimizerFlags> {
  return {
    cache: envFlag("PROMYRA_CACHE"),
    repoMap: envFlag("PROMYRA_REPO_MAP"),
    cascade: envFlag("PROMYRA_CASCADE"),
    parallelTools: envFlag("PROMYRA_PARALLEL_TOOLS"),
    telemetry: envFlag("PROMYRA_TELEMETRY"),
  };
}

export function readContextFlagsFromEnv(): ContextFlags {
  const comp = envString("PROMYRA_COMPRESSION", "hybrid").toLowerCase();
  const validCompressions: CompressionChoice[] = ["off", "extractive", "llm", "hybrid"];
  const compression: CompressionChoice = (validCompressions as string[]).includes(comp) ? (comp as CompressionChoice) : "hybrid";
  const emb = envString("PROMYRA_EMBEDDINGS", "").toLowerCase();
  const validEmbeddings: EmbeddingsChoice[] = ["openai", "anthropic", "opencode-go", "null"];
  const embeddings: EmbeddingsChoice = (validEmbeddings as string[]).includes(emb) ? (emb as EmbeddingsChoice) : "openai";
  return {
    memory: envFlag("PROMYRA_MEMORY"),
    compression,
    embeddings,
    memoryQueryK: envNumber("PROMYRA_MEMORY_QUERY_K", 20),
    softWarn: envNumber("PROMYRA_SOFT_WARN", 0.75),
    hardTrigger: envNumber("PROMYRA_HARD_TRIGGER", 0.90),
  };
}

export function formatFlagsStatus(flags: Required<OptimizerFlags>): string {
  const items: Array<[string, boolean]> = [
    ["cache", flags.cache],
    ["repoMap", flags.repoMap],
    ["cascade", flags.cascade],
    ["parallelTools", flags.parallelTools],
    ["telemetry", flags.telemetry],
  ];
  return items.map(([k, on]) => `${k}: ${on ? "ON" : "off"}`).join("  ");
}

export function formatContextFlagsStatus(flags: ContextFlags): string {
  return [
    `memory: ${flags.memory ? "ON" : "off"}`,
    `compression: ${flags.compression}`,
    `embeddings: ${flags.embeddings}`,
    `memoryQueryK: ${flags.memoryQueryK}`,
    `softWarn: ${flags.softWarn}`,
    `hardTrigger: ${flags.hardTrigger}`,
  ].join("  ");
}
