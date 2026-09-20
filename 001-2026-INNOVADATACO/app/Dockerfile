# Dockerfile para Innovadataco Admin (Next.js 16)
# Usamos bullseye porque Prisma 5/6 necesita libssl1.1 y bookworm trae libssl3.
FROM node:20-bullseye-slim AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ARG APP_BUILD_SHA
ENV NEXT_PUBLIC_APP_BUILD_SHA=${APP_BUILD_SHA}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 5001
ENV PORT 5001
ENV HOSTNAME 0.0.0.0
CMD ["npm", "run", "start"]
