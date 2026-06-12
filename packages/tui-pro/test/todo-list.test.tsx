import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TodoList } from "../src/index.js";

describe("TodoList", () => {
  it("renders nothing when visible=false", () => {
    const { lastFrame } = render(
      <TodoList todos={[{ id: 1, text: "x", done: false }]} visible={false} />,
    );
    expect(lastFrame()).toBe("");
  });

  it("shows (no todos) when empty", () => {
    const { lastFrame } = render(<TodoList todos={[]} />);
    expect(lastFrame()).toContain("(no todos)");
  });

  it("renders progress header with done/total", () => {
    const todos = [
      { id: 1, text: "First", done: true },
      { id: 2, text: "Second", done: false },
    ];
    const { lastFrame } = render(<TodoList todos={todos} />);
    const out = lastFrame();
    expect(out).toContain("Todos");
    expect(out).toContain("1/2");
  });

  it("renders todos with id and text", () => {
    const todos = [
      { id: 1, text: "First todo", done: false },
      { id: 2, text: "Second todo", done: true },
    ];
    const { lastFrame } = render(<TodoList todos={todos} />);
    const out = lastFrame();
    expect(out).toContain("#1");
    expect(out).toContain("First todo");
    expect(out).toContain("#2");
    expect(out).toContain("Second todo");
  });

  it("uses ☑ for done, ☐ for pending", () => {
    const todos = [
      { id: 1, text: "Done", done: true },
      { id: 2, text: "Pending", done: false },
    ];
    const { lastFrame } = render(<TodoList todos={todos} />);
    expect(lastFrame()).toContain("☑");
    expect(lastFrame()).toContain("☐");
  });

  it("shows all-done badge when complete", () => {
    const todos = [
      { id: 1, text: "a", done: true },
      { id: 2, text: "b", done: true },
    ];
    const { lastFrame } = render(<TodoList todos={todos} />);
    expect(lastFrame()).toContain("all done");
  });
});
