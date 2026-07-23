# Dockerfile para Next.js (Innovadataco Core)
FROM node:22-alpine AS base
# Prisma necesita libssl presente; sin él detecta mal la versión y carga el engine
# openssl-1.1.x, que no existe en Alpine 3.2x (falla con "libssl.so.1.1 not found").
RUN apk add --no-cache openssl

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El stage deps corre npm ci sin prisma/schema.prisma: hay que generar el cliente aquí
RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 5001
ENV PORT 5001
CMD ["npm", "run", "start"]
