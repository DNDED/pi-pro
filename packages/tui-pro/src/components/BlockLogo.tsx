import React from "react";
import { Box, Text } from "ink";
import { theme, tint } from "../theme.js";

interface LogoShape {
  left: string[];
  right: string[];
}

const LETTER_HEIGHT = 4;

const LETTERS: Record<string, string[][]> = {
  P: [
    ["█", "█", "█", "█", "█"],
    ["█", " ", " ", " ", "█"],
    ["█", "█", "█", "█", "█"],
    ["█", " ", " ", " ", " "],
  ],
  R: [
    ["█", "█", "█", "█", "█"],
    ["█", " ", " ", " ", "█"],
    ["█", "█", "█", "█", "█"],
    ["█", " ", " ", " ", "█"],
  ],
  O: [
    ["█", "█", "█", "█", "█"],
    ["█", " ", " ", " ", "█"],
    ["█", " ", " ", " ", "█"],
    ["█", "█", "█", "█", "█"],
  ],
  M: [
    ["█", " ", " ", " ", "█"],
    ["█", "█", " ", "█", "█"],
    ["█", " ", "█", " ", "█"],
    ["█", " ", " ", " ", "█"],
  ],
  Y: [
    ["█", " ", " ", " ", "█"],
    [" ", "█", " ", "█", " "],
    [" ", " ", "█", " ", " "],
    [" ", " ", "█", " ", " "],
  ],
  A: [
    [" ", "█", "█", "█", " "],
    ["█", " ", " ", " ", "█"],
    ["█", "█", "█", "█", "█"],
    ["█", " ", " ", " ", "█"],
  ],
};

function buildShape(word: string): LogoShape {
  const letters = word.split("").map((c) => LETTERS[c] ?? LETTERS.O);
  const left: string[] = [];
  const right: string[] = [];
  for (let row = 0; row < LETTER_HEIGHT; row++) {
    const halves: string[][] = [];
    for (const letter of letters) {
      halves.push(letter[row]);
    }
    const mid = Math.floor(letters.length / 2);
    const leftRows = halves.slice(0, mid);
    const rightRows = halves.slice(mid);
    left.push(leftRows.map((r) => r.join("")).join(" "));
    right.push(rightRows.map((r) => r.join("")).join(" "));
  }
  return { left, right };
}

const PROMYRA_SHAPE = buildShape("PROMYRA");
const GAP = 2;

const SHIMMER_FRAMES = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂", "▁"];

export interface BlockLogoProps {
  accent?: string;
  dim?: string;
  showTagline?: boolean;
  shimmer?: boolean;
}

export function BlockLogo({
  accent = theme.primary,
  dim = theme.textMuted,
  showTagline = true,
  shimmer = false,
}: BlockLogoProps) {
  const [frame, setFrame] = React.useState(0);
  const [sweepX, setSweepX] = React.useState(-1);

  React.useEffect(() => {
    if (!shimmer) return;
    const t = setInterval(() => {
      setFrame((f) => (f + 1) % SHIMMER_FRAMES.length);
    }, 80);
    return () => clearInterval(t);
  }, [shimmer]);

  React.useEffect(() => {
    if (!shimmer) return;
    const t = setInterval(() => {
      setSweepX((x) => (x + 1) % 80);
    }, 250);
    return () => clearInterval(t);
  }, [shimmer]);

  const renderCell = (ch: string, x: number, isLeft: boolean): React.ReactNode => {
    const isShimmerHead = shimmer && x === sweepX;
    const isShimmerTail = shimmer && Math.abs(x - sweepX) === 1;
    const ink = isShimmerHead ? theme.text : isShimmerTail ? tint(accent, theme.text, 0.4) : accent;
    if (ch === "█") {
      return (
        <Text key={`${x}-${isLeft}`} color={ink}>
          ▀
        </Text>
      );
    }
    return <Text key={`${x}-${isLeft}`}>{ch}</Text>;
  };

  const leftWidth = PROMYRA_SHAPE.left[0]?.length ?? 0;
  const rightWidth = PROMYRA_SHAPE.right[0]?.length ?? 0;
  const fullWidth = leftWidth + GAP + rightWidth;

  return (
    <Box flexDirection="column" alignItems="center">
      {PROMYRA_SHAPE.left.map((line, row) => {
        const lineX = (c: string, i: number): React.ReactNode => {
          const x = i;
          return renderCell(c, x, true);
        };
        const right = PROMYRA_SHAPE.right[row] ?? "";
        const rightCells: React.ReactNode[] = [];
        for (let i = 0; i < right.length; i++) {
          const x = leftWidth + GAP + i;
          rightCells.push(renderCell(right[i], x, false));
        }
        return (
          <Box key={row} flexDirection="row">
            {line.split("").map((c, i) => lineX(c, i))}
            {rightCells.map((c, i) => (
              <Box key={`g${i}`}>{c}</Box>
            ))}
          </Box>
        );
      })}
      {showTagline ? (
        <Box marginTop={1}>
          <Text color={theme.textMuted}>coding agent</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export default BlockLogo;
