import React from "react";
import { Box, Text } from "ink";
import { theme } from "../theme.js";
import type { Todo } from "./todo-state.js";

export interface TodoListProps {
  todos: Todo[];
  width?: number;
  visible?: boolean;
  onClose?: () => void;
}

export function TodoList({ todos, visible = true }: TodoListProps) {
  if (!visible) return null;
  const done = todos.filter((t) => t.done).length;
  const total = todos.length;
  return (
    <Box flexDirection="column" paddingX={2} marginTop={1}>
      <Box>
        <Text color={theme.accent} bold>☰ Todos </Text>
        <Text color={theme.text}>{done}/{total}</Text>
        {total > 0 && done === total ? <Text color={theme.success}>  ✓ all done</Text> : null}
      </Box>
      {total === 0 ? (
        <Text color={theme.textMuted}>  (no todos)</Text>
      ) : (
        todos.map((t) => (
          <Text key={t.id} color={t.done ? theme.textMuted : theme.text}>
            {t.done ? "☑ " : "☐ "}#{t.id} {t.text}
          </Text>
        ))
      )}
    </Box>
  );
}

export default TodoList;
