#!/bin/sh
set -e

echo "[entrypoint] Migrationen werden angewendet..."
npx prisma migrate deploy

echo "[entrypoint] Admin-Benutzer wird geprüft..."
node scripts/setup-admin.js

echo "[entrypoint] App wird gestartet..."
exec npm run start
