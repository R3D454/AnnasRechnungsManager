/*
  Warnings:

  - You are about to drop the column `money` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `companies` DROP COLUMN `money`;

-- CreateTable
CREATE TABLE `buchungen` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `account` ENUM('KASSE', 'BANK') NOT NULL,
    `type` ENUM('EINLAGE', 'ENTNAHME') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `buchungen_companyId_idx`(`companyId`),
    INDEX `buchungen_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `buchungen` ADD CONSTRAINT `buchungen_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
