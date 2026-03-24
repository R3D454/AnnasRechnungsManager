-- CreateTable for BuchungKategorie
CREATE TABLE `buchung_kategorien` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `typ` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `buchung_kategorien_companyId_idx`(`companyId`),
    UNIQUE INDEX `buchung_kategorien_companyId_name_typ_key`(`companyId`, `name`, `typ`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey for BuchungKategorie
ALTER TABLE `buchung_kategorien` ADD CONSTRAINT `buchung_kategorien_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable `buchungen` - add new columns
ALTER TABLE `buchungen` ADD COLUMN `kategorie` VARCHAR(191) NULL;
ALTER TABLE `buchungen` ADD COLUMN `steuersatz` INT NULL;
ALTER TABLE `buchungen` ADD COLUMN `zahlungsart` ENUM('KASSE', 'BANK') NULL;
ALTER TABLE `buchungen` ADD COLUMN `isBusinessRecord` BOOLEAN NOT NULL DEFAULT false;

-- Add index for isBusinessRecord
ALTER TABLE `buchungen` ADD INDEX `buchungen_isBusinessRecord_idx`(`isBusinessRecord`);

-- Migrate existing data from betriebseinnahmen/betriebsausgaben to Buchung
-- This is handled by the post-migration script

-- AlterTable `betriebseinnahmen` - change kategorie from Enum to String
ALTER TABLE `betriebseinnahmen` MODIFY `kategorie` VARCHAR(191) NOT NULL;
ALTER TABLE `betriebseinnahmen` MODIFY `steuersatz` INT NOT NULL DEFAULT 0;

-- AlterTable `betriebsausgaben` - change kategorie from Enum to String
ALTER TABLE `betriebsausgaben` MODIFY `kategorie` VARCHAR(191) NOT NULL;
ALTER TABLE `betriebsausgaben` MODIFY `steuersatz` INT NOT NULL DEFAULT 0;

-- Drop old foreign key constraints from buchungen (if they exist from previous migration)
-- These will be re-added if needed, but for now we're consolidating

-- Note: The enum columns EinnahmeKategorie and AusgabeKategorie are automatically
-- dropped by Prisma when they're no longer referenced in the schema.
