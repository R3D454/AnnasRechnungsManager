-- AlterTable
ALTER TABLE `betriebsausgaben` ADD COLUMN `steuersatz` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `zahlungsart` ENUM('KASSE', 'BANK') NOT NULL DEFAULT 'BANK';

-- AlterTable
ALTER TABLE `betriebseinnahmen` ADD COLUMN `steuersatz` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `zahlungsart` ENUM('KASSE', 'BANK') NOT NULL DEFAULT 'BANK';
