import fs from "node:fs";
import path from "node:path";

const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });
const TEXT_EXTENSIONS = new Set([
  ".bat", ".cjs", ".cmd", ".css", ".csv", ".env", ".go", ".graphql",
  ".gql", ".gradle", ".html", ".ini", ".java", ".js", ".json", ".jsonc",
  ".jsx", ".kt", ".kts", ".lock", ".md", ".mjs", ".mod", ".mts",
  ".properties", ".proto", ".py", ".rs", ".scss", ".sh", ".sql", ".sum",
  ".svg", ".toml", ".ts", ".tsx", ".txt", ".vue", ".xml", ".yaml", ".yml",
]);
const TEXT_FILENAMES = new Set([
  ".editorconfig", ".gitattributes", ".gitignore", "AGENTS.md", "Dockerfile",
  "Makefile", "README", "README.md", "leinoctl",
]);
const WINDOWS_SCRIPT_EXTENSIONS = new Set([".bat", ".cmd"]);

export function decodeUtf8Strict(bytes, source = "text") {
  try {
    const text = STRICT_UTF8.decode(bytes);
    if (text.includes("\uFFFD")) {
      throw new Error(`${source}: contains U+FFFD replacement character`);
    }
    return text;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`${source}: invalid UTF-8 byte sequence`, { cause: error });
    }
    throw error;
  }
}

export function readUtf8Strict(filePath) {
  return decodeUtf8Strict(fs.readFileSync(filePath), filePath);
}

export function isLikelyTextPath(filePath) {
  const base = path.basename(filePath);
  return TEXT_FILENAMES.has(base) || TEXT_EXTENSIONS.has(path.extname(base).toLowerCase());
}

export function detectMojibake(text) {
  const value = String(text ?? "");
  const compactLength = value.replace(/\s/gu, "").length || 1;
  const windows1251Pairs = value.match(/[РС](?:[\u00A0-\u00BF\u0402-\u040F\u0452-\u045F\u2010-\u203A\u20AC\u2122])/gu) ?? [];
  const latin1Pairs = value.match(/[ÃÂÐÑ](?:[\u0080-\u00BF\u0400-\u04FF])?/gu) ?? [];
  const issues = [];

  if (value.includes("\uFFFD")) {
    issues.push({
      code: "replacement-character",
      message: "text contains U+FFFD replacement character",
    });
  }
  if (windows1251Pairs.length >= 3 && windows1251Pairs.length / compactLength >= 0.08) {
    issues.push({
      code: "likely-utf8-as-windows1251",
      message: `high-confidence UTF-8/Windows-1251 mojibake (${windows1251Pairs.length} artifact pairs)`,
    });
  }
  if (latin1Pairs.length >= 3 && latin1Pairs.length / compactLength >= 0.08) {
    issues.push({
      code: "likely-utf8-as-latin1",
      message: `high-confidence UTF-8/Latin-1 mojibake (${latin1Pairs.length} artifact pairs)`,
    });
  }
  return issues;
}

function eolIssues(filePath, text) {
  const issues = [];
  if (/\r(?!\n)/.test(text)) {
    issues.push({ code: "bare-cr", message: "text contains a bare CR line ending" });
  }
  if (
    text.includes("\r\n")
    && !WINDOWS_SCRIPT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  ) {
    issues.push({ code: "crlf-not-allowed", message: "text must use LF line endings" });
  }
  return issues;
}

export function validateTextFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.includes(0)) {
    return { skipped: true, reason: "binary NUL byte" };
  }
  const text = decodeUtf8Strict(bytes, filePath);
  return {
    skipped: false,
    text,
    issues: [
      ...detectMojibake(text),
      ...eolIssues(filePath, text),
    ],
  };
}

export function checkTextPaths(repoRoot, paths) {
  const checked = [];
  const skipped = [];
  const issues = [];
  for (const repoPath of [...new Set(paths)].sort()) {
    const absolute = path.join(repoRoot, ...repoPath.split("/"));
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      skipped.push({ path: repoPath, reason: "missing-or-not-file" });
      continue;
    }
    if (!isLikelyTextPath(repoPath)) {
      skipped.push({ path: repoPath, reason: "not-a-known-text-path" });
      continue;
    }
    try {
      const result = validateTextFile(absolute);
      if (result.skipped) {
        skipped.push({ path: repoPath, reason: result.reason });
        continue;
      }
      checked.push(repoPath);
      for (const issue of result.issues) {
        issues.push({ path: repoPath, ...issue });
      }
    } catch (error) {
      issues.push({
        path: repoPath,
        code: "invalid-utf8",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    checked,
    skipped,
    issues,
    ok: issues.length === 0,
  };
}
