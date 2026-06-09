import { State, StateSchema, Plan, PlanStep, Transition } from "./types.js";

const ALLOWED: Record<State, State[]> = {
  intake:    ["plan"],
  plan:      ["branch", "intake"],
  branch:    ["execute", "plan"],
  execute:   ["verify", "execute", "branch"],
  verify:    ["summarize", "execute"],
  summarize: ["done", "verify"],
  done:      [],
};

export function nextStates(from: State): State[] {
  StateSchema.parse(from);
  return ALLOWED[from];
}

export function canTransition(from: State, to: State): boolean {
  return ALLOWED[from].includes(to);
}

export class StateMachine {
  private current: State;
  private stepIndex = 0;

  constructor(initial: State = "intake") {
    this.current = initial;
  }

  state(): State { return this.current; }

  transition(to: State): void {
    if (!canTransition(this.current, to)) {
      throw new Error(`Illegal transition: ${this.current} -> ${to}. Allowed from ${this.current}: ${ALLOWED[this.current].join(", ")}`);
    }
    this.current = to;
  }

  nextStep(plan: Plan): PlanStep | null {
    while (this.stepIndex < plan.steps.length && plan.steps[this.stepIndex].done) {
      this.stepIndex++;
    }
    return plan.steps[this.stepIndex] ?? null;
  }

  markStepDone(stepId: string, plan: Plan): void {
    const step = plan.steps.find(s => s.id === stepId);
    if (!step) throw new Error(`Unknown step: ${stepId}`);
    step.done = true;
  }

  isComplete(plan: Plan): boolean {
    return plan.steps.every(s => s.done);
  }
}

export const TRANSITIONS: Transition[] = (
  Object.keys(ALLOWED) as State[]
).flatMap(from => ALLOWED[from].map(to => ({ from, to, allowedFrom: [from] })));
