-- CreateTable
CREATE TABLE `anlagegueter` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `bezeichnung` VARCHAR(191) NOT NULL,
    `anschaffungsdatum` DATETIME(3) NOT NULL,
    `anschaffungskosten` DECIMAL(10, 2) NOT NULL,
    `nutzungsdauerJahre` INTEGER NOT NULL,
    `restwert` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `beschreibung` TEXT NULL,
    `aktiv` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `anlagegueter_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `anlagegueter` ADD CONSTRAINT `anlagegueter_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
