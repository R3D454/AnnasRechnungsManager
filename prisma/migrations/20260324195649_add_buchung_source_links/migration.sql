-- Add source linking fields to Buchung model
ALTER TABLE `buchungen` ADD COLUMN `betriebseinnahmeId` VARCHAR(191) NULL;
ALTER TABLE `buchungen` ADD COLUMN `betriebsausgabeId` VARCHAR(191) NULL;
ALTER TABLE `buchungen` ADD COLUMN `linkedBuchungId` VARCHAR(191) NULL;

-- Add unique constraints for 1:1 relations
ALTER TABLE `buchungen` ADD UNIQUE INDEX `buchungen_betriebseinnahmeId_key`(`betriebseinnahmeId`);
ALTER TABLE `buchungen` ADD UNIQUE INDEX `buchungen_betriebsausgabeId_key`(`betriebsausgabeId`);

-- Add foreign key constraints
ALTER TABLE `buchungen` ADD CONSTRAINT `buchungen_betriebseinnahmeId_fkey` FOREIGN KEY (`betriebseinnahmeId`) REFERENCES `betriebseinnahmen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `buchungen` ADD CONSTRAINT `buchungen_betriebsausgabeId_fkey` FOREIGN KEY (`betriebsausgabeId`) REFERENCES `betriebsausgaben`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `buchungen` ADD CONSTRAINT `buchungen_linkedBuchungId_fkey` FOREIGN KEY (`linkedBuchungId`) REFERENCES `buchungen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for linked fields
ALTER TABLE `buchungen` ADD INDEX `buchungen_betriebsausgabeId_idx`(`betriebsausgabeId`);
ALTER TABLE `buchungen` ADD INDEX `buchungen_linkedBuchungId_idx`(`linkedBuchungId`);
