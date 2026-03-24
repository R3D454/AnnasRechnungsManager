-- Add buchungId field to invoices table
ALTER TABLE `invoices` ADD COLUMN `buchungId` VARCHAR(191) NULL;

-- Create unique index for the foreign key
ALTER TABLE `invoices` ADD UNIQUE INDEX `invoices_buchungId_key`(`buchungId`);

-- Add foreign key constraint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_buchungId_fkey`
  FOREIGN KEY (`buchungId`) REFERENCES `buchungen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
