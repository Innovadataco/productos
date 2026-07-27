# Cierre — Spec 097: Despliegue híbrido a producción (VPS + cerebro en la Mac)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding` · **Tag desplegado**: ver `docker images pi-app` en el VPS

## Lo hecho (por US)

- **US1 — VPS base**: swap 4G (`/swapfile`, persistente en fstab, swappiness=10). ufw ya estaba
  correcto (default deny incoming; permite 22/80/5432; PI no necesita puertos) → no se tocó.
  Gesmovil verificado vivo tras cada paso (apache2, postgresql@16-main, pm2 backend, hermes,
  puertos 80/3000/5050/5432/8642/9119).
- **US2 — Docker**: Docker Engine 29.6.2 + compose plugin v5.3.1 (repo oficial). Gesmovil intacto.
- **US3 — PI contenerizada**: `Dockerfile` multi-stage (Next.js standalone, node:22-alpine,
  no-root) + `docker-compose.prod.yml` (app `127.0.0.1:5005→3000`, worker, db pgvector:pg16),
  `restart: always` en todo. Migraciones (50) aplicadas; seed limpio ejecutado (BD de prod
  NUEVA, sin datos de la Mac). Imágenes etiquetadas por commit (`pi-app:<sha>` + `latest`).
- **US4 — Secretos**: `.env.production` (600, root) solo en el VPS, valores fuertes aleatorios.
  **Claves para respaldo del CEO (fuera del VPS)**:
  - `PARAM_ENCRYPTION_KEY=iiuGLjIufM0PgYHSZd8c5YTypioyBRgGR6CX33n0KOk=` ← VIGENTE (cifra los textos de reportes).
  - `ENCRYPTION_KEY=c9c0516d916a2c0bcd27b90f52e3459b74f6723b4ea1d4d673bcebad0869da57` (definida en el env pero SIN consumidor en el código actual; ver deuda).
  - La primera `PARAM_ENCRYPTION_KEY` hex generada se descartó (formato inválido: el parser exige base64-32B o string de 32 chars; nunca cifró datos).
- **US5 — Cerebro híbrido**: Mac expone Ollama SOLO a la tailnet (`tailscale serve --bg
  --tcp=11434 tcp://localhost:11434`, sin Funnel). `OLLAMA_BASE_URL=http://100.91.87.86:11434`
  en el VPS. Worker reporta `Ollama health: OK`.
- **US6 — Exposición**: ingress `pi.innovadataco.com → http://127.0.0.1:5005` agregado al
  tunnel "hermes" existente (sin tocar las rutas hermes; backup `config.yml.bak-097`), CNAME
  creado con `cloudflared tunnel route dns`. **MX intactos** (`1 smtp.google.com.`).
  https://pi.innovadataco.com responde 200 con headers de seguridad (CSP, X-Frame-Options
  DENY, HSTS — horneado en build, ver hallazgos).
- **US7 — Deploy**: `scripts/deploy-prod.sh` (pull → build etiquetado → up → migrate deploy →
  healthcheck). Documentado en `docs/despliegue/produccion-vps.md`.
- **US8 — Rollback**: imágenes por tag de commit + migraciones siempre aditivas; página
  "cómo revertir" en `docs/despliegue/produccion-vps.md` (§Rollback) y quickstart §G.

## Blindajes (adición 002-PI-012)

1. **BD de PI no expuesta** ✅ — servicio db SIN `ports:` (solo red interna de Docker);
   verificado `docker port pi-db` vacío y nada escuchando en 5434. El Postgres de Gesmovil
   (0.0.0.0:5432) no se tocó.
2. **Ollama solo red privada** ✅ — verificado desde el VPS: `http://100.91.87.86:11434`
   responde (tailnet); `http://186.155.159.214:11434` (IP pública de la Mac) → **timeout**.
   **PENDIENTE CEO**: ACL en el admin console de Tailscale para que solo el nodo del VPS
   (100.113.13.77) alcance `mac-studio-de-idc:11434` (requiere dueño de la tailnet; no
   automatizable desde CLI).
