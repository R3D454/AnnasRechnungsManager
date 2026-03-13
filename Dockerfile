# ---- Build Stage ----
FROM node:alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build
# Compile recovery scripts to plain JS for use inside the container
RUN npx tsc --module commonjs --target es2020 --moduleResolution node --esModuleInterop true --outDir scripts-dist scripts/setup-admin.ts scripts/reset-password.ts

# ---- Production Stage ----
FROM node:alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/build ./build
COPY --from=builder /app/scripts-dist ./scripts
COPY prisma ./prisma

EXPOSE 3000

CMD ["npm", "run", "start"]
