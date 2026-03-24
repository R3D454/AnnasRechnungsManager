import { useState, useCallback } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/tax";
import { EINNAHME_KATEGORIEN, EINNAHME_LABELS, type EinnahmeKategorieKey } from "@/lib/einnahmen";

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Sonstige Einnahmen" },
  ],
};

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

interface Einnahme {
  id: string;
  kategorie: EinnahmeKategorieKey;
  betrag: number;
  datum: string;
}

type GridCell = { ids: string[]; betrag: number };
type GridData = Record<string, Record<number, GridCell>>;

/**
 * Builds a grid data structure from the given einnahmen array.
 * The grid has the shape of { [kategorie]: { [month]: { ids: string[]; betrag: number } } }
 * where each month has a list of einnahmen ids and the sum of their betrage.
 *
 * @param {Einnahme[]} einnahmen - The array of einnahmen to build the grid from.
 * @returns {GridData} - The built grid data structure.
 */
function buildGrid(einnahmen: Einnahme[]): GridData {
  const grid: GridData = {};
  for (const k of EINNAHME_KATEGORIEN) {
    grid[k] = {};
    for (let m = 1; m <= 12; m++) grid[k][m] = { ids: [], betrag: 0 };
  }
  for (const e of einnahmen) {
    const month = new Date(e.datum).getMonth() + 1;
    if (grid[e.kategorie]?.[month] !== undefined) {
      grid[e.kategorie][month].ids.push(e.id);
      grid[e.kategorie][month].betrag += e.betrag;
    }
  }
  return grid;
}

/**
 * Loads the data for the EinnahmenPage.
 *
 * @param {Request} request - The request object.
 * @param {Object} params - The route parameters.
 * @param {string} params.id - The id of the company.
 *
 * @returns {Promise<Object>} - A promise resolving to an object containing the company data and the initial year.
 *
 * @throws {Response} - If the company is not found.
 */
export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!company) throw new Response("Not Found", { status: 404 });

  const year = new Date().getFullYear();
  const einnahmen = await prisma.betriebseinnahme.findMany({
    where: {
      companyId: params.id,
      datum: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
    },
    orderBy: { datum: "asc" },
  });

  return {
    companyId: company.id,
    companyName: company.name,
    initialYear: year,
    einnahmen: einnahmen.map((e) => ({
      id: e.id,
      kategorie: e.kategorie as EinnahmeKategorieKey,
      betrag: Number(e.betrag),
      datum: e.datum.toISOString(),
    })),
  };
}

/**
 * The EinnahmenPage component displays a table of the company's expenses
 * for the selected year. It allows the user to edit the expenses and save
 * the changes.
 *
 * @returns {JSX.Element} - The EinnahmenPage component.
 */
