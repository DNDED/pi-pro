export interface BenchTask {
  id: string;
  fixture: string;
  description: string;
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
    expected: { filesChanged: ["src/utils/parse-input.ts"], testsPass: true },
  },
  {
    id: "add-healthz",
    fixture: "tiny-express",
    description: "Add feature: a /healthz endpoint that returns { status: 'ok' } with 200",
    expected: { hasNewEndpoint: "/healthz", testsPass: true },
  },
  {
    id: "fix-bug-auth",
    fixture: "tiny-express",
    description: "Fix bug: the /api/users endpoint leaks password hashes. Strip them.",
    expected: { testsPass: true },
  },
  {
    id: "add-tests-legacy",
    fixture: "tiny-cli",
    description: "Add tests: write pytest cases for the untested src/calc.py module",
    expected: { testsPass: true },
  },
  {
    id: "security-audit",
    fixture: "tiny-go-svc",
    description: "Security audit: review the diff and report any hardcoded secrets or unsafe shell",
    expected: { testsPass: true },
  },
];
