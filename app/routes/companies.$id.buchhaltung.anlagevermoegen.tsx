import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/tax";
import { afaFuerJahr, buchwert, assetStatus, type AnlagegutRaw } from "@/lib/afa";

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Buchhaltung", href: `/companies/${data.companyId}/buchhaltung/bilanzen` },
    { label: "Anlagevermögen" },
  ],
};

interface Asset {
  id: string;
  bezeichnung: string;
  beschreibung: string | null;
  anschaffungsdatum: string;
  anschaffungskosten: number;
  nutzungsdauerJahre: number;
  restwert: number;
  aktiv: boolean;
}

interface AssetWithAfa extends Asset {
  afaJahr: number;
  buchwertJahr: number;
  statusLabel: string;
}

function enrichAsset(a: Asset, year: number): AssetWithAfa {
  const raw: AnlagegutRaw = {
    anschaffungskosten: a.anschaffungskosten,
    nutzungsdauerJahre: a.nutzungsdauerJahre,
    restwert: a.restwert,
    anschaffungsdatum: a.anschaffungsdatum,
    aktiv: a.aktiv,
  };
  return {
    ...a,
    afaJahr: afaFuerJahr(raw, year),
    buchwertJahr: buchwert(raw, year),
    statusLabel: assetStatus(raw, year),
  };
}

const STATUS_VARIANTS: Record<string, "success" | "secondary" | "outline"> = {
  aktiv: "success",
  "vollständig abgeschrieben": "secondary",
  inaktiv: "outline",
};

const emptyForm = {
  bezeichnung: "",
  anschaffungsdatum: "",
  anschaffungskosten: "",
  nutzungsdauerJahre: "",
  restwert: "0",
  beschreibung: "",
  aktiv: true,
};

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  const assets = await prisma.anlagegut.findMany({
    where: { companyId: params.id },
    orderBy: { anschaffungsdatum: "asc" },
  });

  return {
    companyId: company.id,
    companyName: company.name,
    initialYear: new Date().getFullYear(),
    assets: assets.map((a) => ({
      id: a.id,
      bezeichnung: a.bezeichnung,
      beschreibung: a.beschreibung,
      anschaffungsdatum: a.anschaffungsdatum.toISOString(),
      anschaffungskosten: Number(a.anschaffungskosten),
      nutzungsdauerJahre: a.nutzungsdauerJahre,
      restwert: Number(a.restwert),
      aktiv: a.aktiv,
    })),
  };
}

