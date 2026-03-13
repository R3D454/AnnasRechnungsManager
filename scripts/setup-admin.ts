/**
 * setup-admin.ts
 *
 * Ensures the initial admin user (username: "admin") exists.
 * Called automatically on every container start.
 *
 * Behaviour:
 *   - ADMIN_PASSWORD set      → create or update admin with that password
 *   - ADMIN_PASSWORD not set, admin exists   → nothing to do, skip silently
 *   - ADMIN_PASSWORD not set, admin missing  → generate a random password,
 *                                              create the user, print to logs
 *
 * Manual usage:
 *   ADMIN_PASSWORD=secret npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/setup-admin.ts
 *   docker exec -e ADMIN_PASSWORD=secret annas_app node scripts/setup-admin.cjs
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function generatePassword(length = 16): string {
  // URL-safe characters only so the password is easy to copy from logs
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64url")
    .slice(0, length);
}

async function main() {
  const explicitPassword = process.env.ADMIN_PASSWORD ?? process.argv[2];

  const existing = await prisma.user.findUnique({ where: { username: "admin" } });

  // Admin exists and no explicit password override → nothing to do
  if (existing && !explicitPassword) {
    console.log("[setup-admin] Admin user already exists – skipping.");
    return;
  }

  let password: string;
  let generated = false;

  if (explicitPassword) {
    if (explicitPassword.length < 8) {
      console.error("[setup-admin] ERROR: ADMIN_PASSWORD must be at least 8 characters.");
      process.exit(1);
    }
    password = explicitPassword;
  } else {
    // No admin user yet and no password given → auto-generate
    password = generatePassword(16);
    generated = true;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash, role: "ADMIN" },
    create: {
      username: "admin",
      email: "admin@localhost",
      name: "Administrator",
      passwordHash,
      role: "ADMIN",
    },
  });

  if (generated) {
    console.log("");
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║          ADMIN-ZUGANGSDATEN (einmalig)           ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║  Benutzername : admin                            ║`);
    console.log(`║  Passwort     : ${password.padEnd(32)} ║`);
    console.log("╠══════════════════════════════════════════════════╣");
    console.log("║  Bitte sofort nach dem ersten Login ändern!      ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log("");
  } else {
    console.log(`[setup-admin] ✅ Admin user ${existing ? "updated" : "created"} (username: admin).`);
  }
}

main()
  .catch((e) => {
    console.error("[setup-admin] FATAL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
