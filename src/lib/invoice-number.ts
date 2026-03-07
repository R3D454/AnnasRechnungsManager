import prisma from "./prisma";

export async function generateInvoiceNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();

  // Atomically increment the sequence number
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { invoiceSequence: { increment: 1 } },
    select: { invoicePrefix: true, invoiceSequence: true },
  });

  const seq = String(company.invoiceSequence).padStart(3, "0");
  return `${company.invoicePrefix}-${year}-${seq}`;
}
