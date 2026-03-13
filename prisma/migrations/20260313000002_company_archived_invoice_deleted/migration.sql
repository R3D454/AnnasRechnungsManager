-- Rename ARCHIVED -> DELETED in InvoiceStatus enum
ALTER TABLE `invoices` MODIFY COLUMN `status` ENUM('DRAFT', 'SENT', 'PAID', 'CANCELLED', 'DELETED') NOT NULL DEFAULT 'DRAFT';

-- Add archived fields to companies
ALTER TABLE `companies`
  ADD COLUMN `archived`   TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `archivedAt` DATETIME(3) NULL;
