/**
 * Single source of truth for the extension's runtime version. Bumped at release.
 * Bumping the version here is what we increment on every commit; the package.json
 * `version` field mirrors this.
 */
export const VERSION = "0.2.5";

export function buildStatusLine(version: string, mode: string): string {
  const isPlan = mode === "plan";
  return `pi-pro v${version} · ${isPlan ? "PLAN RO" : "BUILD"}`;
}
