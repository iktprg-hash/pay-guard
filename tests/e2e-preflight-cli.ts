import { runE2ePreflight } from "./helpers/e2e-preflight";

runE2ePreflight().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
