/**
 * Plan-mode runtime state — kept module-local so it survives across events
 * within a single session. Cleared on session_shutdown and on mode change.
 */
export interface PlanItem { step: number; text: string; completed: boolean; }

const WIDGET_KEY = "pi-pro-plan";

let planItems: PlanItem[] = [];
let lastPlanText = "";

export function getPlanItems(): PlanItem[] { return planItems; }
export function setPlanItems(items: PlanItem[]): void { planItems = items; }
export function getLastPlanText(): string { return lastPlanText; }
export function setLastPlanText(t: string): void { lastPlanText = t; }

export function clearPlan(ui: { setWidget: (k: string, c: string[] | undefined) => void }): void {
  planItems = [];
  lastPlanText = "";
  ui.setWidget(WIDGET_KEY, undefined);
}

export const PLAN_WIDGET_KEY = WIDGET_KEY;
