export const TAX_RATES = [
  { label: "19% MwSt. (Regelsteuersatz)", value: 19 },
  { label: "7% MwSt. (ermäßigt)", value: 7 },
  { label: "0% (steuerfrei / §13b UStG)", value: 0 },
] as const;

export function calcItemAmounts(
  quantity: number,
  unitPrice: number,
  taxRate: number
) {
  const netAmount = Math.round(quantity * unitPrice * 100) / 100;
  const taxAmount = Math.round(netAmount * (taxRate / 100) * 100) / 100;
  const grossAmount = Math.round((netAmount + taxAmount) * 100) / 100;
  return { netAmount, taxAmount, grossAmount };
}

export function calcInvoiceTotals(
  items: Array<{ netAmount: number; taxAmount: number; grossAmount: number }>
) {
  const netTotal = items.reduce((sum, i) => sum + i.netAmount, 0);
  const taxTotal = items.reduce((sum, i) => sum + i.taxAmount, 0);
  const grossTotal = items.reduce((sum, i) => sum + i.grossAmount, 0);
  return {
    netTotal: Math.round(netTotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    grossTotal: Math.round(grossTotal * 100) / 100,
  };
}

export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(amount));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("de-DE").format(new Date(date));
}
