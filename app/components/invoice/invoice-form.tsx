import { useState, useCallback } from "react";
import { useRevalidator } from "react-router";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcItemAmounts, calcItemAmountsKleinunternehmer, calcInvoiceTotals, formatCurrency, TAX_RATES } from "@/lib/tax";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Customer {
  id: string;
  name: string;
}

interface ItemFormData {
  position: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

interface InvoiceFormValues {
  customerId: string;
  issueDate: string;
  deliveryDate: string;
  dueDate: string;
  notes: string;
  items: ItemFormData[];
}

interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPrice: number;
  taxRate: number;
}

interface InvoiceFormProps {
  customers: Customer[];
  companyId: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  defaultValues?: Partial<InvoiceFormValues>;
  defaultKleinunternehmer?: boolean;
  submitLabel?: string;
  services?: ServiceOption[];
}

const defaultItem = (): ItemFormData => ({
  position: 1,
  description: "",
  quantity: "1",
  unit: "Stück",
  unitPrice: "0.00",
  taxRate: "19",
  netAmount: 0,
  taxAmount: 0,
  grossAmount: 0,
});

/**
 * A form for creating an invoice.
 *
 * @param {Object} props
 * @param {Customer[]} customers - List of customers
 * @param {string} companyId - Company ID
 * @param {(data: Record<string, unknown>) => Promise<void>} onSubmit - Callback for form submission
 * @param {Partial<InvoiceFormValues>} defaultValues - Default values for the form
 * @param {boolean} defaultKleinunternehmer - Whether to use Kleinunternehmer (§19 UStG) by default
 * @param {string} submitLabel - Label for the submit button
 * @param {ServiceOption[]} services - List of services that can be added to the invoice
 */
