import { execSync } from "node:child_process";
import prisma from "./prisma.server";

let initStarted = false;
let initCompleted = false;

/**
 * Run Prisma migrations to bring database schema up to date
 */
async function runMigrations(): Promise<void> {
  try {
    console.log("[DB Init] Running Prisma migrations...");
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env },
    });
    console.log("[DB Init] ✓ Migrations completed successfully");
  } catch (error) {
    console.error("[DB Init] ✗ Migration failed:", error);
    throw new Error("Database migration failed. See logs above.");
  }
}

/**
 * Initialize database: run all pending migrations
 * Safe to call multiple times (idempotent)
 */
export async function initializeDatabase(): Promise<void> {
  // Prevent concurrent initialization attempts
  if (initCompleted) return;
  if (initStarted) {
    // Wait for initialization to complete
    while (!initCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return;
  }

  initStarted = true;

  try {
    await runMigrations();
    console.log("[DB Init] ✓ Database initialization complete");
  } catch (error) {
    console.error("[DB Init] Fatal error during database initialization:", error);
    throw error;
  } finally {
    initCompleted = true;
  }
}

/**
 * Check database health (non-blocking)
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  isEmpty: boolean;
  error?: string;
}> {
  try {
    const userCount = await prisma.user.count();
    return {
      connected: true,
      isEmpty: userCount === 0,
    };
  } catch (error) {
    return {
      connected: false,
      isEmpty: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
