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

  // Betriebsausgaben für das Jahr (from buchungen with type=ENTNAHME and isBusinessRecord=true)
  const ausgaben = await prisma.buchung.findMany({
    where: { companyId, type: "ENTNAHME", isBusinessRecord: true, date: { gte: yearStart, lt: yearEnd } },
  });

  const ausgabenGesamt = ausgaben.reduce((s, a) => s + Number(a.amount), 0);
  const ausgabenVorsteuer = ausgaben.reduce((s, a) => {
    const brutto = Number(a.amount);
    const rate = (a.steuersatz || 0) / 100;
    return s + (rate > 0 ? Math.round((brutto / (1 + rate)) * rate * 100) / 100 : 0);
  }, 0);

  // Ausgaben nach Kategorie
  const ausgabenByKategorieMap: Record<string, number> = {};
  for (const a of ausgaben) {
    const k = a.kategorie || "Sonstige";
    ausgabenByKategorieMap[k] = (ausgabenByKategorieMap[k] ?? 0) + Number(a.amount);
  }
  const ausgabenByKategorie = Object.entries(ausgabenByKategorieMap).map(([kategorie, betrag]) => ({ kategorie, betrag }));

  // Sonstige Einnahmen für das Jahr (from buchungen with type=EINLAGE and isBusinessRecord=true)
  const einnahmen = await prisma.buchung.findMany({
    where: { companyId, type: "EINLAGE", isBusinessRecord: true, date: { gte: yearStart, lt: yearEnd } },
  });
  const sonstigeEinnahmen = einnahmen.reduce((s, e) => s + Number(e.amount), 0);
  const einnahmenUst = einnahmen.reduce((s, e) => {
    const brutto = Number(e.amount);
    const rate = (e.steuersatz || 0) / 100;
    return s + (rate > 0 ? Math.round((brutto / (1 + rate)) * rate * 100) / 100 : 0);
  }, 0);

  // Kasse / Bank aus sonstigen Einnahmen und Ausgaben (nach Zahlungsart)
  const einnahmenKasse = einnahmen.filter((e) => e.zahlungsart === "KASSE").reduce((s, e) => s + Number(e.amount), 0);
  const ausgabenKasse = ausgaben.filter((a) => a.zahlungsart === "KASSE").reduce((s, a) => s + Number(a.amount), 0);
  const einnahmenBank = einnahmen.filter((e) => e.zahlungsart === "BANK").reduce((s, e) => s + Number(e.amount), 0);
  const ausgabenBank = ausgaben.filter((a) => a.zahlungsart === "BANK").reduce((s, a) => s + Number(a.amount), 0);

  // Kasse-Saldo = bezahlte Rechnungen (Kasse-Anteil wird nicht getrennt) + sonstige Einnahmen Kasse - Ausgaben Kasse
  // Bank-Näherung = bezahlte Rechnungen + sonstige Einnahmen Bank - Ausgaben Bank
  const kasseNetto = einnahmenKasse - ausgabenKasse;
  const bankNetto = bank + einnahmenBank - ausgabenBank;
  const summeAktivaErweitert = forderungen + Math.max(0, bankNetto) + Math.max(0, kasseNetto);

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
      ausgabenVorsteuer,
      ausgabenByKategorie,
      sonstigeEinnahmen,
      einnahmenUst,
      jahresergebnis,
    },
    bilanz: {
      aktiva: {
        forderungen: { betrag: forderungen, anzahl: forderungenAgg._count },
        bank: { betrag: Math.max(0, bankNetto), anzahl: bankAgg._count },
        kasse: { betrag: Math.max(0, kasseNetto) },
        summe: summeAktivaErweitert,
      },
      passiva: {
        eigenkapital: summeAktivaErweitert,
        summe: summeAktivaErweitert,
      },
    },
  });
}
