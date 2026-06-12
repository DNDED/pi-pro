import { describe, it, expect } from "vitest";
import { parsePlanItems, markPlanDone, renderPlanWidget, isSafeBash, cleanStepText, type PlanItem } from "../src/plan-widget.js";

describe("isSafeBash", () => {
  it("allows read-only commands", () => {
    expect(isSafeBash("ls -la")).toBe(true);
    expect(isSafeBash("cat README.md")).toBe(true);
    expect(isSafeBash("grep -r foo src/")).toBe(true);
    expect(isSafeBash("git status")).toBe(true);
  });
  it("blocks destructive commands", () => {
    expect(isSafeBash("rm -rf /")).toBe(false);
    expect(isSafeBash("rm file.txt")).toBe(false);
    expect(isSafeBash("sudo apt update")).toBe(false);
    expect(isSafeBash("git push origin master")).toBe(false);
    expect(isSafeBash("npm install lodash")).toBe(false);
    expect(isSafeBash("vim foo.txt")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isSafeBash("")).toBe(false);
  });
});

describe("cleanStepText", () => {
  it("strips bold", () => {
    expect(cleanStepText("**Hello** world")).toBe("Hello world");
  });
  it("strips code backticks", () => {
    expect(cleanStepText("Run `npm test` now")).toBe("Npm test now");
  });
  it("strips leading verb", () => {
    expect(cleanStepText("Execute the plan")).toBe("Plan");
  });
  it("truncates long text", () => {
    const long = "a".repeat(60);
    expect(cleanStepText(long).length).toBeLessThanOrEqual(50);
  });
});

describe("parsePlanItems", () => {
  it("parses a Plan: section", () => {
    const msg = `\nPlan:\n1. First step\n2. Second step\n3. Third step\n`;
    const items = parsePlanItems(msg);
    expect(items.length).toBe(3);
    expect(items[0]?.text).toBe("First step");
  });
  it("returns empty when no Plan: header", () => {
    expect(parsePlanItems("no plan here").length).toBe(0);
  });
  it("supports both period and paren numbering", () => {
    expect(parsePlanItems("Plan:\n1) one\n2) two").length).toBe(2);
  });
});

describe("markPlanDone", () => {
  it("marks items complete", () => {
    const items: PlanItem[] = [
      { step: 1, text: "one", completed: false },
      { step: 2, text: "two", completed: false },
    ];
    const n = markPlanDone("[DONE:1]", items);
    expect(n).toBe(1);
    expect(items[0]?.completed).toBe(true);
  });
  it("doesn't double-count", () => {
    const items: PlanItem[] = [
      { step: 1, text: "one", completed: false },
    ];
    markPlanDone("[DONE:1] [DONE:1]", items);
    expect(items[0]?.completed).toBe(true);
  });
});

describe("renderPlanWidget", () => {
  it("empty for no items", () => {
    expect(renderPlanWidget([])).toEqual([]);
  });
  it("renders header + items", () => {
    const items: PlanItem[] = [
      { step: 1, text: "First", completed: true },
      { step: 2, text: "Second", completed: false },
    ];
    const lines = renderPlanWidget(items);
    expect(lines[0]).toContain("Plan 1/2");
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain("☑");
    expect(lines[2]).toContain("☐");
  });
  it("shows checkmark when all done", () => {
    const items: PlanItem[] = [
      { step: 1, text: "a", completed: true },
      { step: 2, text: "b", completed: true },
    ];
    const lines = renderPlanWidget(items);
    expect(lines[0]).toContain("✓");
  });
});
