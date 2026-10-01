import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const analyzer = "github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2";
const module = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../backend/game/", import.meta.url));
if (!existsSync(resolve(module, "go.mod"))) {
  throw new Error(`Go module not found: ${module}`);
}
const result = spawnSync("go", ["run", analyzer, "run", "./..."], {
  cwd: module,
  stdio: "inherit",
  env: {
    ...process.env,
    // Diagnostics cache absolute paths: never share the cache between worktrees.
    GOLANGCI_LINT_CACHE: process.env.GOLANGCI_LINT_CACHE || resolve(module, ".cache/golangci-lint"),
  },
});
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
