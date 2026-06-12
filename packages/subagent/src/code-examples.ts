export interface CodeExample {
  language: string;
  title: string;
  code: string;
}

const EXPRESS_EXAMPLES: CodeExample[] = [
  {
    language: "javascript",
    title: "Idiomatic Express route handler",
    code: `
// IDIOMATIC: async handler with try/catch and proper status codes
app.get("/api/items", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await getItems({ skip: (+page - 1) * +limit, take: +limit });
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: "internal" });
  }
});

// IDIOMATIC: export app for testability, listen only when run directly
export default app;
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  app.listen(3000, () => console.log("server on :3000"));
}
`.trim(),
  },
  {
    language: "javascript",
    title: "Idiomatic data sanitization",
    code: `
// IDIOMATIC: destructure to strip sensitive fields
const safe = users.map(({ passwordHash, ...rest }) => rest);

// IDIOMATIC: use const for values that don't change
const MAX_LENGTH = 1000;

// IDIOMATIC: early return for validation
if (input.length > MAX_LENGTH) {
  return res.status(400).json({ error: "input too long" });
}

// IDIOMATIC: use nullish coalescing for defaults
const raw = req.query.input ?? "";
`.trim(),
  },
  {
    language: "javascript",
    title: "Idiomatic error handling",
    code: `
// IDIOMATIC: specific error messages for each failure case
if (!trimmed) return res.status(400).json({ error: "empty" });
if (trimmed.length > 1000) return res.status(400).json({ error: "input too long" });
if (trimmed.includes("..")) return res.status(400).json({ error: "invalid input" });

// IDIOMATIC: Use Array methods instead of imperative loops
const parsed = trimmed.split(",").map(s => s.trim());
`.trim(),
  },
];

const PYTHON_EXAMPLES: CodeExample[] = [
  {
    language: "python",
    title: "Idiomatic Python function with type hints",
    code: `
# IDIOMATIC: type hints on all parameters and return
def modulo(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("modulo by zero")
    return a % b

# IDIOMATIC: clear test function names
def test_modulo():
    assert modulo(10, 3) == 1
    assert modulo(9, 3) == 0
    assert modulo(7, 4) == 3

def test_modulo_by_zero():
    import pytest
    with pytest.raises(ValueError):
        modulo(1, 0)
`.trim(),
  },
];

const GO_EXAMPLES: CodeExample[] = [
  {
    language: "go",
    title: "Idiomatic Go error handling",
    code: `
// IDIOMATIC: always check and return errors
func main() {
    if err := run(); err != nil {
        log.Fatal(err)
    }
}

// IDIOMATIC: use meaningful variable names
func getUserByID(id int) (*User, error) {
    if id <= 0 {
        return nil, fmt.Errorf("invalid id: %d", id)
    }
    return &User{ID: id, Name: "Alice"}, nil
}
`.trim(),
  },
];

export function getCodeExamples(language: string): CodeExample[] {
  switch (language) {
    case "javascript":
    case "js":
      return EXPRESS_EXAMPLES;
    case "python":
    case "py":
      return PYTHON_EXAMPLES;
    case "go":
      return GO_EXAMPLES;
    default:
      return [];
  }
}

export function formatCodeExamples(language: string): string {
  const examples = getCodeExamples(language);
  if (examples.length === 0) return "";

  const parts = [
    "## Superior Code Reference",
    "",
    "Below are examples of IDIOMATIC, production-quality code in this language.",
    "Follow these patterns EXACTLY. Do NOT deviate from these conventions.",
    "",
  ];

  for (const ex of examples) {
    parts.push(`### ${ex.title}`);
    parts.push("");
    parts.push("```" + ex.language);
    parts.push(ex.code);
    parts.push("```");
    parts.push("");
  }

  return parts.join("\n");
}

export function detectLanguageFromPaths(paths: string[]): string {
  for (const p of paths) {
    if (p.endsWith(".js") || p.includes("package.json")) return "javascript";
    if (p.endsWith(".py")) return "python";
    if (p.endsWith(".go")) return "go";
  }
  return "javascript";
}
