import React from "react";
import { Text } from "ink";
import { theme } from "../theme.js";

interface Block {
  kind: "heading" | "paragraph" | "code" | "list" | "list-item" | "blank";
  level?: number;
  text?: string;
  lang?: string;
  items?: string[];
}

function parseBlocks(input: string): Block[] {
  const lines = input.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      blocks.push({ kind: "heading", level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }
    const codeFence = /^```(\w*)$/.exec(line);
    if (codeFence) {
      const lang = codeFence[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: "code", text: codeLines.join("\n"), lang });
      continue;
    }
    const listMatch = /^\s*[-*]\s+(.+)$/.exec(line);
    if (listMatch) {
      const items: string[] = [listMatch[1]];
      i++;
      while (i < lines.length && /^\s*[-*]\s+(.+)$/.test(lines[i])) {
        items.push(/^\s*[-*]\s+(.+)$/.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*]\s)/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", text: paraLines.join(" ") });
  }
  return blocks;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const bold = /^\*\*(.+?)\*\*/.exec(text.slice(i));
    if (bold) {
      parts.push(<Text key={`${keyPrefix}-b${key++}`} bold color={theme.text}>{bold[1]}</Text>);
      i += bold[0].length;
      continue;
    }
    const ital = /^\*(.+?)\*/.exec(text.slice(i));
    if (ital) {
      parts.push(<Text key={`${keyPrefix}-i${key++}`} italic color={theme.text}>{ital[1]}</Text>);
      i += ital[0].length;
      continue;
    }
    const code = /^`([^`]+)`/.exec(text.slice(i));
    if (code) {
      parts.push(<Text key={`${keyPrefix}-c${key++}`} color={theme.success}>{code[1]}</Text>);
      i += code[0].length;
      continue;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)/.exec(text.slice(i));
    if (link) {
      parts.push(<Text key={`${keyPrefix}-l${key++}`} color={theme.info} underline>{link[1]}</Text>);
      i += link[0].length;
      continue;
    }
    const next = Math.min(
      ...["**", "*", "`", "["]
        .map((p: string) => {
          const idx = text.indexOf(p, i + 1);
          return idx === -1 ? Infinity : idx;
        })
    );
    const end = next === Infinity ? text.length : next;
    if (end > i) {
      parts.push(<Text key={`${keyPrefix}-t${key++}`} color={theme.text}>{text.slice(i, end)}</Text>);
      i = end;
    } else {
      i++;
    }
  }
  return parts;
}

export function renderMarkdown(input: string, keyPrefix: string): React.ReactNode {
  const blocks = parseBlocks(input);
  return (
    <>
      {blocks.map((b, idx) => {
        const k = `${keyPrefix}-b${idx}`;
        if (b.kind === "heading") {
          return (
            <Text key={k} bold color={theme.accent}>
              {`#`.repeat(b.level ?? 1)} {b.text}
            </Text>
          );
        }
        if (b.kind === "paragraph") {
          return (
            <Text key={k} wrap="wrap">{renderInline(b.text ?? "", k)}</Text>
          );
        }
        if (b.kind === "code") {
          const codeLines = (b.text ?? "").split("\n");
          return (
            <Text key={k}>
              {codeLines.map((line, i) => (
                <Text key={`${k}-l${i}`} color={theme.text}>{line || " "}{i < codeLines.length - 1 ? "\n" : ""}</Text>
              ))}
            </Text>
          );
        }
        if (b.kind === "list" && b.items) {
          const itemCount = b.items.length;
          return (
            <Text key={k}>
              {b.items.map((it, i) => (
                <Text key={`${k}-i${i}`} color={theme.text}>
                  <Text color={theme.accent}>*</Text> {renderInline(it, `${k}-i${i}`)}
                  {i < itemCount - 1 ? "\n" : ""}
                </Text>
              ))}
            </Text>
          );
        }
        return null;
      })}
    </>
  );
}

export default renderMarkdown;
