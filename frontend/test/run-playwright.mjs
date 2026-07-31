import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const cliPath = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const child = spawn(
  process.execPath,
  [cliPath, ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      PW_DISABLE_TS_ESM: "1",
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