export default function AnlagevermoegenPage() {
  const { assets: initialAssets, companyId, companyName, initialYear } =
    useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const [year, setYear] = useState(initialYear);
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [loadingYear, setLoadingYear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState(emptyForm);

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + 2 - i);

  async function loadYear(y: number) {
    setYear(y);
    setLoadingYear(true);
    const res = await fetch(`/api/anlagevermoegen?companyId=${companyId}&year=${y}`);
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAssets(data.assets.map((a: any) => ({
      id: a.id,
      bezeichnung: a.bezeichnung,
      beschreibung: a.beschreibung,
      anschaffungsdatum: a.anschaffungsdatum,
      anschaffungskosten: a.anschaffungskosten,
      nutzungsdauerJahre: a.nutzungsdauerJahre,
      restwert: a.restwert,
      aktiv: a.aktiv,
    })));
    setLoadingYear(false);
  }

  function openCreate() {
    setEditingAsset(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditingAsset(asset);
    setForm({
      bezeichnung: asset.bezeichnung,
      anschaffungsdatum: asset.anschaffungsdatum.slice(0, 10),
      anschaffungskosten: String(asset.anschaffungskosten),
      nutzungsdauerJahre: String(asset.nutzungsdauerJahre),
      restwert: String(asset.restwert),
      beschreibung: asset.beschreibung ?? "",
      aktiv: asset.aktiv,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      bezeichnung: form.bezeichnung,
      anschaffungsdatum: form.anschaffungsdatum,
      anschaffungskosten: parseFloat(form.anschaffungskosten),
      nutzungsdauerJahre: parseInt(form.nutzungsdauerJahre),
      restwert: parseFloat(form.restwert) || 0,
      beschreibung: form.beschreibung || undefined,
      aktiv: form.aktiv,
    };

    try {
      if (editingAsset) {
        await fetch(`/api/anlagevermoegen/${editingAsset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/anlagevermoegen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, companyId }),
        });
      }
      setDialogOpen(false);
      await loadYear(year);
      revalidate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Anlagegut wirklich löschen?")) return;
    setDeleting(id);
    await fetch(`/api/anlagevermoegen/${id}`, { method: "DELETE" });
    setDeleting(null);
    await loadYear(year);
    revalidate();
  }

  const enriched = assets.map((a) => enrichAsset(a, year));
  const aktiveAnlagen = enriched.filter((a) => a.aktiv && a.statusLabel === "aktiv").length;
  const gesamtAfa = enriched.reduce((s, a) => s + a.afaJahr, 0);
  const gesamtBuchwert = enriched.reduce((s, a) => s + a.buchwertJahr, 0);

  const formValid =
    form.bezeichnung.trim().length > 0 &&
    form.anschaffungsdatum.length > 0 &&
    parseFloat(form.anschaffungskosten) > 0 &&
    parseInt(form.nutzungsdauerJahre) >= 1;

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
          <p className="text-gray-500 mt-1">
            {companyName} · {year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => loadYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Neues Anlagegut
          </Button>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Aktive Anlagen</p>
            <p className="text-xl font-bold text-gray-900">{aktiveAnlagen}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">AfA gesamt {year}</p>
            <p className="text-xl font-bold text-rose-600">{formatCurrency(gesamtAfa)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Gesamter Buchwert</p>
            <p className="text-xl font-bold text-indigo-600">{formatCurrency(gesamtBuchwert)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabelle */}
      {loadingYear ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Lade Anlagen...
        </div>
      ) : enriched.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <p className="text-sm">Noch keine Anlagegüter erfasst.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Erstes Anlagegut hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Bezeichnung
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Anschaffung
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    AK
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    ND (J)
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    AfA {year}
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Buchwert 31.12.{year}
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enriched.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/60 group">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{asset.bezeichnung}</p>
                      {asset.beschreibung && (
                        <p className="text-xs text-slate-400 truncate max-w-xs">
                          {asset.beschreibung}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                      {new Date(asset.anschaffungsdatum).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700 font-medium whitespace-nowrap">
                      {formatCurrency(asset.anschaffungskosten)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {asset.nutzungsdauerJahre}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      {asset.afaJahr > 0 ? (
                        <span className="text-rose-600">{formatCurrency(asset.afaJahr)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-indigo-700 whitespace-nowrap">
                      {formatCurrency(asset.buchwertJahr)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant={STATUS_VARIANTS[asset.statusLabel] ?? "outline"}>
                        {asset.statusLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(asset)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                          title="Bearbeiten"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(asset.id)}
                          disabled={deleting === asset.id}
                          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                          title="Löschen"
                        >
                          {deleting === asset.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-slate-700">
                    Gesamt
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-rose-600">
                    {formatCurrency(gesamtAfa)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-indigo-700">
                    {formatCurrency(gesamtBuchwert)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-slate-100 text-xs text-slate-400">
            AfA: lineare Abschreibung nach §7 EStG · Buchwert zum 31.12. des gewählten Jahres
          </div>
        </Card>
      )}

      {/* Dialog: Anlegen / Bearbeiten */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAsset ? "Anlagegut bearbeiten" : "Neues Anlagegut"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bezeichnung <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.bezeichnung}
                onChange={(e) => setForm((f) => ({ ...f, bezeichnung: e.target.value }))}
                placeholder="z.B. Laptop, Firmenwagen, Maschine"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anschaffungsdatum <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.anschaffungsdatum}
                  onChange={(e) => setForm((f) => ({ ...f, anschaffungsdatum: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nutzungsdauer (Jahre) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.nutzungsdauerJahre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nutzungsdauerJahre: e.target.value }))
                  }
                  placeholder="z.B. 3"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anschaffungskosten (€) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.anschaffungskosten}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, anschaffungskosten: e.target.value }))
                  }
                  placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restwert (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.restwert}
                  onChange={(e) => setForm((f) => ({ ...f, restwert: e.target.value }))}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beschreibung
              </label>
              <textarea
                rows={2}
                value={form.beschreibung}
                onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
                placeholder="Optionale Notizen"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="aktiv"
                checked={form.aktiv}
                onChange={(e) => setForm((f) => ({ ...f, aktiv: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="aktiv" className="text-sm text-gray-700">
                Anlagegut ist aktiv
              </label>
            </div>

            {/* AfA-Vorschau */}
            {formValid && (() => {
              const raw: AnlagegutRaw = {
                anschaffungskosten: parseFloat(form.anschaffungskosten),
                nutzungsdauerJahre: parseInt(form.nutzungsdauerJahre),
                restwert: parseFloat(form.restwert) || 0,
                anschaffungsdatum: form.anschaffungsdatum,
                aktiv: form.aktiv,
              };
              const afa = afaFuerJahr(raw, year);
              const bw = buchwert(raw, year);
              const jahresAfaVoll =
                Math.round(
                  ((raw.anschaffungskosten - raw.restwert) / raw.nutzungsdauerJahre) * 100
                ) / 100;
              return (
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700 space-y-1">
                  <p>
                    <strong>Jährliche AfA:</strong> {formatCurrency(jahresAfaVoll)}
                  </p>
                  <p>
                    <strong>AfA {year}:</strong> {formatCurrency(afa)}
                  </p>
                  <p>
                    <strong>Buchwert 31.12.{year}:</strong> {formatCurrency(bw)}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving || !formValid}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingAsset ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
