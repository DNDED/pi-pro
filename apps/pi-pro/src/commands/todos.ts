export async function todos(action?: string): Promise<void> {
  if (!action || action === "show") {
    console.log("(todo state is session-local; no persistent list at startup)");
    console.log("  use the in-REPL /todos command or the LLM todo tool");
    return;
  }
  if (action === "clear") {
    console.log("  ✓ cleared (session-local; REPL keeps its own list)");
    return;
  }
  console.error(`unknown action: ${action}`);
  console.error("actions: show, clear");
  process.exit(1);
}
