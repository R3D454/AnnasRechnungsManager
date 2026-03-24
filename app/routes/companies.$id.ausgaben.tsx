import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, Plus, Pencil, Trash2, Loader2, Banknote, Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/tax";
import { AUSGABE_KATEGORIEN, KATEGORIE_LABELS, type AusgabeKategorieKey } from "@/lib/ausgaben";

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Betriebsausgaben" },
  ],
};

const STEUERSAETZE = [
  { label: "Keine (0 %)", value: 0 },
  { label: "7 %", value: 7 },
  { label: "19 %", value: 19 },
];

interface Ausgabe {
  id: string;
  kategorie: AusgabeKategorieKey;
  betrag: number;
  steuersatz: number;
  zahlungsart: "KASSE" | "BANK";
  datum: string;
  beschreibung: string | null;
}

const emptyForm = {
  kategorie: "SONSTIGER_BETRIEBSBEDARF" as AusgabeKategorieKey,
  betrag: "",
  steuersatz: 19,
  zahlungsart: "BANK" as "KASSE" | "BANK",
  datum: new Date().toISOString().slice(0, 10),
  beschreibung: "",
};

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  const year = new Date().getFullYear();
  const ausgaben = await prisma.buchung.findMany({
    where: {
      companyId: params.id,
      type: "ENTNAHME",
      isBusinessRecord: true,
      date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    },
    orderBy: { date: "desc" },
  });

  return {
    companyId: company.id,
    companyName: company.name,
    initialYear: year,
    ausgaben: ausgaben.map((a) => ({
      id: a.id,
      kategorie: (a.kategorie || "SONSTIGER_BETRIEBSBEDARF") as AusgabeKategorieKey,
      betrag: Number(a.amount),
      steuersatz: a.steuersatz || 19,
      zahlungsart: (a.zahlungsart as "KASSE" | "BANK") || "BANK",
      datum: a.date.toISOString(),
      beschreibung: a.description,
    })),
  };
}

