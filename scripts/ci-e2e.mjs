/**
 * CI E2E runner — start prod server, preflight, then Playwright.
 * Must run in a single GitHub Actions step (background jobs die between steps).
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal(process.cwd());

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function waitForHealth(attempts = 90) {
  const healthUrl = `${baseURL}/api/health`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(healthUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body && typeof body === "object" && "ok" in body && body.ok) return;
      }
    } catch {
      // server still booting
    }
    const delayMs = Math.min(1500 * attempt, 5_000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`E2E CI: ${healthUrl} not ready after ${attempts} attempts`);
}

async function main() {
  const log = createWriteStream("server.log", { flags: "a" });
  const server = spawn("npm", ["run", "start:prod"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  });

  server.stdout?.pipe(log);
  server.stderr?.pipe(log);

  const stopServer = () => {
    if (!server.killed) server.kill("SIGTERM");
  };
  process.on("SIGINT", stopServer);
  process.on("SIGTERM", stopServer);

  const playwrightArgs = process.argv.slice(2);

  try {
    await waitForHealth();
    await run("npx", ["tsx", "tests/e2e-preflight-cli.ts"]);
    await run(
      "npx",
      ["playwright", "test", ...(playwrightArgs.length > 0 ? playwrightArgs : [])],
      {
        CI: "true",
        E2E_NO_WEBSERVER: "1",
        E2E_PREFLIGHT_DONE: "1",
      }
    );
  } finally {
    stopServer();
    log.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
