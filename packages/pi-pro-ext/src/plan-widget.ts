export interface PlanItem {
  step: number;
  text: string;
  completed: boolean;
}

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\b/i, /\brmdir\b/i, /\bmv\b/i, /\bcp\b/i, /\bmkdir\b/i, /\btouch\b/i,
  /\bchmod\b/i, /\bchown\b/i, /\bln\b/i, /\btee\b/i, /\btruncate\b/i, /\bdd\b/i,
  /\bshred\b/i, /\bsudo\b/i, /\bsu\b/i, /\bkill\b/i, /\bpkill\b/i, /\bkillall\b/i,
  /\breboot\b/i, /\bshutdown\b/i, /\bmkfs\b/i,
  /\bnpm\s+(install|uninstall|update|ci|link|publish)/i,
  /\byarn\s+(add|remove|install|publish)/i,
  /\bpnpm\s+(add|remove|install|publish)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
  /\bbrew\s+(install|uninstall|upgrade)/i,
  /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|branch\s+-[dD]|stash|cherry-pick|revert|tag|init|clone)/i,
];

const SAFE_PATTERNS: RegExp[] = [
  /^\s*(cat|head|tail|less|more|grep|rg|find|fd|ls|eza|bat|pwd|echo|printf|wc|sort|uniq|diff|file|stat|du|df|tree|which|whereis|type|env|printenv|uname|whoami|id|date|cal|uptime|ps|top|htop|free|jq|sed\s+-n|awk)\b/,
  /^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get|ls-)/i,
  /^\s*npm\s+(list|ls|view|info|search|outdated|audit)/i,
  /^\s*yarn\s+(list|info|why|audit)/i,
  /^\s*node\s+--version/i,
  /^\s*python\s+--version/i,
  /^\s*curl/i,
  /^\s*wget\s+-O\s*-/i,
];

export function isSafeBash(cmd: string): boolean {
  const isDestructive = DESTRUCTIVE_PATTERNS.some((p) => p.test(cmd));
  const isSafe = SAFE_PATTERNS.some((p) => p.test(cmd));
  return !isDestructive && isSafe;
}

export function cleanStepText(text: string): string {
  let cleaned = text
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^(Use|Run|Execute|Create|Write|Read|Check|Verify|Update|Modify|Add|Remove|Delete|Install)\s+(the\s+)?/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length > 0) cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (cleaned.length > 50) cleaned = `${cleaned.slice(0, 47)}...`;
  return cleaned;
}

export function parsePlanItems(message: string): PlanItem[] {
  const items: PlanItem[] = [];
  const headerMatch = message.match(/\*{0,2}Plan:\*{0,2}\s*\n/i);
  if (!headerMatch || headerMatch.index === undefined) return items;
  const planSection = message.slice(headerMatch.index + headerMatch[0].length);
  const numbered = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm;
  for (const m of planSection.matchAll(numbered)) {
    const raw = (m[2] ?? "").trim().replace(/\*{1,2}$/, "").trim();
    if (raw.length > 0 && !raw.startsWith("`") && !raw.startsWith("/") && !raw.startsWith("-")) {
      const cleaned = cleanStepText(raw);
      if (cleaned.length > 0) items.push({ step: items.length + 1, text: cleaned, completed: false });
    }
  }
  return items;
}

export function markPlanDone(text: string, items: PlanItem[]): number {
  let count = 0;
  for (const m of text.matchAll(/\[DONE:(\d+)\]/gi)) {
    const s = Number(m[1]);
    if (!Number.isFinite(s)) continue;
    const it = items.find((i) => i.step === s);
    if (it && !it.completed) {
      it.completed = true;
      count++;
    }
  }
  return count;
}

export function renderPlanWidget(items: PlanItem[]): string[] {
  if (items.length === 0) return [];
  const done = items.filter((i) => i.completed).length;
  const total = items.length;
  const lines = [
    `${done === total ? "✓" : "📋"} Plan ${done}/${total}${done === total ? "  ✓ all done" : ""}`,
  ];
  for (const it of items) {
    lines.push(`  ${it.completed ? "☑" : "☐"} ${it.step}. ${it.text}`);
  }
  return lines;
}
