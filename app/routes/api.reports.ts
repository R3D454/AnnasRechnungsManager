import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma";
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

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: [InvoiceStatus.PAID, InvoiceStatus.SENT] },
      issueDate: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
    include: { items: true, customer: { select: { name: true } } },
    orderBy: { issueDate: "asc" },
  });

  const monthly: Record<number, {
    month: number;
    invoiceCount: number;
    netTotal: number;
    taxTotal: number;
    grossTotal: number;
    taxGroups: Record<number, { netAmount: number; taxAmount: number }>;
  }> = {};

  for (let m = 1; m <= 12; m++) {
    monthly[m] = { month: m, invoiceCount: 0, netTotal: 0, taxTotal: 0, grossTotal: 0, taxGroups: {} };
  }

  for (const invoice of invoices) {
    const month = new Date(invoice.issueDate).getMonth() + 1;
    const m = monthly[month];
    m.invoiceCount++;
    m.netTotal += Number(invoice.netTotal);
    m.taxTotal += Number(invoice.taxTotal);
    m.grossTotal += Number(invoice.grossTotal);

    for (const item of invoice.items) {
      const rate = Number(item.taxRate);
      if (!m.taxGroups[rate]) m.taxGroups[rate] = { netAmount: 0, taxAmount: 0 };
      m.taxGroups[rate].netAmount += Number(item.netAmount);
      m.taxGroups[rate].taxAmount += Number(item.taxAmount);
    }
  }

  const quarterly = [1, 2, 3, 4].map((q) => {
    const months = [q * 3 - 2, q * 3 - 1, q * 3];
    const data = months.map((m) => monthly[m]);
    const taxGroups: Record<number, { netAmount: number; taxAmount: number }> = {};

    for (const m of data) {
      for (const [rate, group] of Object.entries(m.taxGroups)) {
        const r = Number(rate);
        if (!taxGroups[r]) taxGroups[r] = { netAmount: 0, taxAmount: 0 };
        taxGroups[r].netAmount += group.netAmount;
        taxGroups[r].taxAmount += group.taxAmount;
      }
    }

    return {
      quarter: q,
      invoiceCount: data.reduce((s, m) => s + m.invoiceCount, 0),
      netTotal: data.reduce((s, m) => s + m.netTotal, 0),
      taxTotal: data.reduce((s, m) => s + m.taxTotal, 0),
      grossTotal: data.reduce((s, m) => s + m.grossTotal, 0),
      taxGroups,
    };
  });

  const yearTotal = {
    invoiceCount: invoices.length,
    netTotal: invoices.reduce((s, i) => s + Number(i.netTotal), 0),
    taxTotal: invoices.reduce((s, i) => s + Number(i.taxTotal), 0),
    grossTotal: invoices.reduce((s, i) => s + Number(i.grossTotal), 0),
  };

  return Response.json({ year, monthly: Object.values(monthly), quarterly, yearTotal, invoices });
}
