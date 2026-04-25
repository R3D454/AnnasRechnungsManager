# ---- Build Stage ----
FROM node:alpine AS builder

WORKDIR /app

RUN if command -v apk >/dev/null 2>&1; then \
            apk add --no-cache openssl; \
        elif command -v apt-get >/dev/null 2>&1; then \
            apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*; \
        fi

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build
# Compile recovery scripts to plain JS for use inside the container
RUN npx tsc --module commonjs --target es2020 --moduleResolution node --esModuleInterop true --outDir scripts-dist scripts/setup-admin.ts scripts/reset-password.ts && \
    mv scripts-dist/setup-admin.js scripts-dist/setup-admin.cjs && \
    mv scripts-dist/reset-password.js scripts-dist/reset-password.cjs

# ---- Production Stage ----
FROM node:alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN if command -v apk >/dev/null 2>&1; then \
            apk add --no-cache openssl; \
        elif command -v apt-get >/dev/null 2>&1; then \
            apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*; \
        fi

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/build ./build
COPY --from=builder /app/scripts-dist ./scripts
COPY prisma ./prisma
COPY scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
