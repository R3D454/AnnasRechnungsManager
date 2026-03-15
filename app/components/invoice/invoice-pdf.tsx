import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
    paddingTop: 50,
    paddingBottom: 60,
    paddingLeft: 55,
    paddingRight: 55,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1e1b4b",
    marginBottom: 3,
  },
  companyInfo: {
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.5,
  },
  invoiceTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#1e1b4b",
    marginBottom: 20,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 0,
    marginBottom: 20,
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 4,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  addressSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  addressBlock: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 7,
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  addressName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 8.5,
    color: "#374151",
    lineHeight: 1.4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e1b4b",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 0,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 0.5,
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  col_pos: { width: "5%" },
  col_desc: { width: "40%" },
  col_qty: { width: "10%", textAlign: "right" },
  col_price: { width: "22%", textAlign: "right" },
  col_tax: { width: "8%", textAlign: "center" },
  col_total: { width: "15%", textAlign: "right" },
  totalsSection: {
    marginTop: 15,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsTable: {
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 9,
    color: "#6b7280",
  },
  totalsValue: {
    fontSize: 9,
    color: "#374151",
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTopColor: "#1e1b4b",
    borderTopWidth: 1.5,
    marginTop: 3,
  },
  totalsFinalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1e1b4b",
  },
  totalsFinalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1e1b4b",
  },
  notes: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 7,
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8.5,
    color: "#374151",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 55,
    right: 55,
    borderTopColor: "#e5e7eb",
    borderTopWidth: 0.5,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
});

function formatMoney(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("de-DE").format(new Date(date));
}

interface InvoicePDFProps {
  invoice: {
    number: string | null;
    issueDate: Date | string;
    deliveryDate?: Date | string | null;
    dueDate: Date | string;
    notes?: string | null;
    kleinunternehmer?: boolean;
    netTotal: number | string | { toString(): string };
    taxTotal: number | string | { toString(): string };
    grossTotal: number | string | { toString(): string };
    company: {
      name: string;
      legalForm?: string | null;
      taxId?: string | null;
      vatId?: string | null;
      address: string;
      zip: string;
      city: string;
      email?: string | null;
      phone?: string | null;
      bankIban?: string | null;
      bankBic?: string | null;
      bankName?: string | null;
    };
    customer: {
      name: string;
      address: string;
      zip: string;
      city: string;
      country: string;
    };
    items: Array<{
      position: number;
      description: string;
      quantity: number | string | { toString(): string };
      unit?: string | null;
      unitPrice: number | string | { toString(): string };
      taxRate: number | string | { toString(): string };
      netAmount: number | string | { toString(): string };
      taxAmount: number | string | { toString(): string };
      grossAmount: number | string | { toString(): string };
    }>;
  };
}