export default function AusgabenPage() {
  const { ausgaben: initialAusgaben, companyId, companyName, initialYear } =
    useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const [year, setYear] = useState(initialYear);
  const [ausgaben, setAusgaben] = useState<Ausgabe[]>(initialAusgaben);
  const [loadingYear, setLoadingYear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  async function loadYear(y: number) {
    setYear(y);
    setLoadingYear(true);
    const res = await fetch(`/api/ausgaben?companyId=${companyId}&year=${y}`);
    const data: Ausgabe[] = await res.json();
    setAusgaben(data);
    setLoadingYear(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, datum: `${year}-01-01` });
    setDialogOpen(true);
  }

  function openEdit(a: Ausgabe) {
    setEditingId(a.id);
    setForm({
      kategorie: a.kategorie,
      betrag: String(a.betrag),
      steuersatz: a.steuersatz,
      zahlungsart: a.zahlungsart,
      datum: a.datum.slice(0, 10),
      beschreibung: a.beschreibung ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      kategorie: form.kategorie,
      betrag: parseFloat(form.betrag),
      steuersatz: form.steuersatz,
      zahlungsart: form.zahlungsart,
      datum: form.datum,
      beschreibung: form.beschreibung || undefined,
    };
    try {
      if (editingId) {
        await fetch(`/api/ausgaben/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/ausgaben", {
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
    if (!confirm("Eintrag wirklich löschen?")) return;
    setDeleting(id);
    await fetch(`/api/ausgaben/${id}`, { method: "DELETE" });
    setDeleting(null);
    await loadYear(year);
    revalidate();
  }

  // Berechnungen
  const gesamt = ausgaben.reduce((s, a) => s + a.betrag, 0);
  const kasseGesamt = ausgaben.filter((a) => a.zahlungsart === "KASSE").reduce((s, a) => s + a.betrag, 0);
  const bankGesamt = ausgaben.filter((a) => a.zahlungsart === "BANK").reduce((s, a) => s + a.betrag, 0);
  const vorstGesamt = ausgaben.reduce((s, a) => {
    const rate = a.steuersatz / 100;
    return s + (rate > 0 ? Math.round((a.betrag / (1 + rate)) * rate * 100) / 100 : 0);
  }, 0);

  const formValid = form.kategorie && parseFloat(form.betrag) > 0 && form.datum.length > 0;

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
          <h1 className="text-2xl font-bold text-gray-900">Betriebsausgaben</h1>
          <p className="text-gray-500 mt-1">{companyName} · {year}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => loadYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={openCreate} className="bg-rose-600 hover:bg-rose-700">
            <Plus className="h-4 w-4" />
            Neue Ausgabe
          </Button>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Gesamt {year}</p>
            <p className="text-xl font-bold text-rose-600">{formatCurrency(gesamt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-1 mb-1">
              <Landmark className="h-3 w-3 text-gray-400" />
              <p className="text-xs text-gray-500">Bank</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(bankGesamt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-1 mb-1">
              <Banknote className="h-3 w-3 text-gray-400" />
              <p className="text-xs text-gray-500">Kasse</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(kasseGesamt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Vorsteuer (enthalten)</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(vorstGesamt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste */}
      {loadingYear ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Lade Ausgaben...
        </div>
      ) : ausgaben.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <p className="text-sm">Noch keine Ausgaben für {year} erfasst.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Erste Ausgabe hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Kategorie</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Brutto</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">MwSt.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Netto</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Zahlung</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Notiz</th>
                  <th className="px-3 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ausgaben.map((a) => {
                  const rate = a.steuersatz / 100;
                  const netto = rate > 0 ? Math.round((a.betrag / (1 + rate)) * 100) / 100 : a.betrag;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60 group">
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {new Date(a.datum).toLocaleDateString("de-DE")}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 font-medium">
                        {KATEGORIE_LABELS[a.kategorie]}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-rose-700 whitespace-nowrap">
                        {formatCurrency(a.betrag)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {a.steuersatz > 0 ? (
                          <Badge variant="secondary">{a.steuersatz} %</Badge>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">
                        {formatCurrency(netto)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {a.zahlungsart === "BANK" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                            <Landmark className="h-3 w-3" /> Bank
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <Banknote className="h-3 w-3" /> Kasse
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 text-xs truncate max-w-xs">
                        {a.beschreibung ?? ""}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(a)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                            title="Bearbeiten"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={deleting === a.id}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                            title="Löschen"
                          >
                            {deleting === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-slate-700">Gesamt</td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-rose-600">{formatCurrency(gesamt)}</td>
                  <td />
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-600">
                    {formatCurrency(gesamt - vorstGesamt)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Ausgabe bearbeiten" : "Neue Ausgabe"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.datum}
                  onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Betrag (brutto, €) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.betrag}
                  onChange={(e) => setForm((f) => ({ ...f, betrag: e.target.value }))}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategorie <span className="text-red-500">*</span>
              </label>
              <select
                value={form.kategorie}
                onChange={(e) => setForm((f) => ({ ...f, kategorie: e.target.value as AusgabeKategorieKey }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {AUSGABE_KATEGORIEN.map((k) => (
                  <option key={k} value={k}>{KATEGORIE_LABELS[k]}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zahlungsweg</label>
                <div className="flex gap-2">
                  {(["BANK", "KASSE"] as const).map((za) => (
                    <button
                      key={za}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, zahlungsart: za }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-colors
                        ${form.zahlungsart === za
                          ? za === "BANK"
                            ? "bg-blue-50 border-blue-300 text-blue-700"
                            : "bg-amber-50 border-amber-300 text-amber-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                    >
                      {za === "BANK" ? <Landmark className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}
                      {za === "BANK" ? "Bank" : "Kasse"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Steuersatz</label>
                <select
                  value={form.steuersatz}
                  onChange={(e) => setForm((f) => ({ ...f, steuersatz: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {STEUERSAETZE.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vorschau Nettobetrag */}
            {parseFloat(form.betrag) > 0 && form.steuersatz > 0 && (
              <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-700 space-y-0.5">
                <p><strong>Brutto:</strong> {formatCurrency(parseFloat(form.betrag))}</p>
                <p><strong>Vorsteuer ({form.steuersatz} %):</strong> {formatCurrency(Math.round((parseFloat(form.betrag) / (1 + form.steuersatz / 100)) * (form.steuersatz / 100) * 100) / 100)}</p>
                <p><strong>Netto:</strong> {formatCurrency(Math.round((parseFloat(form.betrag) / (1 + form.steuersatz / 100)) * 100) / 100)}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
              <input
                type="text"
                value={form.beschreibung}
                onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
                placeholder="Optional"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formValid}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
