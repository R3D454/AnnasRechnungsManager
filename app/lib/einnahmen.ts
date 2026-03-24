export const EINNAHME_KATEGORIEN = [
  "FUSSPFLEGE",
  "PRIVATEINLAGEN",
  "DARLEHEN",
  "STEUERERSTATTUNGEN",
  "VERSICHERUNGSERSTATTUNGEN",
  "ZINSERTRAEGE",
  "VERMIETUNG_VERPACHTUNG",
  "VERAEUSSERUNGSERLOES",
  "EIGENVERBRAUCH",
  "SONSTIGE_EINNAHMEN",
] as const;

export type EinnahmeKategorieKey = typeof EINNAHME_KATEGORIEN[number];

export const EINNAHME_LABELS: Record<EinnahmeKategorieKey, string> = {
  FUSSPFLEGE: "Fußpflege/Verkauf/Gutscheine",
  PRIVATEINLAGEN: "Privateinlagen",
  DARLEHEN: "Darlehen",
  STEUERERSTATTUNGEN: "Steuererstattungen",
  VERSICHERUNGSERSTATTUNGEN: "Versicherungserstattungen",
  ZINSERTRAEGE: "Zinserträge",
  VERMIETUNG_VERPACHTUNG: "Miet-/Pachteinnahmen",
  VERAEUSSERUNGSERLOES: "Veräußerungserlöse",
  EIGENVERBRAUCH: "Eigenverbrauch",
  SONSTIGE_EINNAHMEN: "Sonstige Einnahmen",
};
