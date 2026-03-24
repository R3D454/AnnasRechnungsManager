/**
 * Lineare Abschreibung (AfA) nach §7 EStG
 * Alle Geldwerte in Euro, 2 Dezimalstellen.
 */

export interface AnlagegutRaw {
  anschaffungskosten: number;
  nutzungsdauerJahre: number;
  restwert: number;
  anschaffungsdatum: string; // ISO-Datumsstring
  aktiv: boolean;
}

/** Volle Jahres-AfA */
export function jahresAfa(ak: number, restwert: number, nd: number): number {
  return Math.round(((ak - restwert) / nd) * 100) / 100;
}

/** Pro-rata AfA im Anschaffungsjahr: verbleibende Monate (inkl. Anschaffungsmonat) / 12 */
export function erwerbsjahrAfa(ak: number, restwert: number, nd: number, datum: Date): number {
  const verbleibendeMonathe = 12 - datum.getMonth(); // getMonth() = 0-basiert, Jan=0
  return Math.round((jahresAfa(ak, restwert, nd) * verbleibendeMonathe) / 12 * 100) / 100;
}

/** AfA für ein bestimmtes Kalenderjahr (0 wenn nicht erworben oder vollständig abgeschrieben) */
export function afaFuerJahr(asset: AnlagegutRaw, year: number): number {
  const acqDate = new Date(asset.anschaffungsdatum);
  const acqYear = acqDate.getFullYear();
  const lastDepYear = acqYear + asset.nutzungsdauerJahre - 1;

  if (year < acqYear || year > lastDepYear) return 0;

  const ak = asset.anschaffungskosten;
  const rv = asset.restwert;
  const nd = asset.nutzungsdauerJahre;

  return year === acqYear
    ? erwerbsjahrAfa(ak, rv, nd, acqDate)
    : jahresAfa(ak, rv, nd);
}

/** Kumulierte AfA vom Anschaffungsjahr bis inkl. gegebenem Jahr */
export function kumulierteAfa(asset: AnlagegutRaw, bisJahr: number): number {
  const acqYear = new Date(asset.anschaffungsdatum).getFullYear();
  let total = 0;
  for (let y = acqYear; y <= bisJahr; y++) {
    total += afaFuerJahr(asset, y);
  }
  return Math.round(total * 100) / 100;
}

/** Buchwert zum 31.12. des gegebenen Jahres (Minimum: Restwert) */
export function buchwert(asset: AnlagegutRaw, year: number): number {
  const acqYear = new Date(asset.anschaffungsdatum).getFullYear();
  if (year < acqYear) return asset.anschaffungskosten;
  const bw = asset.anschaffungskosten - kumulierteAfa(asset, year);
  return Math.max(Math.round(bw * 100) / 100, asset.restwert);
}

/** Anzeige-Status eines Anlageguts */
export function assetStatus(asset: AnlagegutRaw, currentYear: number): "aktiv" | "vollständig abgeschrieben" | "inaktiv" {
  if (!asset.aktiv) return "inaktiv";
  const acqYear = new Date(asset.anschaffungsdatum).getFullYear();
  const lastDepYear = acqYear + asset.nutzungsdauerJahre - 1;
  if (currentYear > lastDepYear) return "vollständig abgeschrieben";
  return "aktiv";
}
