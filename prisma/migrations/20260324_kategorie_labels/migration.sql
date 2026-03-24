-- Migration: Buchung.kategorie Keys → Anzeigelabels
-- Ausgaben (ENTNAHME)
UPDATE buchungen SET kategorie = 'Waren, Rohstoffe, Hilfsstoffe'      WHERE kategorie = 'WAREN_ROHSTOFFE';
UPDATE buchungen SET kategorie = 'Geringwertige Wirtschaftsgüter'      WHERE kategorie = 'GERINGWERTIGE_WIRTSCHAFTSGUETER';
UPDATE buchungen SET kategorie = 'Abschreibungen'                      WHERE kategorie = 'ABSCHREIBUNGEN';
UPDATE buchungen SET kategorie = 'Miete'                               WHERE kategorie = 'MIETE';
UPDATE buchungen SET kategorie = 'Strom, Wasser'                       WHERE kategorie = 'STROM_WASSER';
UPDATE buchungen SET kategorie = 'Telekommunikationskosten'            WHERE kategorie = 'TELEKOMMUNIKATION';
UPDATE buchungen SET kategorie = 'Fortbildungskosten/Messen'           WHERE kategorie = 'FORTBILDUNG_MESSEN';
UPDATE buchungen SET kategorie = 'Beiträge'                            WHERE kategorie = 'BEITRAEGE';
UPDATE buchungen SET kategorie = 'Versicherungen'                      WHERE kategorie = 'VERSICHERUNGEN';
UPDATE buchungen SET kategorie = 'Werbekosten'                         WHERE kategorie = 'WERBEKOSTEN';
UPDATE buchungen SET kategorie = 'Zinsen'                              WHERE kategorie = 'ZINSEN';
UPDATE buchungen SET kategorie = 'Reisekosten'                         WHERE kategorie = 'REISEKOSTEN';
UPDATE buchungen SET kategorie = 'Reparaturen / Instandhaltung'        WHERE kategorie = 'REPARATUREN_INSTANDHALTUNG';
UPDATE buchungen SET kategorie = 'Bürobedarf'                          WHERE kategorie = 'BUEROBEDARF';
UPDATE buchungen SET kategorie = 'Repräsentationskosten'               WHERE kategorie = 'REPRAESENTATIONSKOSTEN';
UPDATE buchungen SET kategorie = 'Sonstiger Betriebsbedarf'            WHERE kategorie = 'SONSTIGER_BETRIEBSBEDARF';
UPDATE buchungen SET kategorie = 'Nebenkosten des Geldverkehrs'        WHERE kategorie = 'NEBENKOSTEN_GELDVERKEHR';

-- Einnahmen (EINLAGE)
UPDATE buchungen SET kategorie = 'Fußpflege/Verkauf/Gutscheine'        WHERE kategorie = 'FUSSPFLEGE';
UPDATE buchungen SET kategorie = 'Privateinlagen'                      WHERE kategorie = 'PRIVATEINLAGEN';
UPDATE buchungen SET kategorie = 'Darlehen'                            WHERE kategorie = 'DARLEHEN';
UPDATE buchungen SET kategorie = 'Steuererstattungen'                  WHERE kategorie = 'STEUERERSTATTUNGEN';
UPDATE buchungen SET kategorie = 'Versicherungserstattungen'           WHERE kategorie = 'VERSICHERUNGSERSTATTUNGEN';
UPDATE buchungen SET kategorie = 'Zinserträge'                         WHERE kategorie = 'ZINSERTRAEGE';
UPDATE buchungen SET kategorie = 'Miet-/Pachteinnahmen'                WHERE kategorie = 'VERMIETUNG_VERPACHTUNG';
UPDATE buchungen SET kategorie = 'Veräußerungserlöse'                  WHERE kategorie = 'VERAEUSSERUNGSERLOES';
UPDATE buchungen SET kategorie = 'Eigenverbrauch'                      WHERE kategorie = 'EIGENVERBRAUCH';
UPDATE buchungen SET kategorie = 'Sonstige Einnahmen'                  WHERE kategorie = 'SONSTIGE_EINNAHMEN';
