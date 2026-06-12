import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { theme } from "../theme.js";

const FRAMES_BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAMES_BLOCKS = ["▖", "▘", "▝", "▗"];

export interface SpinnerProps {
  color?: string;
  interval?: number;
  style?: "braille" | "blocks";
  label?: string;
}

export function Spinner({ color = theme.primary, interval = 80, style = "blocks", label }: SpinnerProps) {
  const [frame, setFrame] = useState(0);
  const frames = style === "blocks" ? FRAMES_BLOCKS : FRAMES_BRAILLE;
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), interval);
    return () => clearInterval(t);
  }, [frames.length, interval]);
  return (
    <Text color={color}>{frames[frame]}{label ? ` ${label}` : ""}</Text>
  );
}

export default Spinner;
