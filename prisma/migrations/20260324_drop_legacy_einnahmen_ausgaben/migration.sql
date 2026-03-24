-- Migration: Drop legacy betriebseinnahmen and betriebsausgaben tables
-- This consolidates all transaction data into the buchungen table

-- STEP 1: Copy existing betriebseinnahmen into buchungen
-- Only copy those that don't already have a linked Buchung (via betriebseinnahmeId)
INSERT INTO `buchungen` (id, companyId, date, account, type, amount, description,
                         kategorie, steuersatz, zahlungsart, isBusinessRecord, createdAt, updatedAt)
SELECT
  CONCAT('migr-ein-', e.id),
  e.companyId,
  e.datum,
  e.zahlungsart,
  'EINLAGE',
  e.betrag,
  e.beschreibung,
  e.kategorie,
  e.steuersatz,
  e.zahlungsart,
  true,
  e.createdAt,
  e.updatedAt
FROM `betriebseinnahmen` e
WHERE NOT EXISTS (
  SELECT 1 FROM `buchungen` b WHERE b.betriebseinnahmeId = e.id
);

-- STEP 2: Copy existing betriebsausgaben into buchungen
INSERT INTO `buchungen` (id, companyId, date, account, type, amount, description,
                         kategorie, steuersatz, zahlungsart, isBusinessRecord, createdAt, updatedAt)
SELECT
  CONCAT('migr-aus-', a.id),
  a.companyId,
  a.datum,
  a.zahlungsart,
  'ENTNAHME',
  a.betrag,
  a.beschreibung,
  a.kategorie,
  a.steuersatz,
  a.zahlungsart,
  true,
  a.createdAt,
  a.updatedAt
FROM `betriebsausgaben` a
WHERE NOT EXISTS (
  SELECT 1 FROM `buchungen` b WHERE b.betriebsausgabeId = a.id
);

-- STEP 3: Remove FK constraints before dropping columns/tables
ALTER TABLE `buchungen` DROP FOREIGN KEY `buchungen_betriebseinnahmeId_fkey`;
ALTER TABLE `buchungen` DROP FOREIGN KEY `buchungen_betriebsausgabeId_fkey`;

-- STEP 4: Remove old linking columns from buchungen
ALTER TABLE `buchungen` DROP INDEX `buchungen_betriebseinnahmeId_key`;
ALTER TABLE `buchungen` DROP INDEX `buchungen_betriebsausgabeId_key`;
ALTER TABLE `buchungen` DROP COLUMN `betriebseinnahmeId`;
ALTER TABLE `buchungen` DROP COLUMN `betriebsausgabeId`;

-- STEP 5: Drop old tables
DROP TABLE `betriebsausgaben`;
DROP TABLE `betriebseinnahmen`;
