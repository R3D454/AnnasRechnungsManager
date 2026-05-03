import { z } from "zod";
import { InvoiceStatus } from "@prisma/client";

// ===== Reusable validators =====

/**
 * Validates that a decimal string has at most 2 decimal places
 * (required for currency/money fields in MySQL DECIMAL(10,2))
 */
export const currencySchema = z
  .number()
  .nonnegative("Geldbeträge dürfen nicht negativ sein")
  .refine(
    (n) => {
      const decimal = n.toString().split(".")[1];
      return !decimal || decimal.length <= 2;
    },
    "Geldbeträge dürfen maximal 2 Dezimalstellen haben"
  );

/**
 * Tax rate must be one of the valid German VAT rates
 */
export const taxRateSchema = z
  .number()
  .int("Steuersatz muss eine ganze Zahl sein")
  .refine(
    (r) => [0, 7, 19].includes(r),
    "Steuersatz muss 0 (steuerfrei), 7 (ermäßigt) oder 19 (Standard) sein"
  );

/**
 * IBAN validation: 15-34 characters, starts with 2 letters + 2 digits
 */
export const ibanSchema = z
  .string()
  .refine(
    (iban) => iban === "" || /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban),
    "Ungültige IBAN"
  );

/**
 * German tax ID (Steuernummer): 10 digits
 */
export const taxIdSchema = z
  .string()
  .refine(
    (val) => val === "" || /^\d{10}$/.test(val),
    "Steuernummer muss 10 Ziffern haben"
  );

/**
 * VAT ID (Umsatzsteuer-IdNr): DE + 9 digits
 */
export const vatIdSchema = z
  .string()
  .refine(
    (val) => val === "" || /^DE\d{9}$/.test(val),
    "USt-IdNr. muss im Format DE + 9 Ziffern sein"
  );

// ===== Invoice Schemas =====

export const invoiceItemSchema = z.object({
  position: z
    .number()
    .int("Position muss eine ganze Zahl sein")
    .positive("Position muss größer als 0 sein"),
  description: z
    .string()
    .min(1, "Beschreibung erforderlich")
    .max(500, "Beschreibung darf maximal 500 Zeichen sein"),
  quantity: z
    .number()
    .positive("Menge muss größer als 0 sein")
    .refine(
      (q) => {
        const decimal = q.toString().split(".")[1];
        return !decimal || decimal.length <= 3;
      },
      "Menge darf maximal 3 Dezimalstellen haben"
    ),
  unit: z
    .string()
    .max(50, "Einheit darf maximal 50 Zeichen sein")
    .optional(),
  unitPrice: currencySchema,
  taxRate: taxRateSchema,
  netAmount: currencySchema,
  taxAmount: currencySchema,
  grossAmount: currencySchema,
});

export const invoiceSchema = z.object({
  companyId: z.string().min(1, "Mandant erforderlich"),
  customerId: z.string().min(1, "Kunde erforderlich"),
  issueDate: z
    .string()
    .refine(
      (d) => !isNaN(Date.parse(d)),
      "Ungültiges Datum"
    ),
  deliveryDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), "Ungültiges Datum")
    .optional(),
  dueDate: z
    .string()
    .refine((d) => !isNaN(Date.parse(d)), "Ungültiges Datum"),
  notes: z
    .string()
    .max(5000, "Notizen darf maximal 5000 Zeichen sein")
    .optional(),
  kleinunternehmer: z.boolean().optional().default(false),
  items: z
    .array(invoiceItemSchema)
    .min(1, "Mindestens ein Rechnungsposition erforderlich"),
  netTotal: currencySchema,
  taxTotal: currencySchema,
  grossTotal: currencySchema,
});

export const invoiceUpdateSchema = invoiceSchema.omit({ companyId: true });

export const invoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});

// ===== Company Schemas =====

export const companySchema = z.object({
  name: z
    .string()
    .min(1, "Firmenname erforderlich")
    .max(255, "Firmenname darf maximal 255 Zeichen sein"),
  legalForm: z
    .string()
    .max(100, "Rechtsform darf maximal 100 Zeichen sein")
    .optional(),
  taxId: taxIdSchema.nullable(),
  vatId: vatIdSchema.nullable(),
  address: z
    .string()
    .min(1, "Adresse erforderlich")
    .max(500, "Adresse darf maximal 500 Zeichen sein"),
  zip: z
    .string()
    .min(1, "PLZ erforderlich")
    .max(20, "PLZ darf maximal 20 Zeichen sein")
    .regex(/^[\d\s-]*$/, "PLZ darf nur Zahlen, Bindestriche und Leerzeichen enthalten"),
  city: z
    .string()
    .min(1, "Stadt erforderlich")
    .max(100, "Stadt darf maximal 100 Zeichen sein"),
  country: z
    .string()
    .max(2, "Ländercode darf maximal 2 Zeichen sein")
    .optional()
    .default("DE"),
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Telefonnummer darf maximal 20 Zeichen sein")
    .optional(),
  website: z
    .string()
    .refine(
      (val) => val === "" || /^https?:\/\//.test(val),
      "Website muss mit http:// oder https:// beginnen"
    )
    .max(255, "Website darf maximal 255 Zeichen sein")
    .optional()
    .or(z.literal("")),
  bankIban: ibanSchema.nullable(),
  bankBic: z
    .string()
    .refine(
      (val) => val === "" || /^[A-Z0-9]{8,11}$/.test(val),
      "Ungültiger BIC"
    )
    .optional()
    .or(z.literal("")),
  bankName: z
    .string()
    .max(255, "Bankname darf maximal 255 Zeichen sein")
    .optional(),
  invoicePrefix: z
    .string()
    .max(10, "Rechnungsprefix darf maximal 10 Zeichen sein")
    .optional()
    .default("RE"),
  kleinunternehmer: z.boolean().optional().default(false),
});

export const companyUpdateSchema = companySchema;

// ===== Customer Schemas =====

export const customerSchema = z.object({
  companyId: z.string().min(1, "Mandant erforderlich"),
  name: z
    .string()
    .min(1, "Kundenname erforderlich")
    .max(255, "Kundenname darf maximal 255 Zeichen sein"),
  taxId: taxIdSchema.optional(),
  address: z
    .string()
    .min(1, "Adresse erforderlich")
    .max(500, "Adresse darf maximal 500 Zeichen sein"),
  zip: z
    .string()
    .min(1, "PLZ erforderlich")
    .max(20, "PLZ darf maximal 20 Zeichen sein")
    .regex(/^[\d\s-]*$/, "PLZ darf nur Zahlen, Bindestriche und Leerzeichen enthalten"),
  city: z
    .string()
    .min(1, "Stadt erforderlich")
    .max(100, "Stadt darf maximal 100 Zeichen sein"),
  country: z
    .string()
    .max(2, "Ländercode darf maximal 2 Zeichen sein")
    .optional()
    .default("DE"),
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Telefonnummer darf maximal 20 Zeichen sein")
    .optional(),
});

export const customerUpdateSchema = customerSchema.omit({ companyId: true });
