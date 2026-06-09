import { z } from "zod";

export const StateSchema = z.enum([
  "intake", "plan", "branch", "execute", "verify", "summarize", "done",
]);
export type State = z.infer<typeof StateSchema>;

export const TransitionSchema = z.object({
  from: StateSchema,
  to: StateSchema,
  allowedFrom: z.array(StateSchema),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const PlanStepSchema = z.object({
  id: z.string(),
  description: z.string(),
  done: z.boolean().default(false),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  steps: z.array(PlanStepSchema),
});
export type Plan = z.infer<typeof PlanSchema>;

export const SessionEventSchema = z.object({
  ts: z.string().datetime(),
  state: StateSchema,
  event: z.string(),
  data: z.record(z.unknown()).optional(),
});
export type SessionEvent = z.infer<typeof SessionEventSchema>;
