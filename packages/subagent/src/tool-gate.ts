const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-rf?\s+\/(?!\w)/i,
  /\brm\s+-rf?\s+~/i,
  /\brm\s+-rf?\s+\*/i,
  /\bcurl\s+[^|]*\|\s*(sh|bash)/i,
  /\bwget\s+[^|]*\|\s*(sh|bash)/i,
  />\s*\/etc\//i,
  />\s*\/usr\//i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bgit\s+(push|reset\s+--hard|clean\s+-fd)/i,
  /\bnpm\s+(publish|uninstall\s+\*)/i,
  /\bpnpm\s+(publish|uninstall\s+\*)/i,
  /\bpip\s+uninstall\s+-y\s+\*/i,
  /\bapt(-get)?\s+(remove|purge)\s+-y/i,
];

export function isBashDestructive(command: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}

export function isToolActive(toolName: string, activeTools: ReadonlySet<string> | null | undefined): boolean {
  if (!activeTools) return true;
  return activeTools.has(toolName);
}

export interface ToolGateResult {
  allowed: boolean;
  reason?: string;
}

export function gateToolCall(
  toolName: string,
  args: Record<string, unknown> | null | undefined,
  activeTools: ReadonlySet<string> | null | undefined,
  bashAllowlist?: RegExp[],
): ToolGateResult {
  if (!isToolActive(toolName, activeTools)) {
    return {
      allowed: false,
      reason: `Tool "${toolName}" is not active in the current mode. Active tools: ${activeTools ? [...activeTools].join(", ") : "(all)"}.`,
    };
  }
  if (toolName === "bash") {
    const cmd = typeof args?.command === "string" ? args.command : "";
    if (cmd && isBashDestructive(cmd)) {
      return {
        allowed: false,
        reason: `Plan mode: bash command blocked (destructive pattern). Command: ${cmd.slice(0, 200)}`,
      };
    }
    if (cmd && bashAllowlist && bashAllowlist.length > 0) {
      const allowed = bashAllowlist.some((p) => p.test(cmd));
      if (!allowed) {
        return {
          allowed: false,
          reason: `Plan mode: bash command not in allowlist. Command: ${cmd.slice(0, 200)}`,
        };
      }
    }
  }
  return { allowed: true };
}
