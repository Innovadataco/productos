# syntax=docker/dockerfile:1
# Spec 097 (US3): imagen de producción de PI — app Next.js standalone + worker pg-boss.
# La misma imagen sirve para app (CMD por defecto) y worker (command override en compose).

FROM node:22-alpine AS deps
WORKDIR /app
# OpenSSL 3 para que Prisma detecte y descargue el engine linux-musl-openssl-3.0.x
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholders SOLO de build: src/lib/email.ts valida RESEND_API_KEY/EMAIL_FROM al
# importarse y la inicialización de Prisma/cola pide DATABASE_URL cuando `next build`
# evalúa los módulos al recolectar page data. Los valores reales llegan en runtime
# vía env_file (.env.production); NUNCA secretos en la imagen.
# APP_BUILD_SHA (spec 102): SHA corto del commit, informativo (no secreto); se pasa
# como build-arg desde deploy-prod.sh y queda horneado para el sello de versión.
ARG APP_BUILD_SHA
ENV RESEND_API_KEY=build-placeholder \
    EMAIL_FROM=build@placeholder.local \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    ENABLE_HTTPS_HEADERS=true \
    APP_BUILD_SHA=$APP_BUILD_SHA
RUN npx prisma generate && npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
# Deps de PRODUCCIÓN solamente (SPEC-107, B3-e: la imagen no lleva devDependencies).
# tsx y prisma CLI son dependencies de runtime (worker con --import tsx; migrate/seed).
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

FROM node:22-alpine AS runner
WORKDIR /app
# Se repite el ARG/ENV en runtime: el panel admin lee APP_BUILD_SHA en servidor
# por request (layout dinámico), y el ENV del stage builder no llega al runner.
ARG APP_BUILD_SHA
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 APP_BUILD_SHA=$APP_BUILD_SHA
# libssl/libcrypto en runtime para el query engine de Prisma
RUN apk add --no-cache openssl && addgroup -S nodejs && adduser -S nextjs -G nodejs

# App standalone (server.js en la raíz del standalone)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Worker (corre con --import tsx sobre src/) + Prisma CLI para migrate/seed.
# node_modules de PRODUCCIÓN (sin devDependencies).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json /app/tsconfig.json /app/next.config.ts ./

# Directorio compartido app↔worker para el heartbeat del healthcheck (spec 097)
RUN mkdir -p /app/run && chown nextjs:nodejs /app/run

USER nextjs
EXPOSE 3000
# Next standalone honra PORT y HOSTNAME (compose los fija: 3000 / 0.0.0.0)
CMD ["node", "server.js"]
