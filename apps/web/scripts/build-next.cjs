const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const NEXT_DIR = ".next";
const CACHE_DIR = path.join(NEXT_DIR, "cache");

function safeRm(target) {
  try {
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.warn(`[build-next] warning: could not remove ${target}: ${message}`);
  }
}

fs.mkdirSync(CACHE_DIR, { recursive: true });

for (const name of fs.readdirSync(NEXT_DIR)) {
  const fullPath = path.join(NEXT_DIR, name);
  if (name === "cache") {
    for (const cacheName of fs.readdirSync(fullPath)) {
      safeRm(path.join(fullPath, cacheName));
    }
    continue;
  }
  safeRm(fullPath);
}

const nextBin = require.resolve("next/dist/bin/next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
});

process.exit(result.status ?? 1);
