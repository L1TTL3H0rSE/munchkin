import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { checkTextPaths } from "../src/text.mjs";
import { temporaryDirectory, writeFile } from "./helpers.mjs";

test("text checks enforce strict UTF-8 and LF while allowing Windows scripts", () => {
  const root = temporaryDirectory();
  writeFile(root, "valid.md", "Привет\n");
  writeFile(root, "crlf.md", "line\r\n");
  writeFile(root, "script.cmd", "@echo off\r\n");
  fs.writeFileSync(`${root}/invalid.proto`, Buffer.from([0xd0, 0x20]));

  const result = checkTextPaths(root, [
    "valid.md",
    "crlf.md",
    "script.cmd",
    "invalid.proto",
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(
    (issue) => issue.path === "crlf.md" && issue.code === "crlf-not-allowed",
  ));
  assert.ok(result.issues.some(
    (issue) => issue.path === "invalid.proto" && issue.code === "invalid-utf8",
  ));
  assert.equal(result.issues.some((issue) => issue.path === "script.cmd"), false);
});
