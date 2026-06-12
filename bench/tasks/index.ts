export interface BenchTask {
  id: string;
  fixture: string;
  description: string;
  difficulty?: "easy" | "medium" | "hard" | "very-hard";
  expected: {
    filesChanged?: string[];
    testsPass?: boolean;
    hasNewEndpoint?: string;
  };
}

export const TASKS: BenchTask[] = [
  {
    id: "refactor-helper",
    fixture: "tiny-express",
    description: "Refactor: extract the duplicated 'parseUserInput' helper into src/utils/parse-input.ts",
    difficulty: "easy",
    expected: { filesChanged: ["src/utils/parse-input.ts"], testsPass: true },
  },
  {
    id: "add-healthz",
    fixture: "tiny-express",
    description: "Add feature: a /healthz endpoint that returns { status: 'ok' } with 200",
    difficulty: "easy",
    expected: { hasNewEndpoint: "/healthz", testsPass: true },
  },
  {
    id: "fix-bug-auth",
    fixture: "tiny-express",
    description: "Fix bug: the /api/users endpoint leaks password hashes. Strip them.",
    difficulty: "medium",
    expected: { testsPass: true },
  },
  {
    id: "add-tests-legacy",
    fixture: "tiny-cli",
    description: "Add tests: write pytest cases for the untested src/calc.py module",
    difficulty: "easy",
    expected: { testsPass: true },
  },
  {
    id: "security-audit",
    fixture: "tiny-go-svc",
    description: "Security audit: review the diff and report any hardcoded secrets or unsafe shell",
    difficulty: "medium",
    expected: { testsPass: true },
  },
  {
    id: "refactor-async",
    fixture: "tiny-express",
    description: "Refactor: convert the /api/users endpoint to use async/await with a simulated database lookup function. Create a async function getUsers() that returns a Promise of users, then await it in the handler.",
    difficulty: "hard",
    expected: { testsPass: true },
  },
  {
    id: "add-error-middleware",
    fixture: "tiny-express",
    description: "Add global error handler middleware to the Express app. The middleware should catch any unhandled errors thrown in route handlers and return 500 with { error: 'internal' }. Register it with app.use() AFTER all route definitions.",
    difficulty: "hard",
    expected: { testsPass: true },
  },
  {
    id: "add-input-sanitize",
    fixture: "tiny-express",
    description: "Add path sanitization to the /api/parse-input endpoint: reject any input containing '..' (path traversal), return 400 with { error: 'invalid input' }. Add a test for this in test.js. Make sure all existing tests still pass.",
    difficulty: "medium",
    expected: { testsPass: true },
  },
  {
    id: "add-rate-limit",
    fixture: "tiny-express",
    description: "Add a simple in-memory rate limiter to all GET endpoints: track requests per IP address using a Map. Return 429 with { error: 'rate limited', retryAfter: seconds } when an IP exceeds 5 requests in 10 seconds. Add a new test in test.js that verifies the limit is enforced. Make sure all existing tests still pass.",
    difficulty: "hard",
    expected: { testsPass: true },
  },
  {
    id: "add-db-layer",
    fixture: "tiny-express",
    description: "Refactor the /api/users endpoint: instead of hardcoded users, create a users.js module that exports async functions: getAllUsers() (returns users array), getUserById(id) (returns single user or null), and safeUsers() (strips passwordHash). Use these in server.js with async/await. Make sure all existing tests still pass.",
    difficulty: "hard",
    expected: { testsPass: true },
  },
  {
    id: "add-auth-middleware",
    fixture: "tiny-express",
    description: "Add a simple auth middleware to the Express app. Create auth.js that exports an authMiddleware function reading x-api-key from request headers. If the key is 'secret-token', allow the request. Otherwise return 401 with { error: 'unauthorized' }. Apply the middleware to /api/users and /api/parse-input. Update test.js to verify auth. Make sure all existing tests still pass.",
    difficulty: "hard",
    expected: { testsPass: true },
  },
  {
    id: "fix-race-condition",
    fixture: "tiny-express",
    description: "The current server imports and immediately starts listening on port 3000. This causes EADDRINUSE errors when tests import server.js. Fix: wrap app.listen() in a condition — only start listening when the file is run directly (not imported). Also export app as the default export. Use: if (import.meta.url === `file://${process.argv[1]}`). Make sure all existing tests still pass and the server still works when run directly.",
    difficulty: "hard",
    expected: { testsPass: true },
  },
  {
    id: "add-input-sanitize-advanced",
    fixture: "tiny-express",
    description: "Enhance the /api/parse-input endpoint with comprehensive input sanitization: (1) reject inputs containing '..' (path traversal), (2) reject inputs longer than 1000 chars, (3) reject inputs with characters other than letters, numbers, commas, hyphens, and spaces, (4) return specific error messages for each case: 'path traversal', 'input too long', 'invalid characters'. Add tests for all cases in test.js. Make sure all existing tests still pass.",
    difficulty: "very-hard",
    expected: { testsPass: true },
  },
  {
    id: "refactor-error-handling",
    fixture: "tiny-express",
    description: "Add comprehensive error handling throughout the app: (1) create errors.js that exports AppError class extending Error with statusCode and code fields, (2) create error middleware that catches AppError instances and returns proper JSON errors, (3) convert all res.status().json() calls to throw AppError instances instead, (4) ensure the error middleware catches uncaught errors too and returns 500. Update test.js to verify error responses. Make sure all existing tests still pass.",
    difficulty: "very-hard",
    expected: { testsPass: true },
  },
  {
    id: "long-task-50turn",
    fixture: "tiny-express",
    description: "v0.7.0 long-task fixture: 50+ turn conversation that exercises the v0.7.0 context manager (sliding window + extractive compression + adaptive triggers). The model must add 3 endpoints (/users, /healthz, /metrics), fix 2 bugs (auth leak, race condition), and refactor 1 helper, all while context grows past 200k tokens. The runner verifies the model completes all subtasks without losing track of earlier requirements (cross-session recall) and without exceeding 50MB RSS (memory leak target).",
    difficulty: "very-hard",
    expected: { hasNewEndpoint: "/metrics", testsPass: true },
  },
];
