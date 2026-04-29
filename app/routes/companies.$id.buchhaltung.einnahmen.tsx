import { useState, useMemo, useRef, useCallback } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, Plus, Pencil, Trash2, Loader2, Banknote, Landmark, List, LayoutGrid, Paperclip, Upload, X, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/tax";
import { DEFAULT_EINNAHME_KATEGORIEN } from "@/lib/kategorie-defaults";

/** Converts stored belegUrl ("beleg:{userId}/{storedName}|{originalName}") to a viewable href. */
function belegHref(belegUrl: string | null): string | null {
  if (!belegUrl) return null;
  if (belegUrl.startsWith("beleg:")) {
    const rel = belegUrl.slice("beleg:".length); // "userId/storedName|originalName"
    const [userId, rest] = rel.split("/");
    const storedName = rest?.split("|")[0]; // strip "|originalName" if present
    return `/api/beleg/${userId}/${storedName}`;
  }
  return belegUrl; // fallback for legacy http(s) URLs
}

/** Extracts a human-readable display name from a stored belegUrl. */
function belegDisplayName(belegUrl: string): string {
  if (belegUrl.startsWith("beleg:")) {
    const rest = belegUrl.split("/").pop() ?? "Beleg"; // "storedName|originalName" or just "storedName"
    const parts = rest.split("|");
    return parts.length > 1 ? parts.slice(1).join("|") : parts[0]; // prefer originalName
  }
  return belegUrl.split("/").pop() ?? "Beleg";
}

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Buchhaltung", href: `/companies/${data.companyId}/buchhaltung/bilanzen` },
    { label: "Sonstige Einnahmen" },
  ],
};

const MONAT_LABELS = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

const STEUERSAETZE = [
  { label: "Keine (0 %)", value: 0 },
  { label: "7 %", value: 7 },
  { label: "19 %", value: 19 },
];

interface Einnahme {
  id: string;
  kategorie: string;
  betrag: number;
  steuersatz: number;
  zahlungsart: "KASSE" | "BANK";
  datum: string;
  beschreibung: string | null;
  belegUrl: string | null;
}

