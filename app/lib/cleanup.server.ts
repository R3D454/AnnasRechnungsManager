import cron from "node-cron";
import prisma from "@/lib/prisma.server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function purgeExpiredDeletedInvoices(): Promise<void> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
  const result = await prisma.invoice.deleteMany({
    where: { status: "DELETED", deletedAt: { lte: cutoff } },
  });
  if (result.count > 0) {
    console.log(
      `[cleanup] ${result.count} Rechnung(en) endgültig gelöscht (vor ${cutoff.toISOString()})`
    );
  }
}

let scheduled = false;

export function startCleanupScheduler(): void {
  if (scheduled) return;
  scheduled = true;

  purgeExpiredDeletedInvoices().catch((err) =>
    console.error("[cleanup] Startup-Bereinigung fehlgeschlagen:", err)
  );

  cron.schedule("0 2 * * *", () => {
    purgeExpiredDeletedInvoices().catch((err) =>
      console.error("[cleanup] Geplante Bereinigung fehlgeschlagen:", err)
    );
  });

  console.log("[cleanup] Scheduler aktiv — täglich 02:00 Uhr");
}
