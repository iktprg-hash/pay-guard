#!/usr/bin/env node
/** Kill process on :3000 and start production server (Upstash rate limits) */
import { execSync, spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

killPort(3000);

console.log("Starting production server on http://127.0.0.1:3000 …");
const child = spawn(
  "npx",
  ["next", "start", "--hostname", "127.0.0.1", "--port", "3000"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
