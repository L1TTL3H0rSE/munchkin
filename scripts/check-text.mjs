import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {checkTextPaths} from "./lib/text.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean);
const result = checkTextPaths(root, paths);
for (const issue of result.issues) {
  console.error(`${issue.path}: ${issue.message}`);
}
console.log(`UTF-8: ${result.checked.length} files checked, ${result.issues.length} issues`);
if (result.checked.length === 0 || !result.ok) {
  process.exitCode = 1;
}