const emptyForm = {
  kategorie: "",
  betrag: "",
  steuersatz: 0,
  zahlungsart: "BANK" as "KASSE" | "BANK",
  datum: new Date().toISOString().slice(0, 10),
  beschreibung: "",
  belegUrl: "",
};

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  // Auto-seed Standardkategorien wenn noch keine vorhanden
  const katCount = await prisma.buchungKategorie.count({
    where: { companyId: params.id, typ: "EINNAHME" },
  });
  if (katCount === 0) {
    await prisma.buchungKategorie.createMany({
      data: DEFAULT_EINNAHME_KATEGORIEN.map((name) => ({
        companyId: params.id,
        name,
        typ: "EINNAHME",
      })),
      skipDuplicates: true,
    });
  }

  const kategorien = await prisma.buchungKategorie.findMany({
    where: { companyId: params.id, typ: "EINNAHME" },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  const year = new Date().getFullYear();
  const einnahmen = await prisma.buchung.findMany({
    where: {
      companyId: params.id,
      type: "EINLAGE",
      isBusinessRecord: true,
      date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    },
    orderBy: { date: "desc" },
  });

  return {
    companyId: company.id,
    companyName: company.name,
    initialYear: year,
    kategorien: kategorien.map((k) => k.name),
    einnahmen: einnahmen.map((e) => ({
      id: e.id,
      kategorie: e.kategorie ?? "",
      betrag: Number(e.amount),
      steuersatz: (e.steuersatz as number | null) ?? 0,
      zahlungsart: (e.zahlungsart as "KASSE" | "BANK") || "BANK",
      datum: e.date.toISOString(),
      beschreibung: e.description,
      belegUrl: e.belegUrl ?? null,
    })),
  };
}

export default function EinnahmenPage() {
  const { einnahmen: initialEinnahmen, companyId, companyName, initialYear, kategorien } =
    useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const [year, setYear] = useState(initialYear);
  const [einnahmen, setEinnahmen] = useState<Einnahme[]>(initialEinnahmen);
  const [loadingYear, setLoadingYear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [view, setView] = useState<"pivot" | "liste">("liste");

  // File upload state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingBeleg, setUploadingBeleg] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Quick-upload from list view (without opening dialog)
  const [quickUploadId, setQuickUploadId] = useState<string | null>(null);

  const handleFileDrop = useCallback((file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setUploadError("Nur PDF, JPG, PNG, WebP oder GIF erlaubt.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Datei zu groß (max. 10 MB).");
      return;
    }
    setUploadError(null);
    setPendingFile(file);
  }, []);

  async function handleQuickUpload(buchungId: string, file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return;
    setQuickUploadId(buchungId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/einnahmen/${buchungId}/upload`, { method: "POST", body: fd });
      if (res.ok) {
        await loadYear(year);
        revalidate();
      }
    } finally {
      setQuickUploadId(null);
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [cellModal, setCellModal] = useState<{ kategorie: string; monat: number } | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  async function loadYear(y: number) {
    setYear(y);
    setLoadingYear(true);
    const res = await fetch(`/api/einnahmen?companyId=${companyId}&year=${y}`);
    const raw: Array<Record<string, unknown>> = await res.json();
    setEinnahmen(raw.map((e) => ({
      id: e.id as string,
      kategorie: (e.kategorie as string) ?? "",
      betrag: Number(e.amount),
      steuersatz: (e.steuersatz as number | null) ?? 0,
      zahlungsart: ((e.zahlungsart as string) || "BANK") as "KASSE" | "BANK",
      datum: e.date as string,
      beschreibung: (e.description as string | null) ?? null,
      belegUrl: (e.belegUrl as string | null) ?? null,
    })));
    setLoadingYear(false);
  }

  function openCreate() {
    setEditingId(null);
    setPendingFile(null);
    setUploadError(null);
    setForm({ ...emptyForm, datum: `${year}-01-01`, kategorie: kategorien[0] ?? "" });
    setDialogOpen(true);
  }

  function openEdit(e: Einnahme) {
    setEditingId(e.id);
    setPendingFile(null);
    setUploadError(null);
    setForm({
      kategorie: e.kategorie,
      betrag: String(e.betrag),
      steuersatz: e.steuersatz,
      zahlungsart: e.zahlungsart,
      datum: e.datum.slice(0, 10),
      beschreibung: e.beschreibung ?? "",
      belegUrl: e.belegUrl ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setUploadError(null);
    const payload = {
      kategorie: form.kategorie,
      betrag: parseFloat(form.betrag),
      steuersatz: form.steuersatz,
      zahlungsart: form.zahlungsart,
      datum: form.datum,
      beschreibung: form.beschreibung || undefined,
      belegUrl: form.belegUrl || undefined,
    };
    try {
      let savedId: string;
      if (editingId) {
        const res = await fetch(`/api/einnahmen/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Speichern fehlgeschlagen.");
        savedId = editingId;
      } else {
        const res = await fetch("/api/einnahmen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, companyId }),
        });
        if (!res.ok) throw new Error("Erstellen fehlgeschlagen.");
        const created = await res.json() as { id?: string };
        savedId = created.id ?? "";
      }

      // Upload pending file after entry is saved
      if (pendingFile && savedId) {
        setUploadingBeleg(true);
        const fd = new FormData();
        fd.append("file", pendingFile);
        const upRes = await fetch(`/api/einnahmen/${savedId}/upload`, { method: "POST", body: fd });
        if (!upRes.ok) {
          const err = await upRes.json().catch(() => ({ error: "Upload fehlgeschlagen." })) as { error?: string };
          throw new Error(err.error ?? "Upload fehlgeschlagen.");
        }
        setPendingFile(null);
      }

      setDialogOpen(false);
      await loadYear(year);
      revalidate();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      setSaving(false);
      setUploadingBeleg(false);
    }
  }

  async function handleDeleteBeleg(id: string) {
    await fetch(`/api/einnahmen/${id}/upload`, { method: "DELETE" });
    await loadYear(year);
    revalidate();
  }

  async function handleDelete(id: string) {
    if (!confirm("Eintrag wirklich löschen?")) return;
    setDeleting(id);
    await fetch(`/api/einnahmen/${id}`, { method: "DELETE" });
    setDeleting(null);
    await loadYear(year);
    revalidate();
  }

  // Berechnungen
  const gesamt = einnahmen.reduce((s, e) => s + e.betrag, 0);
  const kasseGesamt = einnahmen.filter((e) => e.zahlungsart === "KASSE").reduce((s, e) => s + e.betrag, 0);
  const bankGesamt = einnahmen.filter((e) => e.zahlungsart === "BANK").reduce((s, e) => s + e.betrag, 0);
  const ustGesamt = einnahmen.reduce((s, e) => {
    const rate = e.steuersatz / 100;
    return s + (rate > 0 ? Math.round((e.betrag / (1 + rate)) * rate * 100) / 100 : 0);
  }, 0);

  const activeMonate = useMemo(() => {
    const set = new Set(einnahmen.map((e) => new Date(e.datum).getMonth()));
    return Array.from({ length: 12 }, (_, i) => i).filter((m) => set.has(m));
  }, [einnahmen]);

  const pivot = useMemo(() => {
    const map = new Map<string, Map<number, Einnahme[]>>();
    for (const e of einnahmen) {
      if (!map.has(e.kategorie)) map.set(e.kategorie, new Map());
      const monat = new Date(e.datum).getMonth();
      const inner = map.get(e.kategorie)!;
      if (!inner.has(monat)) inner.set(monat, []);
      inner.get(monat)!.push(e);
    }
    return map;
  }, [einnahmen]);

  const activeKategorien = useMemo(() => Array.from(pivot.keys()), [pivot]);

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
          <h1 className="text-2xl font-bold text-gray-900">Sonstige Einnahmen</h1>
          <p className="text-gray-500 mt-1">{companyName} · {year}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView("liste")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                view === "liste"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title="Listenansicht"
            >
              <List className="h-4 w-4" />
              Liste
            </button>
            <button
              onClick={() => setView("pivot")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${
                view === "pivot"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              title="Übersicht"
            >
              <LayoutGrid className="h-4 w-4" />
              Übersicht
            </button>
          </div>
          <select
            value={year}
            onChange={(e) => loadYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Link
            to={`/companies/${companyId}/einnahmen/kategorien`}
            className="text-sm text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
          >
            Kategorien verwalten
          </Link>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            Neue Einnahme
          </Button>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Gesamt {year}</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(gesamt)}</p>
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
            <p className="text-xs text-gray-500 mb-1">Umsatzsteuer (enthalten)</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(ustGesamt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pivottabelle / Listenansicht */}
      {loadingYear ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Lade Einnahmen...
        </div>
      ) : einnahmen.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <p className="text-sm">Noch keine Einnahmen für {year} erfasst.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Erste Einnahme hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : view === "liste" ? (
        /* ── LISTENANSICHT ─────────────────────────────────────── */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Kategorie</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Notiz</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Brutto</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">MwSt.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Netto</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Zahlung</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />Beleg</span>
                  </th>
                  <th className="px-3 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...einnahmen].sort((a, b) => b.datum.localeCompare(a.datum)).map((e) => {
                  const rate = e.steuersatz / 100;
                  const netto = rate > 0 ? Math.round((e.betrag / (1 + rate)) * 100) / 100 : e.betrag;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60 group">
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {new Date(e.datum).toLocaleDateString("de-DE")}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">
                        {e.kategorie}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs truncate max-w-[14rem]">
                        {e.beschreibung ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-emerald-700 whitespace-nowrap">
                        {formatCurrency(e.betrag)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {e.steuersatz > 0 ? (
                          <Badge variant="secondary">{e.steuersatz} %</Badge>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">
                        {formatCurrency(netto)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {e.zahlungsart === "BANK" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                            <Landmark className="h-3 w-3" /> Bank
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <Banknote className="h-3 w-3" /> Kasse
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {e.belegUrl ? (
                          <div className="inline-flex items-center gap-1">
                            <a
                              href={belegHref(e.belegUrl) ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium max-w-[8rem] truncate"
                              title={e.belegUrl}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{belegDisplayName(e.belegUrl)}</span>
                            </a>
                          </div>
                        ) : quickUploadId === e.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500 mx-auto" />
                        ) : (
                          <label
                            htmlFor={`quick-upload-${e.id}`}
                            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Beleg hochladen"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            <input
                              id={`quick-upload-${e.id}`}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
                              className="hidden"
                              onChange={(ev) => {
                                const file = ev.target.files?.[0];
                                if (file) handleQuickUpload(e.id, file);
                                ev.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button
                            onClick={() => openEdit(e)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                            title="Bearbeiten"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(e.id)}
                            disabled={deleting === e.id}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                            title="Löschen"
                          >
                            {deleting === e.id ? (
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
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-slate-700">
                    Gesamt ({einnahmen.length} Einträge)
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600 whitespace-nowrap">
                    {formatCurrency(gesamt)}
                  </td>
                  <td />
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 whitespace-nowrap">
                    {formatCurrency(gesamt - ustGesamt)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Kategorie</th>
                  {activeMonate.map((m) => (
                    <th key={m} className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {MONAT_LABELS[m]}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Gesamt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeKategorien.map((kat) => {
                  const katMap = pivot.get(kat)!;
                  const katGesamt = [...katMap.values()].flat().reduce((s, e) => s + e.betrag, 0);
                  return (
                    <tr key={kat} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{kat}</td>
                      {activeMonate.map((m) => {
                        const items = katMap.get(m);
                        const sum = items?.reduce((s, e) => s + e.betrag, 0) ?? 0;
                        return (
                          <td key={m} className="px-3 py-2.5 text-right">
                            {items ? (
                              <button
                                onClick={() => setCellModal({ kategorie: kat, monat: m })}
                                className="text-emerald-700 font-medium hover:underline cursor-pointer whitespace-nowrap"
                              >
                                {formatCurrency(sum)}
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(katGesamt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="px-4 py-2.5 text-xs font-bold text-slate-700">Gesamt</td>
                  {activeMonate.map((m) => {
                    const monatSum = einnahmen
                      .filter((e) => new Date(e.datum).getMonth() === m)
                      .reduce((s, e) => s + e.betrag, 0);
                    return (
                      <td key={m} className="px-3 py-2.5 text-right text-xs font-bold text-slate-700 whitespace-nowrap">
                        {formatCurrency(monatSum)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-600 whitespace-nowrap">
                    {formatCurrency(gesamt)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Zellen-Detail-Modal */}
      <Dialog open={!!cellModal} onOpenChange={(o) => !o && setCellModal(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {cellModal && `${cellModal.kategorie} – ${MONAT_LABELS[cellModal.monat]} ${year}`}
            </DialogTitle>
          </DialogHeader>
          {cellModal && (() => {
            const items = pivot.get(cellModal.kategorie)?.get(cellModal.monat) ?? [];
            const monatGesamt = items.reduce((s, e) => s + e.betrag, 0);
            const monatUst = items.reduce((s, e) => {
              const rate = e.steuersatz / 100;
              return s + (rate > 0 ? Math.round((e.betrag / (1 + rate)) * rate * 100) / 100 : 0);
            }, 0);
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Brutto</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">MwSt.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Netto</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Zahlung</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Notiz</th>
                      <th className="px-3 py-2 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((e) => {
                      const rate = e.steuersatz / 100;
                      const netto = rate > 0 ? Math.round((e.betrag / (1 + rate)) * 100) / 100 : e.betrag;
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/60 group">
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                            {new Date(e.datum).toLocaleDateString("de-DE")}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-emerald-700 whitespace-nowrap">
                            {formatCurrency(e.betrag)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {e.steuersatz > 0 ? (
                              <Badge variant="secondary">{e.steuersatz} %</Badge>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                            {formatCurrency(netto)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {e.zahlungsart === "BANK" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                                <Landmark className="h-3 w-3" /> Bank
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                                <Banknote className="h-3 w-3" /> Kasse
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-400 text-xs truncate max-w-[12rem]">
                            {e.beschreibung ?? ""}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setCellModal(null); openEdit(e); }}
                                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                                title="Bearbeiten"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(e.id)}
                                disabled={deleting === e.id}
                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                                title="Löschen"
                              >
                                {deleting === e.id ? (
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
                      <td className="px-3 py-2 text-xs font-bold text-slate-700">Gesamt</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-emerald-600">{formatCurrency(monatGesamt)}</td>
                      <td />
                      <td className="px-3 py-2 text-right text-xs font-bold text-slate-600">
                        {formatCurrency(monatGesamt - monatUst)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Einnahme bearbeiten" : "Neue Einnahme"}</DialogTitle>
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategorie <span className="text-red-500">*</span>
              </label>
              <select
                value={form.kategorie}
                onChange={(e) => setForm((f) => ({ ...f, kategorie: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {kategorien.map((k) => (
                  <option key={k} value={k}>{k}</option>
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {STEUERSAETZE.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vorschau Nettobetrag */}
            {parseFloat(form.betrag) > 0 && form.steuersatz > 0 && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700 space-y-0.5">
                <p><strong>Brutto:</strong> {formatCurrency(parseFloat(form.betrag))}</p>
                <p><strong>USt. ({form.steuersatz} %):</strong> {formatCurrency(Math.round((parseFloat(form.betrag) / (1 + form.steuersatz / 100)) * (form.steuersatz / 100) * 100) / 100)}</p>
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Beleg
                </span>
              </label>

              {/* Pending file preview */}
              {pendingFile ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
                  <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-emerald-800 truncate">{pendingFile.name}</p>
                    <p className="text-xs text-emerald-600">{(pendingFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    className="shrink-0 rounded-full p-0.5 hover:bg-emerald-100 text-emerald-500 hover:text-emerald-700"
                    title="Entfernen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : form.belegUrl ? (
                /* Existing uploaded beleg */
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                  <FileText className="h-5 w-5 text-gray-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={belegHref(form.belegUrl) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-emerald-600 hover:text-emerald-800 truncate block"
                      title={form.belegUrl}
                    >
                      {belegDisplayName(form.belegUrl)}
                    </a>
                    <p className="text-xs text-gray-400">Vorhandener Beleg · neuen hochladen zum Ersetzen</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, belegUrl: "" }))}
                    className="shrink-0 rounded-full p-0.5 hover:bg-gray-100 text-gray-400 hover:text-red-500"
                    title="Beleg entfernen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {/* Drag & drop zone — always shown so user can replace/add */}
              {!pendingFile && (
                <label
                  htmlFor="beleg-file-input"
                  onDragOver={(ev) => { ev.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    setDragOver(false);
                    const file = ev.dataTransfer.files[0];
                    if (file) handleFileDrop(file);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors select-none mt-2
                    ${dragOver ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50 text-gray-400"}`}
                >
                  <Upload className="h-6 w-6" />
                  <p className="text-sm font-medium">
                    {form.belegUrl ? "Anderen Beleg hochladen" : "Datei hier ablegen oder klicken"}
                  </p>
                  <p className="text-xs">PDF, JPG, PNG, WebP, GIF · max. 10 MB</p>
                </label>
              )}

              {uploadError && (
                <p className="mt-1.5 text-xs text-red-600 font-medium">{uploadError}</p>
              )}

              <input
                id="beleg-file-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileDrop(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={handleSave}
              disabled={saving || uploadingBeleg || !formValid}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {(saving || uploadingBeleg) && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploadingBeleg ? "Beleg wird hochgeladen…" : editingId ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
