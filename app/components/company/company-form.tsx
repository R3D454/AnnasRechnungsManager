import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  legalForm: z.string().optional(),
  taxId: z.string().optional(),
  vatId: z.string().optional(),
  address: z.string().min(1, "Adresse ist erforderlich"),
  zip: z.string().min(1, "PLZ ist erforderlich"),
  city: z.string().min(1, "Ort ist erforderlich"),
  country: z.string().optional(),
  email: z.string().email("Ungültige E-Mail").optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
  bankName: z.string().optional(),
  invoicePrefix: z.string().optional(),
  kleinunternehmer: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface CompanyFormProps {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => Promise<void>;
  submitLabel?: string;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function CompanyForm({ defaultValues, onSubmit, submitLabel = "Speichern" }: CompanyFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "DE", invoicePrefix: "RE", kleinunternehmer: false, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Stammdaten</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Firmenname *" error={errors.name?.message}>
            <Input {...register("name")} placeholder="Muster GmbH" />
          </Field>
          <Field label="Rechtsform" error={errors.legalForm?.message}>
            <Input {...register("legalForm")} placeholder="GmbH, AG, UG..." />
          </Field>
          <Field label="Steuernummer" error={errors.taxId?.message}>
            <Input {...register("taxId")} placeholder="123/456/78901" />
          </Field>
          <Field label="USt-IdNr." error={errors.vatId?.message}>
            <Input {...register("vatId")} placeholder="DE123456789" />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Anschrift</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Straße & Hausnummer *" error={errors.address?.message}>
              <Input {...register("address")} placeholder="Musterstraße 1" />
            </Field>
          </div>
          <Field label="PLZ *" error={errors.zip?.message}>
            <Input {...register("zip")} placeholder="10115" />
          </Field>
          <Field label="Ort *" error={errors.city?.message}>
            <Input {...register("city")} placeholder="Berlin" />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Kontakt</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="E-Mail" error={errors.email?.message}>
            <Input {...register("email")} type="email" placeholder="info@firma.de" />
          </Field>
          <Field label="Telefon" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="+49 30 12345678" />
          </Field>
          <Field label="Website" error={errors.website?.message}>
            <Input {...register("website")} placeholder="https://firma.de" />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Bankverbindung</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="IBAN" error={errors.bankIban?.message}>
              <Input {...register("bankIban")} placeholder="DE89 3704 0044 0532 0130 00" />
            </Field>
          </div>
          <Field label="BIC" error={errors.bankBic?.message}>
            <Input {...register("bankBic")} placeholder="COBADEFFXXX" />
          </Field>
          <Field label="Kreditinstitut" error={errors.bankName?.message}>
            <Input {...register("bankName")} placeholder="Commerzbank" />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Rechnungseinstellungen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Rechnungsnummern-Präfix" error={errors.invoicePrefix?.message}>
            <Input {...register("invoicePrefix")} placeholder="RE" />
          </Field>
        </div>
        <p className="text-xs text-gray-500 mt-1">Format: {"{Präfix}"}-{"{Jahr}"}-{"{Nummer}"} z.B. RE-2024-001</p>
        <div className="mt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              {...register("kleinunternehmer")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Kleinunternehmer (§19 UStG) — keine Umsatzsteuer
            </span>
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Speichern..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
