import { useState, useEffect } from "react";
import { Link, useLoaderData } from "react-router";
import { requireUser } from "@/session.server";
import prisma from "@/lib/prisma.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/tax";
import { ChevronLeft, Scale, TrendingUp, Info } from "lucide-react";
import { KATEGORIE_LABELS } from "@/lib/ausgaben";

export const handle = {
  breadcrumbs: (data: { companyId: string; companyName: string }) => [
    { label: "Mandanten", href: "/companies" },
    { label: data.companyName, href: `/companies/${data.companyId}` },
    { label: "Bilanzen" },
  ],
};

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const user = await requireUser(request);
  const company = await prisma.company.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!company) throw new Response("Not Found", { status: 404 });
  return { companyId: company.id, companyName: company.name };
}

interface ErloeseByRate {
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

interface BilanzenData {
  year: number;
  kleinunternehmer: boolean;
  guv: {
    erloeseByRate: Record<string, ErloeseByRate>;
    netTotal: number;
    taxTotal: number;
    grossTotal: number;
    invoiceCount: number;
    ausgabenGesamt: number;
    ausgabenByKategorie: { kategorie: string; betrag: number }[];
    sonstigeEinnahmen: number;
    jahresergebnis: number;
  };
  bilanz: {
    aktiva: {
      forderungen: { betrag: number; anzahl: number };
      bank: { betrag: number; anzahl: number };
      summe: number;
    };
    passiva: {
      eigenkapital: number;
      summe: number;
    };
  };
}

function Row({ label, value, bold, indent, muted }: {
  label: string;
  value?: number;
  bold?: boolean;
  indent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between py-2 ${bold ? "border-t border-gray-200 mt-1" : "border-b border-gray-50"}`}>
      <span className={`text-sm ${indent ? "ml-4" : ""} ${bold ? "font-semibold text-gray-900" : muted ? "text-gray-400" : "text-gray-700"}`}>
        {label}
      </span>
      {value !== undefined ? (
        <span className={`text-sm tabular-nums ${bold ? "font-bold text-gray-900" : muted ? "text-gray-400" : "text-gray-800"}`}>
          {formatCurrency(value)}
        </span>
      ) : null}
    </div>
  );
}

export default function BilanzenPage() {
  const { companyId } = useLoaderData<typeof loader>();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<BilanzenData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bilanzen?companyId=${companyId}&year=${year}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [companyId, year]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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
          <h1 className="text-2xl font-bold text-gray-900">Bilanzen</h1>
          <p className="text-gray-500 mt-1">Bilanz und Gewinn- & Verlustrechnung</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Lade Auswertung...</div>
      ) : data && (
        <div className="space-y-6">
          {/* Zusammenfassung */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-1">Umsatz (netto)</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.guv.netTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-1">Betriebsausgaben</p>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(data.guv.ausgabenGesamt)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-1">Jahresergebnis</p>
                <p className={`text-2xl font-bold ${data.guv.jahresergebnis >= 0 ? "text-teal-600" : "text-red-600"}`}>
                  {formatCurrency(data.guv.jahresergebnis)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500 mb-1">Bilanzsumme</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.bilanz.aktiva.summe)}</p>
              </CardContent>
            </Card>
          </div>

          {/* GuV */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-600" />
                <CardTitle>Gewinn- und Verlustrechnung (GuV) {year}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-w-lg">
                <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-3">Erträge</p>

                {Object.entries(data.guv.erloeseByRate)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([rate, group]) => (
                    <Row
                      key={rate}
                      label={
                        data.kleinunternehmer
                          ? "Umsatzerlöse (steuerfrei)"
                          : `Umsatzerlöse ${Number(rate) > 0 ? `${rate}% MwSt.` : "steuerfrei"}`
                      }
                      value={group.netAmount}
                      indent
                    />
                  ))}

                {!data.kleinunternehmer && data.guv.taxTotal > 0 && (
                  <Row label="Umsatzsteuer" value={data.guv.taxTotal} indent muted />
                )}

                <Row label="Summe Umsatzerlöse (netto)" value={data.guv.netTotal} bold />

                {data.guv.sonstigeEinnahmen > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-3">Sonstige Einnahmen</p>
                    <Row label="Privateinlagen, Erstattungen u.a." value={data.guv.sonstigeEinnahmen} indent />
                    <Row label="Summe Sonstige Einnahmen" value={data.guv.sonstigeEinnahmen} bold />
                  </div>
                )}

                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-3">Aufwendungen</p>
                  {data.guv.ausgabenByKategorie.length > 0 ? (
                    data.guv.ausgabenByKategorie
                      .sort((a, b) => b.betrag - a.betrag)
                      .map((a) => (
                        <Row
                          key={a.kategorie}
                          label={KATEGORIE_LABELS[a.kategorie as keyof typeof KATEGORIE_LABELS] ?? a.kategorie}
                          value={a.betrag}
                          indent
                        />
                      ))
                  ) : (
                    <Row label="Betriebsausgaben" value={0} indent muted />
                  )}
                  <Row label="Summe Aufwendungen" value={data.guv.ausgabenGesamt} bold />
                </div>

                <div className="mt-6 pt-3 border-t-2 border-teal-200">
                  <div className="flex justify-between py-2">
                    <span className="text-base font-bold text-gray-900">
                      {data.guv.jahresergebnis >= 0 ? "Jahresüberschuss" : "Jahresfehlbetrag"}
                    </span>
                    <span className={`text-base font-bold ${data.guv.jahresergebnis >= 0 ? "text-teal-600" : "text-red-600"}`}>
                      {formatCurrency(data.guv.jahresergebnis)}
                    </span>
                  </div>
                </div>

                {data.guv.ausgabenGesamt === 0 && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Noch keine Betriebsausgaben für {data.year} erfasst.
                      Ausgaben können über die <a href={`/companies/${companyId}/ausgaben`} className="underline">Ausgaben-Seite</a> gepflegt werden.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bilanz */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Aktiva */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-teal-600" />
                  <CardTitle>Aktiva – Stichtag 31.12.{year}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-3">Umlaufvermögen</p>
                <Row
                  label={`Forderungen aus L+L (${data.bilanz.aktiva.forderungen.anzahl} offen)`}
                  value={data.bilanz.aktiva.forderungen.betrag}
                  indent
                />
                <Row
                  label={`Bank / Kasse (${data.bilanz.aktiva.bank.anzahl} bezahlt)`}
                  value={data.bilanz.aktiva.bank.betrag}
                  indent
                />
                <Row label="Summe Aktiva" value={data.bilanz.aktiva.summe} bold />

                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500">
                    Bank/Kasse ist eine Näherung auf Basis bezahlter Rechnungen (kumuliert bis Jahresende).
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Passiva */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-teal-600" />
                  <CardTitle>Passiva – Stichtag 31.12.{year}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-3">Eigenkapital</p>
                <Row label="Eigenkapital (vereinfacht)" value={data.bilanz.passiva.eigenkapital} indent />

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-3">Verbindlichkeiten</p>
                  <Row label="Verbindlichkeiten" value={0} indent muted />
                </div>

                <Row label="Summe Passiva" value={data.bilanz.passiva.summe} bold />

                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500">
                    Verbindlichkeiten werden nicht erfasst. Das Eigenkapital entspricht vereinfacht der Aktivseite.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
