import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { ChevronLeft, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { formatCurrency } from "@/lib/tax";
import { useLoaderData, Link, useRevalidator } from "react-router";

type Transaction = {
  id: string;
  date: string;
  account: 'kasse' | 'bank';
  type: 'einlage' | 'entnahme';
  amount: number;
  description: string;
  isBusinessRecord: boolean;
  kategorie: string | null;
};

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!company) throw new Response("Company not Found", { status: 404 });

  const buchungen = await prisma.buchung.findMany({
    where: { companyId: company.id },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      date: true,
      account: true,
      type: true,
      amount: true,
      description: true,
      isBusinessRecord: true,
      kategorie: true,
    },
  });

  const transactions: Transaction[] = buchungen.map((b): Transaction => ({
    id: b.id,
    date: b.date.toISOString().split('T')[0],
    account: b.account === 'BANK' ? 'bank' : 'kasse',
    type: b.type === 'EINLAGE' ? 'einlage' : 'entnahme',
    amount: Number(b.amount),
    description: b.description || '',
    isBusinessRecord: b.isBusinessRecord,
    kategorie: b.kategorie || null,
  }));

  const balance = transactions.reduce((sum: number, t: Transaction) => sum + (t.type === 'einlage' ? t.amount : -t.amount), 0);
  return {
    companyId: company.id,
    companyName: company.name,
    transactions,
    balance,
  };
}