export default function EinnahmenPage() {
  const { einnahmen: initialEinnahmen, companyId, companyName, initialYear } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();

  const [year, setYear] = useState(initialYear);
  const [grid, setGrid] = useState<GridData>(() => buildGrid(initialEinnahmen));
  const [loadingYear, setLoadingYear] = useState(false);

  const [editingCell, setEditingCell] = useState<{ kategorie: string; month: number } | null>(null);
  const [cellInput, setCellInput] = useState("");
  const [savingCell, setSavingCell] = useState<{ kategorie: string; month: number } | null>(null);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  /**
   * Load the expenses for the given year.
   *
   * @param {number} y - The year to load the expenses for.
   */
  async function loadYear(y: number) {
    setEditingCell(null);
    setYear(y);
    setLoadingYear(true);
    const res = await fetch(`/api/einnahmen?companyId=${companyId}&year=${y}`);
    const data: Einnahme[] = await res.json();
    setGrid(buildGrid(data));
    setLoadingYear(false);
  }

  function startEdit(kategorie: string, month: number) {
    if (savingCell) return;
    const cell = grid[kategorie]?.[month];
    setEditingCell({ kategorie, month });
    setCellInput(cell?.betrag ? String(cell.betrag) : "");
  }

  const commitCell = useCallback(async () => {
    if (!editingCell) return;
    const { kategorie, month } = editingCell;
    setEditingCell(null);

    const newBetrag = parseFloat(cellInput.replace(",", ".")) || 0;
    const cell = grid[kategorie]?.[month];
    const oldBetrag = cell?.betrag ?? 0;

    if (newBetrag === oldBetrag) return;

    setSavingCell({ kategorie, month });

    try {
      if (newBetrag <= 0 && cell?.ids.length) {
        await Promise.all(
          cell.ids.map((id) => fetch(`/api/einnahmen/${id}`, { method: "DELETE" }))
        );
        setGrid((g) => {
          const next = { ...g };
          next[kategorie] = { ...next[kategorie], [month]: { ids: [], betrag: 0 } };
          return next;
        });
      } else if (newBetrag > 0 && cell?.ids.length === 1) {
        await fetch(`/api/einnahmen/${cell.ids[0]}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kategorie,
            betrag: newBetrag,
            datum: `${year}-${String(month).padStart(2, "0")}-01`,
          }),
        });
        setGrid((g) => {
          const next = { ...g };
          next[kategorie] = { ...next[kategorie], [month]: { ids: cell.ids, betrag: newBetrag } };
          return next;
        });
      } else if (newBetrag > 0 && (cell?.ids.length ?? 0) > 1) {
        await Promise.all(
          cell!.ids.map((id) => fetch(`/api/einnahmen/${id}`, { method: "DELETE" }))
        );
        const res = await fetch("/api/einnahmen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            kategorie,
            betrag: newBetrag,
            datum: `${year}-${String(month).padStart(2, "0")}-01`,
          }),
        });
        const created: Einnahme = await res.json();
        setGrid((g) => {
          const next = { ...g };
          next[kategorie] = { ...next[kategorie], [month]: { ids: [created.id], betrag: newBetrag } };
          return next;
        });
      } else if (newBetrag > 0) {
        const res = await fetch("/api/einnahmen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            kategorie,
            betrag: newBetrag,
            datum: `${year}-${String(month).padStart(2, "0")}-01`,
          }),
        });
        const created: Einnahme = await res.json();
        setGrid((g) => {
          const next = { ...g };
          next[kategorie] = { ...next[kategorie], [month]: { ids: [created.id], betrag: newBetrag } };
          return next;
        });
      }

      revalidate();
    } finally {
      setSavingCell(null);
    }
  }, [editingCell, cellInput, grid, companyId, year, revalidate]);

  // Berechnungen
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<number, number> = {};
  let grandTotal = 0;

  for (const k of EINNAHME_KATEGORIEN) {
    rowTotals[k] = 0;
    for (let m = 1; m <= 12; m++) {
      const b = grid[k]?.[m]?.betrag ?? 0;
      rowTotals[k] += b;
      colTotals[m] = (colTotals[m] ?? 0) + b;
      grandTotal += b;
    }
  }

  const topKategorien = [...EINNAHME_KATEGORIEN]
    .filter((k) => rowTotals[k] > 0)
    .sort((a, b) => rowTotals[b] - rowTotals[a])
    .slice(0, 2);

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
        <select
          value={year}
          onChange={(e) => loadYear(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Zusammenfassung */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Gesamt {year}</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(grandTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-gray-500 mb-1">Kategorien mit Einträgen</p>
            <p className="text-xl font-bold text-gray-900">
              {EINNAHME_KATEGORIEN.filter((k) => rowTotals[k] > 0).length}
            </p>
          </CardContent>
        </Card>
        {topKategorien.map((k) => (
          <Card key={k}>
            <CardContent className="pt-5 pb-5">
              <p className="text-xs text-gray-500 mb-1 truncate">{EINNAHME_LABELS[k]}</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(rowTotals[k])}</p>
            </CardContent>
          </Card>
        ))}
        {topKategorien.length < 2 && Array.from({ length: 2 - topKategorien.length }).map((_, i) => (
          <div key={i} />
        ))}
      </div>

      {/* Matrix-Tabelle */}
      {loadingYear ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Lade Einnahmen...
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed border-collapse">
              <colgroup>
                <col style={{ width: "180px" }} />
                {MONTHS.map((_, i) => <col key={i} style={{ width: "72px" }} />)}
                <col style={{ width: "88px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Kategorie
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="px-1 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {m}
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Gesamt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {EINNAHME_KATEGORIEN.map((kat) => (
                  <tr key={kat} className="hover:bg-slate-50/60 group">
                    <td className="px-3 py-1.5 text-xs font-medium text-slate-700 truncate">
                      {EINNAHME_LABELS[kat]}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const cell = grid[kat]?.[month];
                      const betrag = cell?.betrag ?? 0;
                      const isEditing = editingCell?.kategorie === kat && editingCell?.month === month;
                      const isSaving = savingCell?.kategorie === kat && savingCell?.month === month;

                      return (
                        <td
                          key={month}
                          className={`px-1 py-1 text-right align-middle ${isEditing ? "bg-emerald-50" : ""}`}
                        >
                          {isSaving ? (
                            <span className="flex justify-end pr-1">
                              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                            </span>
                          ) : isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              value={cellInput}
                              onChange={(e) => setCellInput(e.target.value)}
                              onBlur={commitCell}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); commitCell(); }
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="w-full text-right text-sm border border-emerald-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(kat, month)}
                              disabled={!!savingCell}
                              className={`w-full text-right text-xs px-1 py-0.5 rounded transition-colors
                                ${betrag > 0
                                  ? "text-slate-800 font-medium"
                                  : "text-transparent group-hover:text-slate-300 hover:!text-slate-500"}
                                hover:bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-300`}
                            >
                              {betrag > 0
                                ? betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : "—"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className={`px-2 py-1.5 text-right text-xs font-semibold ${rowTotals[kat] > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                      {rowTotals[kat] > 0
                        ? rowTotals[kat].toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="px-3 py-2.5 text-xs font-bold text-slate-700">Gesamt</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <td key={month} className={`px-1 py-2.5 text-right text-xs font-bold ${colTotals[month] > 0 ? "text-slate-800" : "text-slate-300"}`}>
                      {colTotals[month] > 0
                        ? colTotals[month].toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right text-xs font-bold text-emerald-600">
                    {grandTotal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-3 py-2 border-t border-slate-100 text-xs text-slate-400">
            Zelle anklicken zum Bearbeiten · Enter speichern · Escape abbrechen · 0 löscht den Eintrag
          </div>
        </Card>
      )}
    </div>
  );
}
