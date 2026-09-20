import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function resolveTestDbPath(): string {
  // Prisma resolves a SQLite "file:" datasource URL relative to schema.prisma's
  // own directory, not the process cwd — match that here so cleanup actually
  // finds the file Prisma created.
  const raw = process.env.DATABASE_URL!.replace(/^file:/, "");
  return path.resolve(process.cwd(), "prisma", raw);
}

export async function setup() {
  dotenv.config({ path: ".env.test", override: true });
  const dbPath = resolveTestDbPath();
  if (existsSync(dbPath)) unlinkSync(dbPath);

  execSync("npx prisma migrate deploy", {
    env: { ...process.env },
    stdio: "inherit",
  });
}

export async function teardown() {
  const dbPath = resolveTestDbPath();
  if (existsSync(dbPath)) unlinkSync(dbPath);
}