export default function CompanyMoney() {
  const { transactions: initialTransactions, companyId, companyName, balance } =
  useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isUmbuchung, setIsUmbuchung] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    account: 'kasse' as 'kasse' | 'bank',
    type: 'einlage' as 'einlage' | 'entnahme',
    amount: '',
    description: '',
    toAccount: 'bank' as 'kasse' | 'bank',
  });

  function openCreate() {
    setEditingTransaction(null);
    setIsUmbuchung(false);
    setForm({
      date: new Date().toISOString().split('T')[0],
      account: 'kasse',
      type: 'einlage',
      amount: '',
      description: '',
      toAccount: 'bank',
    });
    setDialogOpen(true);
  }

  function openCreateUmbuchung() {
    setEditingTransaction(null);
    setIsUmbuchung(true);
    setForm({
      date: new Date().toISOString().split('T')[0],
      account: 'kasse',
      type: 'umbuchung',
      amount: '',
      description: '',
      toAccount: 'bank',
    });
    setDialogOpen(true);
  }

  function openEdit(transaction: Transaction) {
    setEditingTransaction(transaction);
    setForm({
      date: transaction.date,
      account: transaction.account,
      type: transaction.type,
      amount: String(transaction.amount),
      description: transaction.description,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = isUmbuchung
      ? {
          date: form.date,
          account: form.account,
          type: 'umbuchung',
          toAccount: form.toAccount,
          amount: parseFloat(form.amount),
          description: form.description,
        }
      : {
          date: form.date,
          account: form.account,
          type: form.type,
          amount: parseFloat(form.amount),
          description: form.description,
        };

    try {
      if (editingTransaction) {
        const res = await fetch(`/api/companies/${companyId}/money?transactionId=${editingTransaction.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const error = await res.json();
          alert(error.error || "Fehler beim Speichern");
          return;
        }
      } else {
        const res = await fetch(`/api/companies/${companyId}/money`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const error = await res.json();
          alert(error.error || "Fehler beim Speichern");
          return;
        }
      }
      setDialogOpen(false);
      revalidate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Transaktion wirklich löschen?")) return;
    setDeleting(id);
    await fetch(`/api/companies/${companyId}/money?transactionId=${id}`, { method: "DELETE" });
    setDeleting(null);
    revalidate();
  }

  const sortedTransactions = [...initialTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const kasseBalance = initialTransactions
    .filter((t) => t.account === 'kasse')
    .reduce((sum, t) => sum + (t.type === 'einlage' ? t.amount : -t.amount), 0);
  const bankBalance = initialTransactions
    .filter((t) => t.account === 'bank')
    .reduce((sum, t) => sum + (t.type === 'einlage' ? t.amount : -t.amount), 0);

  const formValid = form.date && form.amount && parseFloat(form.amount) > 0;

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
          <h1 className="text-2xl font-bold text-gray-900">Kasse und Bank</h1>
          <p className="text-gray-500 mt-1">
            {companyName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openCreateUmbuchung} variant="outline">
            <Plus className="h-4 w-4" />
            Umbuchung
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Neue Transaktion
          </Button>
        </div>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Kasse (Saldo)</p>
            <p className="text-xl font-bold text-indigo-700">{formatCurrency(kasseBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Bank (Saldo)</p>
            <p className="text-xl font-bold text-teal-700">{formatCurrency(bankBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Gesamter Kontostand</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(balance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Split-View: Kasse und Bank nebeneinander */}
      {sortedTransactions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <p className="text-sm">Noch keine Transaktionen erfasst.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Erste Transaktion hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Kasse Tabelle */}
          <Card>
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-700">Kasse</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Datum
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Typ
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Beschreibung
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Kategorie
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Betrag
                    </th>
                    <th className="px-3 py-2.5 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTransactions
                    .filter((t) => t.account === 'kasse')
                    .map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-slate-50/60 group">
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          {transaction.date}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          <Badge variant={transaction.type === 'einlage' ? 'default' : 'destructive'}>
                            {transaction.type === 'einlage' ? 'Einlage' : 'Entnahme'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {transaction.description}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 text-xs">
                          {transaction.kategorie || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                          <span className={transaction.type === 'einlage' ? 'text-green-600' : 'text-red-600'}>
                            {transaction.type === 'einlage' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {transaction.isBusinessRecord ? (
                            <span className="text-xs text-gray-500 font-medium">
                              Automatisch
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEdit(transaction)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                                title="Bearbeiten"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(transaction.id)}
                                disabled={deleting === transaction.id}
                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                                title="Löschen"
                              >
                                {deleting === transaction.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Bank Tabelle */}
          <Card>
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-700">Bank</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Datum
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Typ
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Beschreibung
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Kategorie
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Betrag
                    </th>
                    <th className="px-3 py-2.5 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTransactions
                    .filter((t) => t.account === 'bank')
                    .map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-slate-50/60 group">
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          {transaction.date}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          <Badge variant={transaction.type === 'einlage' ? 'default' : 'destructive'}>
                            {transaction.type === 'einlage' ? 'Einlage' : 'Entnahme'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {transaction.description}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 text-xs">
                          {transaction.kategorie || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                          <span className={transaction.type === 'einlage' ? 'text-green-600' : 'text-red-600'}>
                            {transaction.type === 'einlage' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {transaction.isBusinessRecord ? (
                            <span className="text-xs text-gray-500 font-medium">
                              Automatisch
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEdit(transaction)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                                title="Bearbeiten"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(transaction.id)}
                                disabled={deleting === transaction.id}
                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                                title="Löschen"
                              >
                                {deleting === transaction.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Dialog: Anlegen / Bearbeiten */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? "Transaktion bearbeiten" : "Neue Transaktion"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {isUmbuchung ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Von (Konto) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.account}
                    onChange={(e) => setForm((f) => ({ ...f, account: e.target.value as 'kasse' | 'bank', toAccount: e.target.value === 'kasse' ? 'bank' : 'kasse' }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="kasse">Kasse</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nach (Konto)
                  </label>
                  <div className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50">
                    {form.toAccount === 'kasse' ? 'Kasse' : 'Bank'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Konto <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.account}
                    onChange={(e) => setForm((f) => ({ ...f, account: e.target.value as 'kasse' | 'bank' }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="kasse">Kasse</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Typ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'einlage' | 'entnahme' }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="einlage">Einnahme (Einlage)</option>
                    <option value="entnahme">Ausgabe (Entnahme)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Betrag (€) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beschreibung
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="z.B. Barentnahme, Gehalt"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving || !formValid}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTransaction ? "Speichern" : isUmbuchung ? "Umbuchung durchführen" : "Hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}