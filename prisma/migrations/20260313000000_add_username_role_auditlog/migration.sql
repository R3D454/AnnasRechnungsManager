-- Add UserRole enum (MySQL ENUM)
ALTER TABLE `users` ADD COLUMN `username` VARCHAR(191) NULL;
ALTER TABLE `users` ADD COLUMN `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER';

-- Backfill username from email (use part before @, ensure uniqueness)
UPDATE `users` SET `username` = LOWER(SUBSTRING_INDEX(`email`, '@', 1)) WHERE `username` IS NULL;

-- Make username NOT NULL and add unique constraint
ALTER TABLE `users` MODIFY COLUMN `username` VARCHAR(191) NOT NULL;
ALTER TABLE `users` ADD UNIQUE INDEX `users_username_key`(`username`);

-- Create AuditLog table
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key from audit_logs to users
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
