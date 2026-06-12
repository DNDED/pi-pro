import { describe, it, expect } from "vitest";
import {
  INITIAL_TODO_STATE,
  listTodos,
  addTodo,
  toggleTodo,
  clearTodos,
  countProgress,
} from "../src/extensions/todo-state.js";

describe("listTodos", () => {
  it("returns todos (defensive copy)", () => {
    const r = listTodos(INITIAL_TODO_STATE);
    expect(r).toEqual([]);
  });
});

describe("addTodo", () => {
  it("adds a todo with incrementing id", () => {
    let s = addTodo(INITIAL_TODO_STATE, "first");
    s = addTodo(s, "second");
    expect(s.todos.length).toBe(2);
    expect(s.todos[0]?.id).toBe(1);
    expect(s.todos[1]?.id).toBe(2);
    expect(s.nextId).toBe(3);
  });

  it("trims whitespace", () => {
    const s = addTodo(INITIAL_TODO_STATE, "  trim me  ");
    expect(s.todos[0]?.text).toBe("trim me");
  });

  it("rejects empty text", () => {
    const s = addTodo(INITIAL_TODO_STATE, "   ");
    expect(s.todos.length).toBe(0);
  });

  it("preserves existing todos", () => {
    const s1 = addTodo(INITIAL_TODO_STATE, "one");
    const s2 = addTodo(s1, "two");
    expect(s2.todos.length).toBe(2);
    expect(s2.todos[0]?.text).toBe("one");
  });
});

describe("toggleTodo", () => {
  it("flips done state", () => {
    const s1 = addTodo(INITIAL_TODO_STATE, "test");
    const s2 = toggleTodo(s1, 1);
    expect(s2.todos[0]?.done).toBe(true);
    const s3 = toggleTodo(s2, 1);
    expect(s3.todos[0]?.done).toBe(false);
  });

  it("does nothing for unknown id", () => {
    const s1 = addTodo(INITIAL_TODO_STATE, "test");
    const s2 = toggleTodo(s1, 999);
    expect(s2).toEqual(s1);
  });
});

describe("clearTodos", () => {
  it("resets to empty state", () => {
    const s1 = addTodo(INITIAL_TODO_STATE, "a");
    const s2 = addTodo(s1, "b");
    const s3 = clearTodos(s2);
    expect(s3).toEqual(INITIAL_TODO_STATE);
  });
});

describe("countProgress", () => {
  it("counts done/total", () => {
    let s = addTodo(INITIAL_TODO_STATE, "a");
    s = addTodo(s, "b");
    s = addTodo(s, "c");
    s = toggleTodo(s, 1);
    s = toggleTodo(s, 3);
    expect(countProgress(s)).toEqual({ done: 2, total: 3 });
  });
});
