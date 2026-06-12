export type DiffLineKind = "context" | "added" | "removed" | "hunk-header";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  line: number;
}

function lcs(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = (dp[i + 1]?.[j + 1] ?? 0) + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
      }
    }
  }
  return dp;
}

export function renderDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const dp = lcs(oldLines, newLines);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let line = 1;
  const max = Math.max(oldLines.length, newLines.length);
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      out.push({ kind: "context", text: oldLines[i], line });
      i++;
      j++;
      line++;
    } else {
      const skipOld = j < newLines.length && (i >= oldLines.length || (dp[i + 1]?.[j] ?? 0) <= (dp[i]?.[j + 1] ?? 0));
      if (skipOld && j < newLines.length) {
        out.push({ kind: "added", text: newLines[j], line });
        j++;
      } else if (i < oldLines.length) {
        out.push({ kind: "removed", text: oldLines[i], line });
        i++;
        line++;
      }
    }
    if (out.length > 500) break;
  }
  if (out.length === 0) {
    for (let k = 0; k < max; k++) {
      out.push({ kind: "context", text: "", line: k + 1 });
    }
  }
  return out;
}
