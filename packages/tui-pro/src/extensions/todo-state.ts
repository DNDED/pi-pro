export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export interface TodoState {
  todos: Todo[];
  nextId: number;
}

export const INITIAL_TODO_STATE: TodoState = {
  todos: [],
  nextId: 1,
};

export function listTodos(state: TodoState): Todo[] {
  return [...state.todos];
}

export function addTodo(state: TodoState, text: string): TodoState {
  if (!text.trim()) return state;
  const newTodo: Todo = { id: state.nextId, text: text.trim(), done: false };
  return { todos: [...state.todos, newTodo], nextId: state.nextId + 1 };
}

export function toggleTodo(state: TodoState, id: number): TodoState {
  return {
    todos: state.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    nextId: state.nextId,
  };
}

export function clearTodos(state: TodoState): TodoState {
  return INITIAL_TODO_STATE;
}

export function countProgress(state: TodoState): { done: number; total: number } {
  return { done: state.todos.filter((t) => t.done).length, total: state.todos.length };
}
