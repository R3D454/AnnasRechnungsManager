import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Leistungen" },
  ],
};

import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"; // CardContent used for empty state
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Briefcase, Plus, Edit, Trash2, ChevronLeft, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TAX_RATES, formatCurrency } from "@/lib/tax";

const schema = z.object({
  name: z.string().min(1, "Pflichtfeld"),
  description: z.string().optional(),
  unit: z.string().optional(),
  unitPrice: z.coerce.number({ invalid_type_error: "Ungültiger Betrag" }),
  taxRate: z.coerce.number(),
});
type FormData = z.infer<typeof schema>;

interface Service {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPrice: number;
  taxRate: number;
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  const services = await prisma.service.findMany({
    where: { companyId: params.id },
    orderBy: { name: "asc" },
  });

  return {
    services: services.map((s) => ({
      ...s,
      unitPrice: Number(s.unitPrice),
      taxRate: Number(s.taxRate),
    })),
    companyId: params.id,
    companyName: company.name,
  };
}

function ServiceForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (d: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { taxRate: 19, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Bezeichnung *</Label>
        <Input {...register("name")} placeholder="z.B. Beratung, Programmierung" />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Beschreibung</Label>
        <Input {...register("description")} placeholder="Optionale Leistungsbeschreibung" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Einheit</Label>
          <Input {...register("unit")} placeholder="Stunde, Stück, ..." />
        </div>
        <div className="space-y-1.5">
          <Label>Einzelpreis (€) *</Label>
          <Input {...register("unitPrice")} type="number" step="0.01" placeholder="0.00" />
          {errors.unitPrice && <p className="text-xs text-red-600">{errors.unitPrice.message}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Steuersatz</Label>
        <Select
          defaultValue={String(defaultValues?.taxRate ?? 19)}
          onValueChange={(v) => setValue("taxRate", Number(v))}
        >
          <SelectTrigger>
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
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Speichern..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

type SortKey = "name" | "description" | "unit" | "unitPrice" | "taxRate";
type SortDir = "asc" | "desc";

export default function LeistungenPage() {
  const { services, companyId } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [open, setOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...services].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), "de");
    return sortDir === "asc" ? cmp : -cmp;
  });

  async function handleCreate(data: FormData) {
    await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, companyId }),
    });
    setOpen(false);
    revalidate();
  }

  async function handleEdit(data: FormData) {
    if (!editService) return;
    await fetch(`/api/services/${editService.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditService(null);
    revalidate();
  }

  async function handleDelete(serviceId: string) {
    if (!confirm("Leistung wirklich löschen?")) return;
    await fetch(`/api/services/${serviceId}`, { method: "DELETE" });
    revalidate();
  }

  return (
    <div>
      <Link
        to={`/companies/${companyId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zum Mandanten
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leistungen</h1>
          <p className="text-gray-500 mt-1">{services.length} {services.length === 1 ? "Leistung" : "Leistungen"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Leistung anlegen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Leistung</DialogTitle>
            </DialogHeader>
            <ServiceForm onSubmit={handleCreate} submitLabel="Anlegen" />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editService} onOpenChange={(o) => !o && setEditService(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leistung bearbeiten</DialogTitle>
          </DialogHeader>
          {editService && (
            <ServiceForm
              defaultValues={{
                name: editService.name,
                description: editService.description ?? undefined,
                unit: editService.unit ?? undefined,
                unitPrice: editService.unitPrice,
                taxRate: editService.taxRate,
              }}
              onSubmit={handleEdit}
              submitLabel="Speichern"
            />
          )}
        </DialogContent>
      </Dialog>

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Noch keine Leistungen angelegt</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {(["name", "description", "unit", "unitPrice", "taxRate"] as SortKey[]).map((key, i) => {
                    const labels: Record<SortKey, string> = { name: "Bezeichnung", description: "Beschreibung", unit: "Einheit", unitPrice: "Preis", taxRate: "MwSt." };
                    const isNum = key === "unitPrice" || key === "taxRate";
                    const active = sortKey === key;
                    const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                    return (
                      <th key={key} className={`px-4 py-3 ${isNum ? "text-right" : "text-left"}`}>
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className={`inline-flex items-center gap-1 hover:text-slate-800 transition-colors ${active ? "text-slate-800" : ""}`}
                        >
                          {labels[key]}
                          <Icon className="h-3 w-3" />
                        </button>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((service) => (
                  <tr key={service.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{service.name}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{service.description ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{service.unit ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(service.unitPrice)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{service.taxRate}%</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditService(service)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(service.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
