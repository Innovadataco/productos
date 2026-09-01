# ==========================================================================
# BI v2 (006) — Dockerfile multi-stage (D3: las 4 minas del 005 resueltas)
#   (b) output standalone → se copia .next/standalone + .next/static + public
#   (c) el build corre con devDependencies (stage deps instala todo)
#   (d) env de runtime por env_file en compose — NADA horneado en la imagen
# ==========================================================================

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
# npm install (no npm ci): el package-lock se genera y se commitea en Fase 1b
RUN npm install

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=America/Bogota \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