3. **SSH solo por llave** ⏸️ — drop-in PREPARADO en
   `/etc/ssh/sshd_config.d/60-pi-hardening.conf.PENDIENTE` (PasswordAuthentication no,
   PermitRootLogin prohibit-password). **El CEO decidió NO aplicarlo por ahora** (pregunta
   directa 2026-07-27: "No, dejar como está"). Queda listo para activar con
   `mv ...PENDIENTE ...conf && systemctl reload ssh`.

## Verificación (SC)

- **SC-001** ✅ Gesmovil vivo al final de cada fase y al cierre (systemctl + pm2 + ss).
- **SC-002** ✅ pi.innovadataco.com responde HTTPS (Cloudflare) con headers de seguridad.
  **Matiz de acceso restringido**: la app exige login para todo lo privado (no hay registro
  abierto de admins), pero la consulta pública es anónima POR DISEÑO del producto.
  **PENDIENTE CEO/ZEUS**: política Cloudflare Access en el dashboard Zero Trust (no hay API
  token en el VPS) si se quiere TODO el subdominio tras autenticación Cloudflare (R08/#149).
- **SC-003** ✅ E2E: reporte `RPT-9SA2BA` creado vía https://pi.innovadataco.com/api/reportes
  → worker del VPS → `POST /api/reportes/procesar` → **Ollama en la Mac por Tailscale** →
  `CLASIFICADO` (SOLICITUD_MATERIAL, confianza 1.0) en 45 s. El reporte de prueba queda en
  la BD de prod como evidencia (borrable).
- **SC-004** ✅ Gate en la Mac: tsc + lint (0 errores, 1 warning preexistente) + 882/882
  tests + build con standalone verificado (`STANDALONE_OK`). Healthcheck VPS:
  `{"status":"ok","workerAlive":true,"dbOk":true}`.

## Hallazgos (fixes aplicados durante el despliegue)

- `next build` evalúa módulos al recolectar page data: `email.ts` exige RESEND_API_KEY/
  EMAIL_FROM al importarse y Prisma pide DATABASE_URL → placeholders SOLO de build en el
  Dockerfile (los reales llegan por env_file; ningún secreto en la imagen).
- Prisma en Alpine: engine incorrecto por detección de libssl → `binaryTargets` +
  `apk add openssl` en las 3 etapas (`linux-musl-openssl-3.0.x`).
- Worker en contenedor: `--env-file=.env` hardcodeado → `--env-file-if-exists=.env`;
  healthcheck por PID no funciona entre contenedores → heartbeat compartido
  (`WORKER_RUN_DIR=/app/run`, volumen `pi_worker_run`, `worker.heartbeat` cada 15 s).
- Cola `simulacion-lote` no se creaba en BD limpia → `ensureQueue` al arrancar el worker.
- Worker llamaba `localhost:5005` → `API_BASE_URL=http://app:3000` (red interna).
- Headers de next.config (HSTS) se hornean en build → `ENABLE_HTTPS_HEADERS=true` en el builder.
- Cambios de env en `.env.production` requieren `up -d` (recreate), no `restart`.

## Pendientes (no bloquean)

1. **Cloudflare Access** sobre pi.innovadataco.com (dashboard Zero Trust — acción del CEO).
2. **ACL Tailscale** VPS→Mac:11434 en el admin console (acción del CEO).
3. **Hardening SSH**: preparado, NO aplicado por decisión del CEO (2026-07-27).
4. CI/CD automático (US7 prevé deploy manual documentado).
5. Reporte de prueba `RPT-9SA2BA` en prod (evidencia E2E; borrable por el CEO).
6. ACTA-VALIDACION de ZEUS.

## Deuda técnica

- `ENCRYPTION_KEY` (plana) está en el env pero NINGÚN código la lee (solo
  `PARAM_ENCRYPTION_KEY`); candidata a retiro de `.env.example`/docs o a unificar.
- `docs/configuracion/parametros-sistema.md`: conviene documentar el formato exacto de
  `PARAM_ENCRYPTION_KEY` (base64-32B o 32 chars UTF-8; NO hex) — el error es silencioso
  hasta el primer reporte.
- La app no tiene endpoint `/api/health` (solo `/api/health/worker`); el deploy script ya
  usa el correcto. Considerar alias `/api/health` para monitoreo externo.
