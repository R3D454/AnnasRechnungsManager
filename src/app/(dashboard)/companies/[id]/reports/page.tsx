"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/tax";
import { ChevronLeft, TrendingUp, BarChart3 } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

interface TaxGroup {
  netAmount: number;
  taxAmount: number;
}

interface MonthData {
  month: number;
  invoiceCount: number;
  netTotal: number;
  taxTotal: number;
  grossTotal: number;
  taxGroups: Record<string, TaxGroup>;
}

interface QuarterData {
  quarter: number;
  invoiceCount: number;
  netTotal: number;
  taxTotal: number;
  grossTotal: number;
  taxGroups: Record<string, TaxGroup>;
}

interface ReportData {
  year: number;
  monthly: MonthData[];
  quarterly: QuarterData[];
  yearTotal: {
    invoiceCount: number;
    netTotal: number;
    taxTotal: number;
    grossTotal: number;
  };
}

export default function ReportsPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?companyId=${companyId}&year=${year}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [companyId, year]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div>
      <Link
        href={`/companies/${companyId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="h-4 w-4" /> Zurück zum Mandanten
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Steuerberichte</h1>
          <p className="text-gray-500 mt-1">Auswertungen für Steuererklärung und USt-Voranmeldung</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Lade Auswertung...</div>
      ) : data && (
        <div className="space-y-6">
          {/* Year Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-1">Rechnungen</p>
                <p className="text-2xl font-bold text-gray-900">{data.yearTotal.invoiceCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-1">Umsatz (netto)</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.yearTotal.netTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-1">USt. gesamt</p>
                <p className="text-2xl font-bold text-indigo-600">{formatCurrency(data.yearTotal.taxTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-1">Umsatz (brutto)</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.yearTotal.grossTotal)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Quarterly UStVA */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                <CardTitle>USt-Voranmeldung (quartalsweise)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-3 text-gray-500 font-medium">Quartal</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">Rechnungen</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">Netto</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">USt. 19%</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">USt. 7%</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">USt. gesamt</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">Brutto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.quarterly.map((q) => (
                      <tr key={q.quarter} className="hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">Q{q.quarter} {year}</td>
                        <td className="py-3 text-right text-gray-700">{q.invoiceCount}</td>
                        <td className="py-3 text-right text-gray-700">{formatCurrency(q.netTotal)}</td>
                        <td className="py-3 text-right text-gray-700">
                          {q.taxGroups["19"] ? formatCurrency(q.taxGroups["19"].taxAmount) : "—"}
                        </td>
                        <td className="py-3 text-right text-gray-700">
                          {q.taxGroups["7"] ? formatCurrency(q.taxGroups["7"].taxAmount) : "—"}
                        </td>
                        <td className="py-3 text-right font-medium text-indigo-700">{formatCurrency(q.taxTotal)}</td>
                        <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(q.grossTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td className="pt-3 font-bold text-gray-900">Gesamt {year}</td>
                      <td className="pt-3 text-right font-bold text-gray-900">{data.yearTotal.invoiceCount}</td>
                      <td className="pt-3 text-right font-bold text-gray-900">{formatCurrency(data.yearTotal.netTotal)}</td>
                      <td className="pt-3 text-right font-bold text-gray-900">
                        {formatCurrency(data.quarterly.reduce((s, q) => s + (q.taxGroups["19"]?.taxAmount ?? 0), 0))}
                      </td>
                      <td className="pt-3 text-right font-bold text-gray-900">
                        {formatCurrency(data.quarterly.reduce((s, q) => s + (q.taxGroups["7"]?.taxAmount ?? 0), 0))}
                      </td>
                      <td className="pt-3 text-right font-bold text-indigo-700">{formatCurrency(data.yearTotal.taxTotal)}</td>
                      <td className="pt-3 text-right font-bold text-gray-900">{formatCurrency(data.yearTotal.grossTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Monthly breakdown */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                <CardTitle>Monatliche Übersicht</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-3 text-gray-500 font-medium">Monat</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">Rechnungen</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">Netto</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">USt.</th>
                      <th className="text-right pb-3 text-gray-500 font-medium">Brutto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.monthly.map((m) => (
                      <tr key={m.month} className={`hover:bg-gray-50 ${m.invoiceCount === 0 ? "opacity-40" : ""}`}>
                        <td className="py-2.5 font-medium text-gray-900">{MONTHS[m.month - 1]} {year}</td>
                        <td className="py-2.5 text-right text-gray-700">{m.invoiceCount || "—"}</td>
                        <td className="py-2.5 text-right text-gray-700">
                          {m.netTotal > 0 ? formatCurrency(m.netTotal) : "—"}
                        </td>
                        <td className="py-2.5 text-right text-indigo-700">
                          {m.taxTotal > 0 ? formatCurrency(m.taxTotal) : "—"}
                        </td>
                        <td className="py-2.5 text-right font-medium text-gray-900">
                          {m.grossTotal > 0 ? formatCurrency(m.grossTotal) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
