import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { debugLog, handleApiError } from "@/lib/client-validation";
import { useState, useEffect } from "react";

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

function Field({ 
  label, 
  error, 
  tooltip, 
  required = false,
  children 
}: { 
  label: string; 
  error?: string; 
  tooltip?: string;
  required?: boolean;
  children: React.ReactNode 
}) {
  const [showRequiredTooltip, setShowRequiredTooltip] = useState(false);

  // Debug: log errors to console
  if (error) {
    console.log(`[Field Error] ${label}: ${error}`);
  }
  
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1">
        {label}
        {required && (
          <span className="inline-flex items-center group relative">
            <span className="text-red-500 font-bold text-lg leading-none">*</span>
            <div 
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-red-600 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            >
              Erforderliches Feld
            </div>
          </span>
        )}
      </Label>
      <div className="relative">
        <div className={required && !error ? "relative" : ""}>
          {children}
        </div>
        {/* Show error tooltip ONLY when there's an error */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex gap-2">
            <svg className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">{error}</p>
              {tooltip && <p className="text-red-600 mt-0.5">{tooltip}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CompanyForm({ defaultValues, onSubmit, submitLabel = "Speichern" }: CompanyFormProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting, isValid }, watch, trigger } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur", // Validate when user leaves field
    defaultValues: { country: "DE", invoicePrefix: "RE", kleinunternehmer: false, ...defaultValues },
  });

  // Debug: log all errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log("[Form Errors]", errors);
    }
  }, [errors]);

  // Watch form data for debug logging
  const formData = watch();

  const handleFormSubmit = async (data: FormData) => {
    // Trigger validation to check if form is actually valid
    const isFormValid = await trigger();
    
    if (!isFormValid) {
      // Build error message from validation errors
      const errorFields: string[] = [];
      
      if (errors.name) errorFields.push("Firmenname");
      if (errors.address) errorFields.push("Adresse");
      if (errors.zip) errorFields.push("Postleitzahl");
      if (errors.city) errorFields.push("Ort/Stadt");
      if (errors.email) errorFields.push("E-Mail");
      if (errors.taxId) errorFields.push("Steuernummer");
      if (errors.vatId) errorFields.push("USt-IdNr.");
      if (errors.bankIban) errorFields.push("IBAN");
      if (errors.bankBic) errorFields.push("BIC");
      
      const fieldList = errorFields.length > 0 
        ? errorFields.join(", ")
        : "Bitte überprüfen Sie die rot gekennzeichneten Felder";
      
      const message = `Folgende Felder sind erforderlich oder falsch: ${fieldList}`;
      setValidationError(message);
      debugLog("warning", "Form validation failed", { errors: errorFields });
      return;
    }
    
    try {
      setApiError(null);
      setValidationError(null);
      debugLog("info", "Submitting form", data);
      
      await onSubmit(data);
      
      debugLog("success", "Form submitted successfully");
    } catch (error) {
      debugLog("error", "Form submission failed", error);
      handleApiError(error, "/api/companies");
      
      // Extract error message for user
      if (error instanceof Response) {
        try {
          const json = await error.clone().json();
          const messages = json.error?.map?.((e: any) => e.message)?.join(", ") || 
                          json.message ||
                          "Ein Fehler ist aufgetreten";
          setApiError(messages);
        } catch {
          setApiError(`HTTP ${error.status}: ${error.statusText}`);
        }
      } else if (error instanceof Error) {
        setApiError(error.message);
      } else {
        setApiError("Ein unbekannter Fehler ist aufgetreten");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Required fields info banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm font-medium text-blue-900">ℹ️ Erforderliche Felder</p>
        <p className="text-sm text-blue-800 mt-1">Folgende Felder sind erforderlich: <strong>Firmenname, Adresse, Postleitzahl, Ort</strong></p>
      </div>

      {/* Validation error banner */}
      {validationError && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-900">⚠️ Eingabefehler</p>
            <p className="text-sm text-yellow-800 mt-1">{validationError}</p>
          </div>
        )}

        {/* API error banner */}
        {apiError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800">❌ Fehler</p>
            <p className="text-sm text-red-700 mt-1">{apiError}</p>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Stammdaten</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field 
              label="Firmenname" 
              required={true}
              error={errors.name?.message}
              tooltip="Name des Unternehmens oder der Geschäftseinheit"
            >
              <Input {...register("name")} placeholder="Muster GmbH" />
            </Field>
            <Field 
              label="Rechtsform" 
              error={errors.legalForm?.message}
              tooltip="z.B. GmbH, AG, UG, Einzelunternehmen"
            >
              <Input {...register("legalForm")} placeholder="GmbH, AG, UG..." />
            </Field>
            <Field 
              label="Steuernummer" 
              error={errors.taxId?.message}
              tooltip="10-stellige deutsche Steuernummer (z.B. 123/456/78901)"
            >
              <Input {...register("taxId")} placeholder="123/456/78901" />
            </Field>
            <Field 
              label="USt-IdNr." 
              error={errors.vatId?.message}
              tooltip="Umsatzsteuer-Identifikationsnummer (z.B. DE123456789)"
            >
              <Input {...register("vatId")} placeholder="DE123456789" />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Anschrift</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field 
                label="Straße & Hausnummer" 
                required={true}
                error={errors.address?.message}
                tooltip="Vollständige Adresse mit Straße und Hausnummer"
              >
                <Input {...register("address")} placeholder="Musterstraße 1" />
              </Field>
            </div>
            <Field 
              label="PLZ" 
              required={true}
              error={errors.zip?.message}
              tooltip="Deutsche Postleitzahl (5-stellig)"
            >
              <Input {...register("zip")} placeholder="10115" />
            </Field>
            <Field 
              label="Ort" 
              required={true}
              error={errors.city?.message}
              tooltip="Stadt oder Gemeinde"
            >
            <Input {...register("city")} placeholder="Berlin" />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Kontakt</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field 
              label="E-Mail" 
              error={errors.email?.message}
              tooltip="Kontakt-E-Mail-Adresse (optional)"
            >
              <Input {...register("email")} type="email" placeholder="info@firma.de" />
            </Field>
            <Field 
              label="Telefon" 
              error={errors.phone?.message}
              tooltip="Telefonnummer mit Landesvorwahl (optional)"
            >
              <Input {...register("phone")} placeholder="+49 30 12345678" />
            </Field>
            <Field 
              label="Website" 
              error={errors.website?.message}
              tooltip="URL der Unternehmenswebseite (optional)"
            >
              <Input {...register("website")} placeholder="https://firma.de" />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Bankverbindung</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field 
                label="IBAN" 
                error={errors.bankIban?.message}
                tooltip="Internationale Kontonummer (z.B. DE89 3704 0044...) (optional)"
              >
                <Input {...register("bankIban")} placeholder="DE89 3704 0044 0532 0130 00" />
              </Field>
            </div>
            <Field 
              label="BIC" 
              error={errors.bankBic?.message}
              tooltip="Bank Identifier Code (z.B. COBADEFFXXX) (optional)"
            >
              <Input {...register("bankBic")} placeholder="COBADEFFXXX" />
            </Field>
            <Field 
              label="Kreditinstitut" 
              error={errors.bankName?.message}
              tooltip="Name der Bank (optional)"
            >
              <Input {...register("bankName")} placeholder="Commerzbank" />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Rechnungseinstellungen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field 
              label="Rechnungsnummern-Präfix" 
              error={errors.invoicePrefix?.message}
              tooltip="Präfix für Rechnungsnummern (z.B. RE oder INV)"
            >
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

        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting || !isValid}>
            {isSubmitting ? "Speichern..." : submitLabel}
          </Button>
        </div>
      </form>
  );
}
