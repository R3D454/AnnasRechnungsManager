import { getApiUser } from "@/session.server";
import prisma from "@/lib/prisma.server";

const UNIT_C62 = "C62" as const;
const UNIT_HUR = "HUR" as const;
const UNIT_DAY = "DAY" as const;
const UNIT_MON = "MON" as const;
const UNIT_ANN = "ANN" as const;
const UNIT_KMT = "KMT" as const;
type UnitCode = typeof UNIT_C62 | typeof UNIT_HUR | typeof UNIT_DAY | typeof UNIT_MON | typeof UNIT_ANN | typeof UNIT_KMT;

function toUnitCode(unit: string | null | undefined): UnitCode {
  if (!unit) return UNIT_C62;
  const u = unit.toLowerCase().trim();
  if (u === "stunde" || u === "stunden" || u === "h" || u === "std" || u === "hour") return UNIT_HUR;
  if (u === "tag" || u === "tage" || u === "day" || u === "days") return UNIT_DAY;
  if (u === "monat" || u === "monate" || u === "month") return UNIT_MON;
  if (u === "jahr" || u === "jahre" || u === "year") return UNIT_ANN;
  if (u === "km") return UNIT_KMT;
  return UNIT_C62;
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, company: { userId: user.id } },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
      company: true,
    },
  });

  if (!invoice) return Response.json({ error: "Not found" }, { status: 404 });

  const { zugferd } = await import("node-zugferd");
  const { EN16931 } = await import("node-zugferd/profile");

  const z = zugferd({ profile: EN16931, strict: false });

  const isKleinunternehmer = invoice.kleinunternehmer;
  const netTotal = Number(invoice.netTotal);
  const taxTotal = Number(invoice.taxTotal);
  const grossTotal = Number(invoice.grossTotal);

  // Group taxes by rate for vatBreakdown
  const taxGroups: Record<number, { basis: number; tax: number }> = {};
  for (const item of invoice.items) {
    const rate = Number(item.taxRate);
    if (!taxGroups[rate]) taxGroups[rate] = { basis: 0, tax: 0 };
    taxGroups[rate].basis += Number(item.netAmount);
    taxGroups[rate].tax += Number(item.taxAmount);
  }

  const vatBreakdown = isKleinunternehmer
    ? [
        {
          calculatedAmount: 0,
          typeCode: "VAT",
          basisAmount: netTotal,
          categoryCode: "E" as const,
          rateApplicablePercent: 0,
          exemptionReasonText: "Steuerbefreiung gemäß §19 Abs. 1 UStG",
        },
      ]
    : Object.entries(taxGroups).map(([rate, { basis, tax }]) => ({
        calculatedAmount: tax,
        typeCode: "VAT",
        basisAmount: basis,
        categoryCode: "S" as const,
        rateApplicablePercent: Number(rate),
      }));

  const lines = invoice.items.map((item) => ({
    tradeProduct: { name: item.description },
    tradeDelivery: {
      billedQuantity: {
        amount: Number(item.quantity),
        unitMeasureCode: toUnitCode(item.unit),
      },
    },
    tradeAgreement: {
      netTradePrice: { chargeAmount: Number(item.unitPrice) },
    },
    tradeSettlement: {
      tradeTax: {
        typeCode: "VAT",
        categoryCode: (isKleinunternehmer ? "E" : "S") as "E" | "S",
        rateApplicablePercent: isKleinunternehmer ? 0 : Number(item.taxRate),
      },
      monetarySummation: { lineTotalAmount: Number(item.netAmount) },
    },
  }));

  const doc = z.create({
    number: invoice.number ?? invoice.id,
    typeCode: "380",
    issueDate: invoice.issueDate,
    transaction: {
      tradeAgreement: {
        seller: {
          name: invoice.company.name,
          postalAddress: {
            ...(invoice.company.zip ? { postCode: invoice.company.zip } : {}),
            ...(invoice.company.address ? { line1: invoice.company.address } : {}),
            ...(invoice.company.city ? { city: invoice.company.city } : {}),
            countryCode: "DE",
          },
          taxRegistration: {
            ...(invoice.company.vatId ? { vatIdentifier: invoice.company.vatId } : {}),
            ...(invoice.company.taxId ? { localIdentifier: invoice.company.taxId } : {}),
          },
        },
        buyer: {
          name: invoice.customer.name,
          postalAddress: {
            ...(invoice.customer.zip ? { postCode: invoice.customer.zip } : {}),
            ...(invoice.customer.address ? { line1: invoice.customer.address } : {}),
            ...(invoice.customer.city ? { city: invoice.customer.city } : {}),
            countryCode: "DE",
          },
        },
      },
      tradeDelivery: {
        ...(invoice.deliveryDate
          ? { information: { deliveryDate: invoice.deliveryDate } }
          : {}),
      },
      tradeSettlement: {
        currencyCode: "EUR",
        paymentTerms: { dueDate: invoice.dueDate },
        vatBreakdown,
        monetarySummation: {
          lineTotalAmount: netTotal,
          taxBasisTotalAmount: netTotal,
          taxTotal: { amount: taxTotal, currencyCode: "EUR" as const },
          grandTotalAmount: grossTotal,
          duePayableAmount: grossTotal,
        },
      },
      line: lines,
    },
  });

  const xml = await doc.toXML();

  return new Response(xml as string, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="rechnung-${invoice.number ?? invoice.id}.xml"`,
    },
  });
}