export function InvoiceForm({ customers, companyId, onSubmit, defaultValues, defaultKleinunternehmer = false, submitLabel = "Rechnung erstellen", services = [] }: InvoiceFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const dueDefault = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [kleinunternehmer, setKleinunternehmer] = useState(defaultKleinunternehmer);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const { revalidate } = useRevalidator();

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<InvoiceFormValues>({
    defaultValues: {
      customerId: defaultValues?.customerId ?? "",
      issueDate: defaultValues?.issueDate ?? today,
      deliveryDate: defaultValues?.deliveryDate ?? today,
      dueDate: defaultValues?.dueDate ?? dueDefault,
      notes: defaultValues?.notes ?? "",
      items: defaultValues?.items ?? [defaultItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  const recalcItem = useCallback((index: number) => {
    const item = watchedItems[index];
    if (!item) return;
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    if (kleinunternehmer) {
      const { netAmount, taxAmount, grossAmount } = calcItemAmountsKleinunternehmer(qty, price);
      setValue(`items.${index}.netAmount`, netAmount);
      setValue(`items.${index}.taxAmount`, taxAmount);
      setValue(`items.${index}.grossAmount`, grossAmount);
    } else {
      const rate = parseFloat(item.taxRate) || 0;
      const { netAmount, taxAmount, grossAmount } = calcItemAmounts(qty, price, rate);
      setValue(`items.${index}.netAmount`, netAmount);
      setValue(`items.${index}.taxAmount`, taxAmount);
      setValue(`items.${index}.grossAmount`, grossAmount);
    }
  }, [watchedItems, setValue, kleinunternehmer]);

  const totals = calcInvoiceTotals(
    watchedItems.map((item) => ({
      netAmount: item.netAmount ?? 0,
      taxAmount: item.taxAmount ?? 0,
      grossAmount: item.grossAmount ?? 0,
    }))
  );

/**
 * Handles form submission by processing the items and calculating the totals.
 *
 * If Kleinunternehmer are enabled, the tax rate for each item is set to 0.
 *
 * If the item does not have a description, the tax rate is set to 0.
 *
 * The function then saves the new services created and revalidates the form if necessary.
 *
 * Finally, the function calls the onSubmit callback with the processed data.
 */
  async function handleFormSubmit(data: InvoiceFormValues) {
    const items = data.items.map((item, i) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      if (kleinunternehmer) {
        const { netAmount, taxAmount, grossAmount } = calcItemAmountsKleinunternehmer(qty, price);
        return {
          position: i + 1,
          description: item.description,
          quantity: qty,
          unit: item.unit || undefined,
          unitPrice: price,
          taxRate: 0,
          netAmount,
          taxAmount,
          grossAmount,
        };
      }
      const rate = parseFloat(item.taxRate) || 0;
      const { netAmount, taxAmount, grossAmount } = calcItemAmounts(qty, price, rate);
      return {
        position: i + 1,
        description: item.description,
        quantity: qty,
        unit: item.unit || undefined,
        unitPrice: price,
        taxRate: rate,
        netAmount,
        taxAmount,
        grossAmount,
      };
    });

    const totals = calcInvoiceTotals(items);

    // Neue Leistungen automatisch speichern
    const newServices = items.filter((item) =>
      item.description.trim() &&
      !services.some(
        (s) => s.name.toLowerCase() === item.description.trim().toLowerCase() ||
               (s.description ?? "").toLowerCase() === item.description.trim().toLowerCase()
      )
    );
    await Promise.all(
      newServices.map((item) =>
        fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            name: item.description.trim(),
            unit: item.unit || undefined,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
          }),
        })
      )
    );
    if (newServices.length > 0) revalidate();

    await onSubmit({
      companyId,
      customerId: data.customerId,
      issueDate: data.issueDate,
      deliveryDate: data.deliveryDate || undefined,
      dueDate: data.dueDate,
      notes: data.notes || undefined,
      kleinunternehmer,
      items,
      ...totals,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Kunde *</Label>
          <Select defaultValue={defaultValues?.customerId} onValueChange={(v) => setValue("customerId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Kunde auswählen..." />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.customerId && <p className="text-xs text-red-600">Pflichtfeld</p>}
        </div>

        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={kleinunternehmer}
              onChange={(e) => {
                setKleinunternehmer(e.target.checked);
                watchedItems.forEach((_, i) => recalcItem(i));
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Kleinunternehmer (§19 UStG) — keine Umsatzsteuer
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Rechnungsdatum *</Label>
          <Input type="date" {...register("issueDate", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Leistungsdatum</Label>
          <Input type="date" {...register("deliveryDate")} />
        </div>
        <div className="space-y-1.5">
          <Label>Fällig am *</Label>
          <Input type="date" {...register("dueDate", { required: true })} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rechnungspositionen</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(defaultItem())}
          >
            <Plus className="h-3.5 w-3.5" /> Position hinzufügen
          </Button>
        </div>

        <div className="border border-gray-200 rounded-xl">
          <div className={`grid gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-600 rounded-t-xl ${kleinunternehmer ? "grid-cols-11" : "grid-cols-12"}`}>
            <div className="col-span-4">Beschreibung</div>
            <div className="col-span-1">Menge</div>
            <div className="col-span-1">Einh.</div>
            <div className="col-span-2">{kleinunternehmer ? "Einzelpreis (brutto)" : "Einzelpreis"}</div>
            {!kleinunternehmer && <div className="col-span-1">MwSt.</div>}
            <div className="col-span-2 text-right">Gesamt (brutto)</div>
            <div className="col-span-1"></div>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className={`grid gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 items-center ${kleinunternehmer ? "grid-cols-11" : "grid-cols-12"}`}>
              <div className="col-span-4 relative">
                {(() => {
                  const descValue = watchedItems[index]?.description ?? "";
                  const filtered = services.filter((s) =>
                    descValue.length === 0 ||
                    s.name.toLowerCase().includes(descValue.toLowerCase()) ||
                    (s.description ?? "").toLowerCase().includes(descValue.toLowerCase())
                  );
                  return (
                    <>
                      <Input
                        value={descValue}
                        onChange={(e) => setValue(`items.${index}.description`, e.target.value)}
                        onFocus={() => setOpenDropdown(index)}
                        onBlur={() => setOpenDropdown(null)}
                        placeholder="Leistungsbeschreibung"
                        className="text-sm"
                        autoComplete="off"
                      />
                      {openDropdown === index && services.length > 0 && filtered.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {filtered.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-col"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setValue(`items.${index}.description`, s.description ?? s.name);
                                setValue(`items.${index}.unit`, s.unit ?? "Stück");
                                setValue(`items.${index}.unitPrice`, String(s.unitPrice));
                                setValue(`items.${index}.taxRate`, String(s.taxRate));
                                setOpenDropdown(null);
                                setTimeout(() => recalcItem(index), 0);
                              }}
                            >
                              <span className="font-medium text-gray-800">{s.name}</span>
                              {s.description && <span className="text-xs text-gray-400 truncate">{s.description}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="col-span-1">
                <Input
                  {...register(`items.${index}.quantity`)}
                  className="text-sm text-right"
                  onBlur={() => recalcItem(index)}
                />
              </div>
              <div className="col-span-1">
                <Input
                  {...register(`items.${index}.unit`)}
                  placeholder="Stück"
                  className="text-sm"
                />
              </div>
              <div className="col-span-2">
                <Input
                  {...register(`items.${index}.unitPrice`)}
                  className="text-sm text-right"
                  onBlur={() => recalcItem(index)}
                />
              </div>
              {!kleinunternehmer && (
                <div className="col-span-1">
                  <Select
                    defaultValue={defaultValues?.items?.[index]?.taxRate ?? "19"}
                    onValueChange={(v) => {
                      setValue(`items.${index}.taxRate`, v);
                      recalcItem(index);
                    }}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_RATES.map((r) => (
                        <SelectItem key={r.value} value={String(r.value)}>
                          {r.value}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2 text-right text-sm font-medium text-gray-900">
                {formatCurrency(watchedItems[index]?.grossAmount ?? 0)}
              </div>
              <div className="col-span-1 flex justify-end">
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1.5">
            {kleinunternehmer ? (
              <>
                <div className="flex justify-between text-base font-semibold text-gray-900 border-t border-gray-200 pt-1.5">
                  <span>Gesamtbetrag</span>
                  <span>{formatCurrency(totals.grossTotal)}</span>
                </div>
                <p className="text-xs text-gray-500 pt-1">
                  Dieser Rechnungsbetrag enthält nach §19 Abs. 1 UStG keine USt.
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Netto</span>
                  <span>{formatCurrency(totals.netTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>MwSt.</span>
                  <span>{formatCurrency(totals.taxTotal)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-gray-900 border-t border-gray-200 pt-1.5">
                  <span>Gesamt (brutto)</span>
                  <span>{formatCurrency(totals.grossTotal)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Anmerkungen</Label>
        <Textarea {...register("notes")} placeholder="Zahlungsbedingungen, Hinweise..." rows={3} />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? "Speichere..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
