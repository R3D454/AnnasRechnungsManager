"use client";

import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcItemAmounts, calcInvoiceTotals, formatCurrency, TAX_RATES } from "@/lib/tax";
import { Plus, Trash2 } from "lucide-react";

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

interface InvoiceFormProps {
  customers: Customer[];
  companyId: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  defaultValues?: Partial<InvoiceFormValues>;
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

export function InvoiceForm({ customers, companyId, onSubmit }: InvoiceFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const dueDefault = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<InvoiceFormValues>({
    defaultValues: {
      customerId: "",
      issueDate: today,
      deliveryDate: today,
      dueDate: dueDefault,
      notes: "",
      items: [defaultItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  const recalcItem = useCallback((index: number) => {
    const item = watchedItems[index];
    if (!item) return;
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    const rate = parseFloat(item.taxRate) || 0;
    const { netAmount, taxAmount, grossAmount } = calcItemAmounts(qty, price, rate);
    setValue(`items.${index}.netAmount`, netAmount);
    setValue(`items.${index}.taxAmount`, taxAmount);
    setValue(`items.${index}.grossAmount`, grossAmount);
  }, [watchedItems, setValue]);

  const totals = calcInvoiceTotals(
    watchedItems.map((item) => ({
      netAmount: item.netAmount ?? 0,
      taxAmount: item.taxAmount ?? 0,
      grossAmount: item.grossAmount ?? 0,
    }))
  );

  async function handleFormSubmit(data: InvoiceFormValues) {
    const items = data.items.map((item, i) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
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

    await onSubmit({
      companyId,
      customerId: data.customerId,
      issueDate: data.issueDate,
      deliveryDate: data.deliveryDate || undefined,
      dueDate: data.dueDate,
      notes: data.notes || undefined,
      items,
      ...totals,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Kunde *</Label>
          <Select onValueChange={(v) => setValue("customerId", v)}>
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

      {/* Items */}
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

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-600">
            <div className="col-span-4">Beschreibung</div>
            <div className="col-span-1">Menge</div>
            <div className="col-span-1">Einh.</div>
            <div className="col-span-2">Einzelpreis</div>
            <div className="col-span-1">MwSt.</div>
            <div className="col-span-2 text-right">Gesamt (brutto)</div>
            <div className="col-span-1"></div>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 items-center">
              <div className="col-span-4">
                <Input
                  {...register(`items.${index}.description`, { required: true })}
                  placeholder="Leistungsbeschreibung"
                  className="text-sm"
                  onChange={(e) => {
                    register(`items.${index}.description`).onChange(e);
                  }}
                />
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
              <div className="col-span-1">
                <Select
                  defaultValue="19"
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

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1.5">
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
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>Anmerkungen</Label>
        <Textarea {...register("notes")} placeholder="Zahlungsbedingungen, Hinweise..." rows={3} />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? "Erstelle Rechnung..." : "Rechnung erstellen"}
        </Button>
      </div>
    </form>
  );
}
