export type { Company, Customer, Invoice, InvoiceItem, User, InvoiceStatus } from "@prisma/client";

export interface InvoiceItemInput {
  id?: string;
  position: number;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  taxRate: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface InvoiceFormData {
  customerId: string;
  issueDate: string;
  deliveryDate?: string;
  dueDate: string;
  notes?: string;
  items: InvoiceItemInput[];
}

export interface CompanyFormData {
  name: string;
  legalForm?: string;
  taxId?: string;
  vatId?: string;
  address: string;
  zip: string;
  city: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  bankIban?: string;
  bankBic?: string;
  bankName?: string;
  invoicePrefix?: string;
}

export interface CustomerFormData {
  name: string;
  vatId?: string;
  taxId?: string;
  address: string;
  zip: string;
  city: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface TaxGroupSummary {
  taxRate: number;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface PeriodReport {
  period: string;
  invoiceCount: number;
  netTotal: number;
  taxTotal: number;
  grossTotal: number;
  taxGroups: TaxGroupSummary[];
}
