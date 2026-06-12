import React, { useState, useEffect } from "react";
import { Text } from "ink";

export interface StreamingTextProps {
  text: string;
  color?: string;
}

export function StreamingText({ text, color = "#e0e0ff" }: StreamingTextProps) {
  return <Text color={color}>{text}</Text>;
}
