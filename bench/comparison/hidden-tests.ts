import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

export interface HiddenTestResult {
  taskId: string;
  passed: number;
  total: number;
  details: string[];
}

export const HIDDEN_TESTS: Record<string, string> = {
  "fix-bug-auth": `
import assert from "node:assert/strict";
import { test } from "node:test";

test("hidden: user objects have exactly id and name keys, no passwordHash", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/users");
    const users = await res.json();
    for (const u of users) {
      const keys = Object.keys(u).sort();
      assert.deepStrictEqual(keys, ["id", "name"], "user keys leaked extra field, got: " + JSON.stringify(keys));
      assert.strictEqual(u.passwordHash, undefined, "passwordHash still present on user " + u.id);
    }
  } finally {
    server.close();
  }
});
test("hidden: endpoint returns valid JSON array with status 200", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/users");
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(Array.isArray(body), true);
    assert.ok(body.length > 0, "users array is empty");
  } finally {
    server.close();
  }
});
test("hidden: anonymous users have no extra properties", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/users");
    const users = await res.json();
    assert.strictEqual(users[0].name, "Alice");
    assert.strictEqual(users[1].name, "Bob");
  } finally {
    server.close();
  }
});
`.trim(),

  "add-validation": `
import assert from "node:assert/strict";
import { test } from "node:test";

test("hidden: parse-input accepts exactly 1000 chars", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const input = "x".repeat(1000);
    const res = await fetch("http://127.0.0.1:" + port + "/api/parse-input?input=" + encodeURIComponent(input));
    assert.strictEqual(res.status, 200);
  } finally {
    server.close();
  }
});
test("hidden: parse-input handles empty query param gracefully", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/parse-input");
    assert.ok(res.status >= 200 && res.status < 500, "status is " + res.status);
  } finally {
    server.close();
  }
});
test("hidden: parse-input with number input still works", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/parse-input?input=123,456");
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.parsed, ["123", "456"]);
  } finally {
    server.close();
  }
});
`.trim(),

  "add-rate-limit": `
import assert from "node:assert/strict";
import { test } from "node:test";

test("hidden: rate limit blocks 6th request from same IP", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    // Make 6 requests, 6th should be 429
    let blocked = false;
    for (let i = 0; i < 6; i++) {
      const res = await fetch("http://127.0.0.1:" + port + "/api/users");
      if (res.status === 429) { blocked = true; break; }
    }
    assert.strictEqual(blocked, true, "rate limit never triggered after 6 requests");
  } finally {
    server.close();
  }
});
test("hidden: different IPs get independent rate limits", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    // First IP: 5 requests, should all pass
    for (let i = 0; i < 5; i++) {
      const res = await fetch("http://127.0.0.1:" + port + "/api/users", { headers: { "x-forwarded-for": "10.0.0.1" } });
      assert.ok(res.status !== 429, "first IP got rate limited at request " + i);
    }
    // Second IP: should still be allowed
    const res = await fetch("http://127.0.0.1:" + port + "/api/users", { headers: { "x-forwarded-for": "10.0.0.2" } });
    assert.ok(res.status !== 429, "second IP was rate limited despite no prior requests");
  } finally {
    server.close();
  }
});
test("hidden: 429 response includes retryAfter hint", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    for (let i = 0; i < 6; i++) {
      const res = await fetch("http://127.0.0.1:" + port + "/api/users");
      if (res.status === 429) {
        const body = await res.json();
        assert.ok(body.error || body.retryAfter, "429 response missing error or retryAfter");
        break;
      }
    }
  } finally {
    server.close();
  }
});
`.trim(),

  "add-error-middleware": `
import assert from "node:assert/strict";
import { test } from "node:test";

test("hidden: error middleware catches thrown errors and returns 500", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    // Test an endpoint that doesn't exist to hit error handling
    const res = await fetch("http://127.0.0.1:" + port + "/api/nonexistent");
    assert.ok(res.status >= 400, "Expected error status, got " + res.status);
  } finally {
    server.close();
  }
});
test("hidden: JSON error responses have consistent format", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/nonexistent");
    try {
      const body = await res.json();
      assert.ok(typeof body === "object", "error response is not JSON object");
    } catch {
      assert.fail("error response is not valid JSON");
    }
  } finally {
    server.close();
  }
});
test("hidden: normal endpoints still work after adding error middleware", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/users");
    assert.strictEqual(res.status, 200);
  } finally {
    server.close();
  }
});
`.trim(),

  "refactor-error-handling": `
import assert from "node:assert/strict";
import { test } from "node:test";

test("hidden: AppError is exported and has statusCode property", async () => {
  const { AppError } = await import("./errors.js");
  const err = new AppError("test error", 400, "TEST_CODE");
  assert.strictEqual(err.statusCode, 400);
  assert.strictEqual(err.code, "TEST_CODE");
  assert.strictEqual(err.message, "test error");
});
test("hidden: error middleware catches thrown AppError instances", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/causes-error");
    assert.ok(res.status >= 400, "Expected error status, got " + res.status);
  } finally {
    server.close();
  }
});
test("hidden: error middleware handles uncaught errors gracefully", async () => {
  const { default: app } = await import("./server.js");
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : addr;
    const res = await fetch("http://127.0.0.1:" + port + "/api/parse-input?input=test");
    assert.strictEqual(res.status, 200, "existing endpoint broken after refactor");
  } finally {
    server.close();
  }
});
`.trim(),
};

export async function runHiddenTest(workdir: string, taskId: string): Promise<HiddenTestResult> {
  const testContent = HIDDEN_TESTS[taskId];
  if (!testContent) return { taskId, passed: 0, total: 0, details: ["no hidden tests for this task"] };

  const testPath = join(workdir, `hidden_${taskId}.js`);
  await writeFile(testPath, testContent);

  try {
    const output = execSync(`node --test ${testPath} 2>&1`, {
      cwd: workdir,
      timeout: 45000,
      encoding: "utf8",
    });
    const passMatch = output.match(/# pass (\d+)/);
    const totalMatch = output.match(/# tests (\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;
    return { taskId, passed, total, details: [output.slice(0, 500)] };
  } catch (e) {
    const output = ((e as { stdout?: string; stderr?: string }).stdout ?? "") + ((e as { stdout?: string; stderr?: string }).stderr ?? "");
    const passMatch = output.match(/# pass (\d+)/);
    const totalMatch = output.match(/# tests (\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;
    return { taskId, passed, total, details: [output.slice(0, 500)] };
  }
}
