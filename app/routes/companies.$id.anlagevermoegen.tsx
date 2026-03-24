import { useState, useEffect } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, Plus, Edit, Trash2, Layers } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency, formatDate } from "@/lib/tax";

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Anlagevermögen" },
  ],
};

const schema = z.object({
  bezeichnung: z.string().min(1, "Pflichtfeld"),
  anschaffungsdatum: z.string().min(1, "Pflichtfeld"),
  anschaffungskosten: z.coerce.number({ invalid_type_error: "Ungültiger Betrag" }).positive("Betrag muss größer 0 sein"),
  nutzungsdauerJahre: z.coerce.number().int().min(1, "Mindestens 1 Jahr"),
  restwert: z.coerce.number().min(0).default(0),
  beschreibung: z.string().optional(),
  aktiv: z.boolean().default(true),
});
type FormData = z.infer<typeof schema>;

interface Asset {
  id: string;
  bezeichnung: string;
  beschreibung: string | null;
  anschaffungsdatum: string;
  anschaffungskosten: number;
  nutzungsdauerJahre: number;
  restwert: number;
  aktiv: boolean;
  afaJahr: number;
  buchwert: number;
  status: "aktiv" | "vollständig abgeschrieben" | "inaktiv";
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!company) throw new Response("Not Found", { status: 404 });
  return { companyId: company.id, companyName: company.name };
}

function AnlagegutForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: Partial<FormData>;
  onSubmit: (d: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      aktiv: true,
      restwert: 0,
      anschaffungsdatum: new Date().toISOString().slice(0, 10),
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Bezeichnung *</Label>
        <Input {...register("bezeichnung")} placeholder="z.B. Laptop, Firmenwagen, Maschine" />
        {errors.bezeichnung && <p className="text-xs text-red-600">{errors.bezeichnung.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Anschaffungsdatum *</Label>
          <Input {...register("anschaffungsdatum")} type="date" />
          {errors.anschaffungsdatum && <p className="text-xs text-red-600">{errors.anschaffungsdatum.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Nutzungsdauer (Jahre) *</Label>
          <Input {...register("nutzungsdauerJahre")} type="number" min="1" step="1" placeholder="z.B. 5" />
          {errors.nutzungsdauerJahre && <p className="text-xs text-red-600">{errors.nutzungsdauerJahre.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Anschaffungskosten (€) *</Label>
          <Input {...register("anschaffungskosten")} type="number" step="0.01" placeholder="0.00" />
          {errors.anschaffungskosten && <p className="text-xs text-red-600">{errors.anschaffungskosten.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Restwert (€)</Label>
          <Input {...register("restwert")} type="number" step="0.01" min="0" placeholder="0.00" />
          {errors.restwert && <p className="text-xs text-red-600">{errors.restwert.message}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Beschreibung</Label>
        <Textarea {...register("beschreibung")} placeholder="Optionale Anmerkung" rows={2} />
      </div>
      <div className="flex items-center gap-2">
        <input {...register("aktiv")} type="checkbox" id="aktiv" className="rounded border-gray-300" />
        <Label htmlFor="aktiv">Aktiv (noch im Betrieb)</Label>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Speichern..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

const statusConfig = {
  "aktiv": { label: "aktiv", className: "bg-green-100 text-green-700" },
  "vollständig abgeschrieben": { label: "abgeschrieben", className: "bg-gray-100 text-gray-500" },
  "inaktiv": { label: "inaktiv", className: "bg-amber-100 text-amber-700" },
};

export default function AnlagevermoegenPage() {
  const { companyId, companyName } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  const [year, setYear] = useState(new Date().getFullYear());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  async function fetchAssets(y = year) {
    setLoading(true);
    const res = await fetch(`/api/anlagevermoegen?companyId=${companyId}&year=${y}`);
    const data = await res.json();
    setAssets(data.assets ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchAssets(); }, [companyId, year]);

  async function handleCreate(data: FormData) {
    await fetch("/api/anlagevermoegen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, companyId }),
    });
    setOpen(false);
    fetchAssets();
    revalidate();
  }

  async function handleEdit(data: FormData) {
    if (!editAsset) return;
    await fetch(`/api/anlagevermoegen/${editAsset.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditAsset(null);
    fetchAssets();
    revalidate();
  }

  async function handleDelete(id: string) {
    if (!confirm("Anlagegut wirklich löschen?")) return;
    await fetch(`/api/anlagevermoegen/${id}`, { method: "DELETE" });
    fetchAssets();
    revalidate();
  }

  const totalAK = assets.reduce((s, a) => s + a.anschaffungskosten, 0);
  const totalBW = assets.filter((a) => a.aktiv).reduce((s, a) => s + a.buchwert, 0);
  const totalAfa = assets.reduce((s, a) => s + a.afaJahr, 0);

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
          <h1 className="text-2xl font-bold text-gray-900">Anlagevermögen</h1>
          <p className="text-gray-500 mt-1">{companyName} · Lineare Abschreibung (AfA)</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700">
                <Plus className="h-4 w-4" /> Anlagegut anlegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neues Anlagegut</DialogTitle>
              </DialogHeader>
              <AnlagegutForm onSubmit={handleCreate} submitLabel="Anlegen" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Anschaffungskosten gesamt</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAK)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Buchwert gesamt ({year})</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(totalBW)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">AfA gesamt {year}</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAfa)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editAsset} onOpenChange={(o) => !o && setEditAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anlagegut bearbeiten</DialogTitle>
          </DialogHeader>
          {editAsset && (
            <AnlagegutForm
              defaultValues={{
                bezeichnung: editAsset.bezeichnung,
                anschaffungsdatum: editAsset.anschaffungsdatum.slice(0, 10),
                anschaffungskosten: editAsset.anschaffungskosten,
                nutzungsdauerJahre: editAsset.nutzungsdauerJahre,
                restwert: editAsset.restwert,
                beschreibung: editAsset.beschreibung ?? undefined,
                aktiv: editAsset.aktiv,
              }}
              onSubmit={handleEdit}
              submitLabel="Speichern"
            />
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Lade Anlagevermögen...</div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Noch keine Anlagegüter erfasst</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Erstes Anlagegut anlegen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Bezeichnung</th>
                  <th className="px-4 py-3 text-left">Anschaffung</th>
                  <th className="px-4 py-3 text-right">Anschaffungskosten</th>
                  <th className="px-4 py-3 text-right">Nutzungsdauer</th>
                  <th className="px-4 py-3 text-right">AfA {year}</th>
                  <th className="px-4 py-3 text-right">Buchwert {year}</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((asset) => {
                  const s = statusConfig[asset.status];
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{asset.bezeichnung}</p>
                        {asset.beschreibung && (
                          <p className="text-xs text-slate-400 truncate max-w-xs">{asset.beschreibung}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(asset.anschaffungsdatum)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {formatCurrency(asset.anschaffungskosten)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {asset.nutzungsdauerJahre} J.
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {asset.afaJahr > 0 ? formatCurrency(asset.afaJahr) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-700">
                        {formatCurrency(asset.buchwert)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditAsset(asset)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(asset.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="px-4 py-3 font-semibold text-slate-700">Gesamt</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(totalAK)}</td>
                  <td></td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(totalAfa)}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">{formatCurrency(totalBW)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
