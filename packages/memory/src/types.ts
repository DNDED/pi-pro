export interface ContextEntry {
  ts: string;
  source: "intake" | "summarize" | "user";
  body: string;
}
