# syntax=docker/dockerfile:1
# Inversiones (008) · imágenes de producción. Se construyen EN EL MAC con scripts/construir-imagen.sh
# (git archive del sha + buildx --platform linux/amd64); el VPS de PI no construye nada.
#
#   runner   → inv-008-app: la app (Next standalone).
#   migrador → inv-008-migrador: prisma migrate deploy + guardián del esquema + privilegios de inv_app y
#              los comandos de carga y de acceso inicial (tsx, rol inv_dueno). Lleva el node_modules completo
#              del lockfile: prisma 5.22.0 y tsx están en devDependencies y la imagen standalone no los trae.
#   vigia    → inv-008-vigia: imagen mínima (alpine, sin node, prisma ni devDependencies) para el vigía de
#              convivencia y el respaldo diario cifrado: age, curl, certificados y pg_dump 16.
#
# Sin secretos: ningún ARG ni ENV lleva claves; los valores llegan en ejecución por Compose.
# APP_VERSION (sha completo) va horneada en las dos imágenes, con la etiqueta OCI revision.
# Bases fijadas por el digest del índice multiarquitectura (amd64 para el VPS, arm64 para las pruebas en el
# Mac): node 22.23.5 en alpine 3.24, y alpine 3.24.4. Para actualizar: docker buildx imagetools inspect.

FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS base
WORKDIR /app
# openssl 3: el engine de Prisma para linux-musl-openssl-3.0.x.
RUN apk add --no-cache openssl
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
# Usuario propio no root, como PI (addgroup + adduser + USER), con uid y gid fijos.
RUN addgroup -S -g 10008 inversiones && adduser -S -D -H -u 10008 -G inversiones inversiones

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
# Heap fijo para `next build`, como PI: bajo emulación amd64 el ajuste automático de Node se queda corto.
# Solo afecta esta etapa.
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN npx prisma generate && npm run build

FROM base AS runner
ARG APP_VERSION
RUN printf '%s' "${APP_VERSION:-}" | grep -Eq '^[0-9a-f]{40}$' || { echo "APP_VERSION debe ser el sha completo de 40 hex (--build-arg APP_VERSION=<sha>)" >&2; exit 1; }
# Escucha en 5008 también dentro del contenedor: el mismo puerto que publica en 127.0.0.1 del host.
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=5008 APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.revision="${APP_VERSION}" \
      org.opencontainers.image.title="inv-008-app" \
      org.opencontainers.image.source="https://github.com/Innovadataco/productos"
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# El build falla si el standalone no trae el engine de Prisma para musl (si no, fallaría en el VPS).
RUN test -f node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node || { echo "falta el engine de Prisma linux-musl-openssl-3.0.x en el standalone" >&2; exit 1; }
# Ningún .env en la imagen (next build copia el .env de la carpeta al standalone): el build falla si hay uno.
RUN if find / -xdev \( -name '.env' -o -name '.env.*' \) 2>/dev/null | grep -q .; then echo "la imagen trae archivos .env: no se construye" >&2; exit 1; fi
RUN mkdir -p /app/.next/cache
USER 10008:10008
EXPOSE 5008
CMD ["node", "server.js"]

FROM deps AS migrador
ARG APP_VERSION
RUN printf '%s' "${APP_VERSION:-}" | grep -Eq '^[0-9a-f]{40}$' || { echo "APP_VERSION debe ser el sha completo de 40 hex (--build-arg APP_VERSION=<sha>)" >&2; exit 1; }
ENV NODE_ENV=production HOME=/tmp APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.revision="${APP_VERSION}" \
      org.opencontainers.image.title="inv-008-migrador" \
      org.opencontainers.image.source="https://github.com/Innovadataco/productos"
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY docker/migrador/privilegios.sql ./docker/migrador/privilegios.sql
COPY --chmod=0555 docker/migrar.sh /usr/local/bin/inv-migrar
RUN npx prisma generate
# Ningún .env en la imagen (next build copia el .env de la carpeta al standalone): el build falla si hay uno.
RUN if find / -xdev \( -name '.env' -o -name '.env.*' \) 2>/dev/null | grep -q .; then echo "la imagen trae archivos .env: no se construye" >&2; exit 1; fi
USER 10008:10008
CMD ["/usr/local/bin/inv-migrar"]

FROM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS vigia
ARG APP_VERSION
RUN printf '%s' "${APP_VERSION:-}" | grep -Eq '^[0-9a-f]{40}$' || { echo "APP_VERSION debe ser el sha completo de 40 hex (--build-arg APP_VERSION=<sha>)" >&2; exit 1; }
# El VPS no tiene age y no se le instala nada: cifra este contenedor. pg_dump 16, igual que la base (un
# volcado de un pg_dump más nuevo no lo leería el pg_restore 16). curl valida TLS con los certificados.
RUN apk add --no-cache age curl ca-certificates postgresql16-client \
 && addgroup -S -g 10008 inversiones && adduser -S -D -H -u 10008 -G inversiones inversiones
ENV APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.revision="${APP_VERSION}" \
      org.opencontainers.image.title="inv-008-vigia" \
      org.opencontainers.image.source="https://github.com/Innovadataco/productos"
COPY --chmod=0555 docker/vigia/vigia.sh /usr/local/bin/inv-vigia
COPY --chmod=0555 docker/respaldo/respaldo.sh /usr/local/bin/inv-respaldo
# Ningún .env en la imagen (next build copia el .env de la carpeta al standalone): el build falla si hay uno.
RUN if find / -xdev \( -name '.env' -o -name '.env.*' \) 2>/dev/null | grep -q .; then echo "la imagen trae archivos .env: no se construye" >&2; exit 1; fi
USER 10008:10008
CMD ["/usr/local/bin/inv-vigia"]
