import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";

type Transaction = {
  id: string;
  date: string;
  account: "kasse" | "bank";
  type: "einlage" | "entnahme";
  amount: number;
  description: string;
  isBusinessRecord: boolean;
  kategorie: string | null;
};

function toTransaction(buchung: { id: string; date: Date; account: "KASSE" | "BANK"; type: "EINLAGE" | "ENTNAHME"; amount: { toString(): string } | number | string; description: string | null | undefined; isBusinessRecord: boolean; kategorie: string | null | undefined }): Transaction {
  return {
    id: buchung.id,
    date: buchung.date.toISOString().split("T")[0],
    account: buchung.account === "KASSE" ? "kasse" : "bank",
    type: buchung.type === "EINLAGE" ? "einlage" : "entnahme",
    amount: Number(buchung.amount),
    description: buchung.description || "",
    isBusinessRecord: buchung.isBusinessRecord,
    kategorie: buchung.kategorie || null,
  };
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = params;

  const company = await prisma.company.findFirst({
    where: { id, userId: user.id },
  });

  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const buchungen = (await prisma.buchung.findMany({
    where: { companyId: id },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      account: true,
      type: true,
      amount: true,
      description: true,
      isBusinessRecord: true,
      kategorie: true,
    },
  })) as unknown as Array<{ id: string; date: Date; account: "KASSE" | "BANK"; type: "EINLAGE" | "ENTNAHME"; amount: any; description: string | null; isBusinessRecord: boolean; kategorie: string | null }>;


  const transactions = buchungen.map(toTransaction);
  const balance = transactions.reduce((sum: number, t: Transaction) => sum + (t.type === "einlage" ? t.amount : -t.amount), 0 as number);

  return Response.json({ transactions, balance });
}

export async function action({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = params;

  const company = await prisma.company.findFirst({
    where: { id, userId: user.id },
  });
  if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

  const url = new URL(request.url);
  const transactionId = url.searchParams.get("transactionId");
  const method = request.method;
  const data = await request.json().catch(() => ({}));

  if (method === "POST") {
    const amount = Number(data.amount);
    if (!data.date || !data.account || Number.isNaN(amount) || amount <= 0) {
      return Response.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    // Check if this is an Umbuchung (transfer between accounts)
    if (data.type === "umbuchung") {
      if (!data.toAccount) {
        return Response.json({ error: "toAccount erforderlich für Umbuchung" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        // ENTNAHME from source account
        const entnahme = await tx.buchung.create({
          data: {
            companyId: id,
            date: new Date(data.date),
            account: data.account === "bank" ? "BANK" : "KASSE",
            type: "ENTNAHME",
            amount: amount,
            description: data.description || "",
          },
        });

        // EINLAGE to target account, linked to the entnahme
        await tx.buchung.create({
          data: {
            companyId: id,
            date: new Date(data.date),
            account: data.toAccount === "bank" ? "BANK" : "KASSE",
            type: "EINLAGE",
            amount: amount,
            description: data.description || "",
            linkedBuchungId: entnahme.id,
          },
        });
      });
    } else {
      if (!data.type) {
        return Response.json({ error: "type erforderlich" }, { status: 400 });
      }

      await prisma.buchung.create({
        data: {
          companyId: id,
          date: new Date(data.date),
          account: data.account === "bank" ? "BANK" : "KASSE",
          type: data.type === "entnahme" ? "ENTNAHME" : "EINLAGE",
          amount: amount,
          description: data.description || "",
        },
      });
    }
  } else if (method === "PUT") {
    if (!transactionId) return Response.json({ error: "transactionId required" }, { status: 400 });
    const amount = Number(data.amount);
    if (!data.date || !data.account || !data.type || Number.isNaN(amount) || amount <= 0) {
      return Response.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    const exist = (await prisma.buchung.findFirst({
      where: { id: transactionId, companyId: id },
      select: {
        id: true,
        date: true,
        account: true,
        type: true,
        amount: true,
        description: true,
        isBusinessRecord: true,
      },
    })) as unknown as { id: string; date: Date; account: "KASSE" | "BANK"; type: "EINLAGE" | "ENTNAHME"; amount: any; description: string | null; isBusinessRecord: boolean } | null;
    if (!exist) return Response.json({ error: "Transaction not found" }, { status: 404 });

    // Block edit if this is an auto-created Buchung (from Einnahme/Ausgabe)
    if (exist.isBusinessRecord) {
      return Response.json(
        { error: "Automatisch erstellte Transaktionen können nicht direkt bearbeitet werden" },
        { status: 400 }
      );
    }

    await prisma.buchung.update({
      where: { id: transactionId },
      data: {
        date: new Date(data.date),
        account: data.account === "bank" ? "BANK" : "KASSE",
        type: data.type === "entnahme" ? "ENTNAHME" : "EINLAGE",
        amount: amount,
        description: data.description || "",
      },
    });
  } else if (method === "DELETE") {
    if (!transactionId) return Response.json({ error: "transactionId required" }, { status: 400 });

    const exist = await prisma.buchung.findFirst({ where: { id: transactionId, companyId: id } });
    if (!exist) return Response.json({ error: "Transaction not found" }, { status: 404 });

    // For Umbuchung (linked transactions), delete both
    const linkedId = (exist as any).linkedBuchungId;
    const isLinkedFrom = await prisma.buchung.findFirst({
      where: { linkedBuchungId: transactionId } as any,
    });

    if (linkedId || isLinkedFrom) {
      await prisma.$transaction(async (tx) => {
        // If this is the ENTNAHME, delete linked EINLAGE
        if (linkedId) {
          await tx.buchung.deleteMany({ where: { id: linkedId } });
        }
        // If this is the EINLAGE, delete linked ENTNAHME
        if (isLinkedFrom) {
          await tx.buchung.deleteMany({ where: { id: isLinkedFrom.id } });
        }
        // Delete this entry
        await tx.buchung.deleteMany({ where: { id: transactionId, companyId: id } });
      });
    } else {
      // Regular transaction
      await prisma.buchung.deleteMany({ where: { id: transactionId, companyId: id } });
    }
  } else {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const buchungen = await prisma.buchung.findMany({
    where: { companyId: id },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      account: true,
      type: true,
      amount: true,
      description: true,
      isBusinessRecord: true,
      kategorie: true,
    },
  });
  const transactions = buchungen.map(toTransaction);
  const balance = transactions.reduce((sum: number, t: Transaction) => sum + (t.type === "einlage" ? t.amount : -t.amount), 0 as number);

  return Response.json({ transactions, balance });
}
