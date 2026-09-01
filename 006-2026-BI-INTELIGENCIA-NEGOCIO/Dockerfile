# ==========================================================================
# BI v2 (006) — Dockerfile multi-stage (D3: las 4 minas del 005 resueltas)
#   (b) output standalone → se copia .next/standalone + .next/static + public
#   (c) el build corre con devDependencies (stage deps instala todo)
#   (d) env de runtime por env_file en compose — NADA horneado en la imagen
# ==========================================================================

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci con lockfile commiteado (D3a: builds reproducibles)
RUN npm ci

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma generate EXPLÍCITO: en el stage deps el postinstall de @prisma/client
# corre sin prisma/ y queda sin tipos → el typecheck de next build falla (I-01)
RUN npx prisma generate
RUN npm run build

# ---------- tools (migraciones/seed · NO es la imagen de producción) ----------
# Fase 1b: `prisma migrate deploy` y `prisma db seed` corren AQUÍ, nunca en la
# imagen standalone (runner): el standalone no lleva node_modules completos,
# prisma CLI ni tsx. Lo usa el servicio bi-migrate del compose (profile tools).
# Requiere que prisma/ exista en el contexto (llega en Fase 1b); el build de
# producción (runner) NO toca este stage, así que no rompe si aún no existe.
FROM node:22-alpine AS tools
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: recomendación oficial de Prisma sobre Alpine (musl)
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY prisma ./prisma
# src por si el seed importa utilidades de la app (alias @/* del tsconfig)
COPY src ./src
# prisma generate EXPLÍCITO: el postinstall de @prisma/client corrió sin
# prisma/ en deps → sin esto, `prisma db seed` falla con "did not initialize"
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- runner ----------
# NOTA (Fase 1b): las migraciones y el seed NO corren en esta imagen — el
# standalone no incluye prisma CLI ni tsx. Corren vía el servicio `bi-migrate`
# (target `tools` de este mismo Dockerfile · profile "tools" del compose).
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=America/Bogota \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# openssl: el engine de Prisma (linux-musl-openssl-3.0.x) enlaza contra libssl.so.3
RUN apk add --no-cache openssl
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
