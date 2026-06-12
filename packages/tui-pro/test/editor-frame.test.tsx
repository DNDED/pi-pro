import { describe, it, expect } from "vitest";
import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { EditorFrame } from "../src/index.js";

describe("EditorFrame", () => {
  it("renders accent rail with agent name", () => {
    const { lastFrame } = render(
      <EditorFrame agent="build">
        <Text>hello</Text>
      </EditorFrame>,
    );
    const out = lastFrame();
    expect(out).toContain("┃");
    expect(out).toContain("build");
    expect(out).toContain("hello");
  });

  it("renders model and provider when provided", () => {
    const { lastFrame } = render(
      <EditorFrame agent="plan" model="claude-sonnet-4-6" provider="anthropic">
        <Text>x</Text>
      </EditorFrame>,
    );
    const out = lastFrame();
    expect(out).toContain("plan");
    expect(out).toContain("claude-sonnet-4-6");
    expect(out).toContain("anthropic");
  });

  it("hides rail in copy-friendly mode", () => {
    const { lastFrame } = render(
      <EditorFrame agent="build" copyFriendly>
        <Text>clean copy</Text>
      </EditorFrame>,
    );
    const out = lastFrame();
    expect(out).toContain("clean copy");
    expect(out).not.toContain("┃");
  });
});
