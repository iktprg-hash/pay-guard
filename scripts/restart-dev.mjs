#!/usr/bin/env node
/** Kill stale Next.js dev server and restart Pay Guard on :3000 */
import { execSync, spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(root, ".next", "dev", "lock");

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

console.log("Starting dev server on http://127.0.0.1:3000 …");
const child = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, SERWIST_SUPPRESS_TURBOPACK_WARNING: "1" },
});

child.on("exit", (code) => process.exit(code ?? 0));
