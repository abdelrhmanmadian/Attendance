import { execSync } from "node:child_process";
import dotenv from "dotenv";

export async function setup() {
  dotenv.config({ path: ".env.test", override: true });

  // Wipes and re-applies migrations against the test database (which must
  // already exist — see docker-compose.yml's init script). Using `reset`
  // rather than `deploy` guarantees a clean slate even if a previous run
  // left stray rows behind.
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env },
    stdio: "inherit",
  });
}