export function InvoicePDFDocument({ invoice }: InvoicePDFProps) {
  const n = (v: unknown) => Number(v);

  const taxGroups = invoice.items.reduce(
    (acc, item) => {
      const rate = n(item.taxRate);
      if (!acc[rate]) acc[rate] = { net: 0, tax: 0 };
      acc[rate].net += n(item.netAmount);
      acc[rate].tax += n(item.taxAmount);
      return acc;
    },
    {} as Record<number, { net: number; tax: number }>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{invoice.company.name}</Text>
            {invoice.company.legalForm && (
              <Text style={styles.companyInfo}>{invoice.company.legalForm}</Text>
            )}
            <Text style={styles.companyInfo}>{invoice.company.address}</Text>
            <Text style={styles.companyInfo}>{invoice.company.zip} {invoice.company.city}</Text>
            {invoice.company.email && (
              <Text style={styles.companyInfo}>{invoice.company.email}</Text>
            )}
            {invoice.company.phone && (
              <Text style={styles.companyInfo}>{invoice.company.phone}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {invoice.company.taxId && (
              <Text style={styles.companyInfo}>St.-Nr.: {invoice.company.taxId}</Text>
            )}
            {invoice.company.vatId && (
              <Text style={styles.companyInfo}>USt-IdNr.: {invoice.company.vatId}</Text>
            )}
          </View>
        </View>

        <Text style={styles.invoiceTitle}>Rechnung</Text>

        <View style={styles.addressSection}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Rechnungsempfänger</Text>
            <Text style={styles.addressName}>{invoice.customer.name}</Text>
            <Text style={styles.addressLine}>{invoice.customer.address}</Text>
            <Text style={styles.addressLine}>{invoice.customer.zip} {invoice.customer.city}</Text>
            {invoice.customer.country !== "DE" && (
              <Text style={styles.addressLine}>{invoice.customer.country}</Text>
            )}
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Rechnungsnummer</Text>
            <Text style={styles.metaValue}>{invoice.number ?? "-"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Rechnungsdatum</Text>
            <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
          </View>
          {invoice.deliveryDate && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Leistungsdatum</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.deliveryDate)}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Fällig am</Text>
            <Text style={styles.metaValue}>{formatDate(invoice.dueDate)}</Text>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <Text style={{ ...styles.tableHeaderText, ...styles.col_pos }}>#</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.col_desc }}>Beschreibung</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.col_qty }}>Menge</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.col_price }}>
            {invoice.kleinunternehmer ? "EP (brutto)" : "EP (netto)"}
          </Text>
          {!invoice.kleinunternehmer && (
            <Text style={{ ...styles.tableHeaderText, ...styles.col_tax }}>MwSt.</Text>
          )}
          <Text style={{ ...styles.tableHeaderText, ...styles.col_total }}>Gesamt</Text>
        </View>

        {invoice.items.map((item, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={{ ...styles.col_pos, fontSize: 9 }}>{item.position}</Text>
            <Text style={{ ...styles.col_desc, fontSize: 9 }}>{item.description}</Text>
            <Text style={{ ...styles.col_qty, fontSize: 9 }}>{n(item.quantity)}</Text>
            <Text style={{ ...styles.col_price, fontSize: 9 }}>{formatMoney(n(item.unitPrice))}</Text>
            {!invoice.kleinunternehmer && (
              <Text style={{ ...styles.col_tax, fontSize: 9 }}>{n(item.taxRate)}%</Text>
            )}
            <Text style={{ ...styles.col_total, fontSize: 9, fontFamily: "Helvetica-Bold" }}>
              {formatMoney(n(item.grossAmount))}
            </Text>
          </View>
        ))}

        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            {invoice.kleinunternehmer ? (
              <>
                <View style={styles.totalsFinalRow}>
                  <Text style={styles.totalsFinalLabel}>Gesamtbetrag</Text>
                  <Text style={styles.totalsFinalValue}>{formatMoney(n(invoice.grossTotal))}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={{ ...styles.totalsLabel, fontSize: 8, fontStyle: "italic" }}>
                    Dieser Rechnungsbetrag enthält nach §19 Abs. 1 UStG keine USt.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Nettobetrag</Text>
                  <Text style={styles.totalsValue}>{formatMoney(n(invoice.netTotal))}</Text>
                </View>
                {Object.entries(taxGroups).map(([rate, { net, tax }]) => (
                  <View key={rate} style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>MwSt. {rate}% auf {formatMoney(net)}</Text>
                    <Text style={styles.totalsValue}>{formatMoney(tax)}</Text>
                  </View>
                ))}
                <View style={styles.totalsFinalRow}>
                  <Text style={styles.totalsFinalLabel}>Gesamtbetrag (inkl. MwSt.)</Text>
                  <Text style={styles.totalsFinalValue}>{formatMoney(n(invoice.grossTotal))}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Hinweise</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {invoice.company.name}
            {invoice.company.taxId ? ` · St.-Nr.: ${invoice.company.taxId}` : ""}
            {invoice.company.vatId ? ` · USt-IdNr.: ${invoice.company.vatId}` : ""}
          </Text>
          {invoice.company.bankIban && (
            <Text style={styles.footerText}>
              {invoice.company.bankName ? `${invoice.company.bankName} · ` : ""}
              IBAN: {invoice.company.bankIban}
              {invoice.company.bankBic ? ` · BIC: ${invoice.company.bankBic}` : ""}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
