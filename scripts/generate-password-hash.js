#!/usr/bin/env node
/**
 * Generate a bcrypt password hash for ADMIN_PASSWORD_HASH env var.
 *
 * Usage:
 *   node scripts/generate-password-hash.js your-password-here
 *   node scripts/generate-password-hash.js  # prompts for password
 */
const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/generate-password-hash.js <password>");
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  const escaped = hash.replace(/\$/g, "\\$");
  console.log("\nAdd this to your .env file:\n");
  console.log(`ADMIN_PASSWORD_HASH=${escaped}`);
  console.log("\n($ signs are escaped with \\ to prevent dotenv-expand from corrupting the hash)");
});
