#!/usr/bin/env node
/** Kill stale Next.js dev server, clear .next cache, restart on :3000 */
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDevCacheCorrupt } from "./check-dev-cache.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(root, ".next", "dev", "lock");
const nextDir = join(root, ".next");

function killPort(port) {
  try {
    const pids = execSync(`lsof -ti:${port}`, { encoding: "utf8" }).trim();
    if (pids) {
      for (const pid of pids.split("\n")) {
        try {
          process.kill(Number(pid), "SIGKILL");
          console.log(`Killed PID ${pid} on :${port}`);
        } catch {
          // already gone
        }
      }
    }
  } catch {
    // nothing listening
  }
}

if (existsSync(lockPath)) {
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    if (lock.pid) {
      try {
        process.kill(lock.pid, "SIGKILL");
        console.log(`Killed lock PID ${lock.pid}`);
      } catch {
        // already gone
      }
    }
  } catch {
    // ignore bad lock
  }
}

killPort(3000);

if (existsSync(nextDir) && isDevCacheCorrupt()) {
  console.log("Removing corrupted .next dev cache (prerender-manifest.json)…");
}

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("Removed .next cache");
}

console.log("Starting dev server on http://127.0.0.1:3000 …");
const child = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, SERWIST_SUPPRESS_TURBOPACK_WARNING: "1" },
});

child.on("exit", (code) => process.exit(code ?? 0));
