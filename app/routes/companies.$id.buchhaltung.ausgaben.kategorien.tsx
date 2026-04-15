import { useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { DEFAULT_AUSGABE_KATEGORIEN } from "@/lib/kategorie-defaults";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Buchhaltung", href: `/companies/${data.companyId}/buchhaltung/bilanzen` },
    { label: "Betriebsausgaben", href: `/companies/${data.companyId}/buchhaltung/ausgaben` },
    { label: "Kategorien" },
  ],
};

interface Kategorie {
  id: string;
  name: string;
  inUse: boolean;
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  // Auto-seed Standardkategorien wenn noch keine vorhanden
  const existing = await prisma.buchungKategorie.count({
    where: { companyId: params.id, typ: "AUSGABE" },
  });
  if (existing === 0) {
    await prisma.buchungKategorie.createMany({
      data: DEFAULT_AUSGABE_KATEGORIEN.map((name) => ({
        companyId: params.id,
        name,
        typ: "AUSGABE",
      })),
      skipDuplicates: true,
    });
  }

  const kats = await prisma.buchungKategorie.findMany({
    where: { companyId: params.id, typ: "AUSGABE" },
    orderBy: { name: "asc" },
  });

  const withUsage = await Promise.all(
    kats.map(async (k) => ({
      id: k.id,
      name: k.name,
      inUse:
        (await prisma.buchung.count({
          where: { companyId: params.id, kategorie: k.name, isBusinessRecord: true },
        })) > 0,
    }))
  );

  return {
    companyId: company.id,
    companyName: company.name,
    kategorien: withUsage,
  };
}

export default function AusgabenKategorienPage() {
  const { kategorien: initialKategorien, companyId, companyName } =
    useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const [kategorien, setKategorien] = useState<Kategorie[]>(initialKategorien);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");

  async function reload() {
    const res = await fetch(`/api/companies/${companyId}/buchungkategorien?typ=AUSGABE`);
    const data: Kategorie[] = await res.json();
    setKategorien(data);
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setNameError("");
    setDialogOpen(true);
  }

  function openEdit(k: Kategorie) {
    setEditingId(k.id);
    setName(k.name);
    setNameError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) { setNameError("Name ist erforderlich"); return; }
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/companies/${companyId}/buchungkategorien/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) { setNameError("Fehler beim Speichern"); return; }
      } else {
        const res = await fetch(`/api/companies/${companyId}/buchungkategorien`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), typ: "AUSGABE" }),
        });
        if (!res.ok) { setNameError("Kategorie existiert bereits"); return; }
      }
      setDialogOpen(false);
      await reload();
      revalidate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(k: Kategorie) {
    if (!confirm(`Kategorie "${k.name}" wirklich löschen?`)) return;
    setDeleting(k.id);
    const res = await fetch(`/api/companies/${companyId}/buchungkategorien/${k.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Löschen fehlgeschlagen");
    } else {
      await reload();
      revalidate();
    }
    setDeleting(null);
  }

  return (
    <div>
      <Link
        to={`/companies/${companyId}/buchhaltung/ausgaben`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zu Betriebsausgaben
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ausgaben-Kategorien</h1>
          <p className="text-gray-500 mt-1">{companyName}</p>
        </div>
        <Button onClick={openCreate} className="bg-rose-600 hover:bg-rose-700">
          <Plus className="h-4 w-4" />
          Neue Kategorie
        </Button>
      </div>

      {kategorien.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <p className="text-sm">Noch keine Kategorien vorhanden.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Erste Kategorie anlegen
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
                    Name
                  </th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    In Verwendung
                  </th>
                  <th className="px-3 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kategorien.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/60 group">
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{k.name}</td>
                    <td className="px-3 py-2.5 text-center">
                      {k.inUse ? (
                        <span className="text-xs text-emerald-600 font-medium">Ja</span>
                      ) : (
                        <span className="text-xs text-slate-400">Nein</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(k)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                          title="Umbenennen"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(k)}
                          disabled={k.inUse || deleting === k.id}
                          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={k.inUse ? "Wird verwendet – kann nicht gelöscht werden" : "Löschen"}
                        >
                          {deleting === k.id ? (
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
            </table>
          </div>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Kategorie umbenennen" : "Neue Kategorie"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="z.B. Marketingkosten"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              autoFocus
            />
            {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
