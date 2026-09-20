import crypto from "node:crypto";

// Uppercase letters and digits, excluding 0/O/1/I to avoid visual ambiguity.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}
