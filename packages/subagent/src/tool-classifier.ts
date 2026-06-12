export type ToolKind = "read" | "write" | "edit" | "bash" | "grep" | "glob" | "webfetch" | "task" | "todo" | "other";

export function classifyTool(name: string): ToolKind {
  const n = name.toLowerCase();
  if (n === "read" || n === "view") return "read";
  if (n === "write" || n === "create") return "write";
  if (n === "edit" || n === "patch" || n === "multiedit") return "edit";
  if (n === "bash" || n === "shell" || n === "exec") return "bash";
  if (n === "grep" || n === "search") return "grep";
  if (n === "glob" || n === "list" || n === "ls") return "glob";
  if (n === "webfetch" || n === "fetch") return "webfetch";
  if (n === "task" || n === "subagent") return "task";
  if (n === "todo" || n === "todowrite") return "todo";
  return "other";
}
