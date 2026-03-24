import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { InvoiceStatus } from "@prisma/client";

export async function loader({ request }: { request: Request }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  if (!companyId) return Response.json({ error: "companyId required" }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { id: companyId, userId: user.id } });
  if (!company) return Response.json({ error: "Not found" }, { status: 404 });

  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year + 1}-01-01`);

  // GuV: alle Rechnungen des Jahres (PAID + SENT)
  const guvInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: [InvoiceStatus.PAID, InvoiceStatus.SENT] },
      issueDate: { gte: yearStart, lt: yearEnd },
    },
    include: { items: true },
  });

  // Umsatzerlöse nach Steuersatz
  const erloeseByRate: Record<string, { netAmount: number; taxAmount: number; grossAmount: number }> = {};
  for (const invoice of guvInvoices) {
    for (const item of invoice.items) {
      const rate = String(Number(item.taxRate));
      if (!erloeseByRate[rate]) erloeseByRate[rate] = { netAmount: 0, taxAmount: 0, grossAmount: 0 };
      erloeseByRate[rate].netAmount += Number(item.netAmount);
      erloeseByRate[rate].taxAmount += Number(item.taxAmount);
      erloeseByRate[rate].grossAmount += Number(item.grossAmount);
    }
  }

  const guvNetto = guvInvoices.reduce((s, i) => s + Number(i.netTotal), 0);
  const guvSteuer = guvInvoices.reduce((s, i) => s + Number(i.taxTotal), 0);
  const guvBrutto = guvInvoices.reduce((s, i) => s + Number(i.grossTotal), 0);

  // Bilanz-Stichtag: 31.12. des gewählten Jahres
  // Forderungen = offene (SENT) Rechnungen bis Jahresende
  const forderungenAgg = await prisma.invoice.aggregate({
    where: { companyId, status: InvoiceStatus.SENT, issueDate: { lt: yearEnd } },
    _sum: { grossTotal: true },
    _count: true,
  });

  // Bank/Kasse-Näherung = bezahlte Rechnungen (brutto) bis Jahresende
  const bankAgg = await prisma.invoice.aggregate({
    where: { companyId, status: InvoiceStatus.PAID, issueDate: { lt: yearEnd } },
    _sum: { grossTotal: true },
    _count: true,
  });

  const forderungen = Number(forderungenAgg._sum.grossTotal ?? 0);
  const bank = Number(bankAgg._sum.grossTotal ?? 0);
  const summeAktiva = forderungen + bank;

  // Betriebsausgaben für das Jahr
  const ausgabenAgg = await prisma.betriebsausgabe.aggregate({
    where: { companyId, datum: { gte: yearStart, lt: yearEnd } },
    _sum: { betrag: true },
    _count: true,
  });

  const ausgabenByKategorie = await prisma.betriebsausgabe.groupBy({
    by: ["kategorie"],
    where: { companyId, datum: { gte: yearStart, lt: yearEnd } },
    _sum: { betrag: true },
  });

  const ausgabenGesamt = Number(ausgabenAgg._sum.betrag ?? 0);

  // Sonstige Einnahmen für das Jahr
  const einnahmenAgg = await prisma.betriebseinnahme.aggregate({
    where: { companyId, datum: { gte: yearStart, lt: yearEnd } },
    _sum: { betrag: true },
  });
  const sonstigeEinnahmen = Number(einnahmenAgg._sum.betrag ?? 0);

  const jahresergebnis = guvNetto + sonstigeEinnahmen - ausgabenGesamt;

  return Response.json({
    year,
    kleinunternehmer: company.kleinunternehmer,
    guv: {
      erloeseByRate,
      netTotal: guvNetto,
      taxTotal: guvSteuer,
      grossTotal: guvBrutto,
      invoiceCount: guvInvoices.length,
      ausgabenGesamt,
      ausgabenByKategorie: ausgabenByKategorie.map((a) => ({
        kategorie: a.kategorie,
        betrag: Number(a._sum.betrag ?? 0),
      })),
      sonstigeEinnahmen,
      jahresergebnis,
    },
    bilanz: {
      aktiva: {
        forderungen: { betrag: forderungen, anzahl: forderungenAgg._count },
        bank: { betrag: bank, anzahl: bankAgg._count },
        summe: summeAktiva,
      },
      passiva: {
        eigenkapital: summeAktiva,
        summe: summeAktiva,
      },
    },
  });
}
