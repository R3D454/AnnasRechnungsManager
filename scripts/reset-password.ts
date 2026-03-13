/**
 * reset-password.ts
 *
 * Emergency recovery script – resets the password for any user.
 * Run directly inside the container via docker exec.
 *
 * Usage:
 *   docker exec -it annas_app node scripts/reset-password.js --username admin --password newpassword
 *
 * During development:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/reset-password.ts --username admin --password newpassword
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function parseArgs(): { username: string; password: string } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const username = get("--username");
  const password = get("--password");

  if (!username || !password) {
    console.error("Usage: reset-password --username <username> --password <newpassword>");
    process.exit(1);
  }

  return { username, password };
}

async function main() {
  const { username, password } = parseArgs();

  if (password.length < 8) {
    console.error("ERROR: Password must be at least 8 characters.");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({ where: { username } });
  if (!user) {
    console.error(`ERROR: No user found with username "${username}".`);
    const all = await prisma.user.findMany({ select: { username: true, email: true, role: true } });
    console.error("Available users:");
    all.forEach((u) => console.error(`  - ${u.username} (${u.email}) [${u.role}]`));
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  console.log(`✅ Password reset for user "${username}" (${user.email}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
