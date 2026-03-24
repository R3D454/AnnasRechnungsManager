-- CreateTable
CREATE TABLE `betriebseinnahmen` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `kategorie` ENUM('PRIVATEINLAGEN', 'DARLEHEN', 'STEUERERSTATTUNGEN', 'VERSICHERUNGSERSTATTUNGEN', 'ZINSERTRAEGE', 'VERMIETUNG_VERPACHTUNG', 'VERAEUSSERUNGSERLOES', 'EIGENVERBRAUCH', 'SONSTIGE_EINNAHMEN') NOT NULL,
    `betrag` DECIMAL(10, 2) NOT NULL,
    `datum` DATETIME(3) NOT NULL,
    `beschreibung` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `betriebseinnahmen_companyId_idx`(`companyId`),
    INDEX `betriebseinnahmen_datum_idx`(`datum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `betriebseinnahmen` ADD CONSTRAINT `betriebseinnahmen_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
