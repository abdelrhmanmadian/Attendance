import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string(),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  MANAGER1_EMAIL: z.string().email().optional(),
  MANAGER1_TEMP_PASSWORD: z.string().optional(),
  MANAGER2_EMAIL: z.string().email().optional(),
  MANAGER2_TEMP_PASSWORD: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional().default(""),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional().default(""),
  GOOGLE_SHEET_ID: z.string().optional().default(""),
  // Only used on Vercel: verifies requests to /api/cron/* actually come from
  // Vercel's own Cron Jobs scheduler (which sends this as a Bearer token when
  // the env var of the same name is set), not just anyone who finds the URL.
  CRON_SECRET: z.string().optional().default(""),
});

export const env = envSchema.parse(process.env);

// Just the service-account credentials — enough to read/write any sheet the
// account has been shared access to, regardless of GOOGLE_SHEET_ID (which is
// specifically the attendance-output spreadsheet, not a schedule source).
export const googleCredentialsConfigured =
  env.GOOGLE_SERVICE_ACCOUNT_EMAIL.length > 0 && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.length > 0;

export const sheetsConfigured = googleCredentialsConfigured && env.GOOGLE_SHEET_ID.length > 0;
