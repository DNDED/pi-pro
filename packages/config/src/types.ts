import { z } from "zod";

export const AgentModeSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  color: z.string().default("primary"),
  activeTools: z.array(z.string()).default([]),
  bashAllowlist: z.array(z.instanceof(RegExp)).optional(),
  systemPromptAppend: z.string().optional(),
  readOnly: z.boolean().default(false),
});
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const PiConfigSchema = z.object({
  version: z.literal(1),
  provider: z.object({
    name: z.string().min(1),
    model: z.string().min(1),
    baseUrl: z.string().optional(),
  }),
  agent: z.object({
    name: z.string().min(1),
    maxIterations: z.number().int().positive(),
    toolBudget: z.number().int().positive(),
  }),
  theme: z.object({
    name: z.string().min(1),
    customColors: z.record(z.string()).optional(),
  }),
  keybindings: z.record(z.string()).optional(),
  swarm: z
    .object({
      defaultBudgetUsd: z.number().nonnegative(),
      defaultRetries: z.number().int().nonnegative(),
    })
    .optional(),
  context: z
    .object({
      embeddings: z.enum(["openai", "anthropic", "opencode-go", "null"]),
      compression: z.enum(["off", "extractive", "llm", "hybrid"]),
      memoryQueryK: z.number().int().positive(),
    })
    .optional(),
  ui: z
    .object({
      editor: z.boolean().default(true),
      statusLine: z.boolean().default(true),
      copyFriendly: z.boolean().default(false),
      nerdFonts: z.boolean().default(true),
      icons: z.record(z.string()).default({}),
      colors: z.record(z.string()).default({}),
      gitStatusIntervalMs: z.number().int().nonnegative().default(5000),
    })
    .default({
      editor: true,
      statusLine: true,
      copyFriendly: false,
      nerdFonts: true,
      icons: {},
      colors: {},
      gitStatusIntervalMs: 5000,
    }),
  modes: z.array(AgentModeSchema).optional(),
});
export type PiConfig = z.infer<typeof PiConfigSchema>;

export type ValidationResult =
  | { ok: true; config: PiConfig }
  | { ok: false; errors: string[] };

export function validateConfig(input: unknown): ValidationResult {
  const result = PiConfigSchema.safeParse(input);
  if (result.success) {
    return { ok: true, config: result.data as PiConfig };
  }
  const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  return { ok: false, errors };
}
