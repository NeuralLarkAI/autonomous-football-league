const { spawn } = require("node:child_process");

const port = process.env.PORT || "3000";
const child = spawn(
  "corepack",
  ["pnpm", "--filter", "@afl/web", "exec", "next", "start", "-p", port],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
