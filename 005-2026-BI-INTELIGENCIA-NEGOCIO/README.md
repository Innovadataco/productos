# Producto 005 · BI · Inteligencia de Negocio

Plataforma de inteligencia de negocio para el ecosistema Innovadataco.

## Uso

- **Fase 1 (actual):** interno · Jelkin + Fábrica · dashboards operativos + chat NL-to-SQL con Ollama local
- **Fase 2:** módulo colegio dentro de la app PI como Plan Premium
- **Fase 3:** módulo padre dentro de la app PI como Plan Premium

## Stack

- Next.js 16 · TypeScript · Tailwind · Prisma
- Apache Superset (dashboards)
- Vanna.ai + Ollama local (chat NL-to-SQL)
- Bot Telegram (alertas móvil)
- Postgres réplica read-only del Postgres PI producción
- Docker Compose · VPS Hostinger
- Deploy: `scripts/deploy-bi-prod.sh` (solo Jelkin)

## Documentos clave

- [AGENTS.md](AGENTS.md) — reglas de código para agentes IA
- `.specify/memory/constitution.md` — LEY vinculante · 15 candados anti-alucinación
- Gestión del proyecto: `~/Documents/GitHub/Gestion-de-proyectos/01-PROYECTOS/005-2026-BI-INTELIGENCIA-NEGOCIO/`

## Estado

**Motor NL→SQL implementado** · SPEC-011..014 · 2026-08-28.

## Motor NL→SQL · variables de entorno

- `OLLAMA_BASE_URL` — Ollama en Mac Studio (Tailscale). Default `http://100.91.87.86:11435`.
- `VANNA_BASE_URL` — servicio Python `bi-vanna` (FastAPI + jurado). Default `http://bi-vanna:8001` en compose, `http://localhost:58001` en tests.
- `DATABASE_URL_REPLICA` — Postgres réplica read-only. Fallback a `DATABASE_URL` si no existe.
- `LLM_MODELS_JURADO` — CSV de modelos del jurado. Default `qwen2.5:14b,gemma2:27b,aya-expanse:32b`.
- `KEEP_ALIVE_H` — horas de keep-alive de Ollama. Default `24`.

Secretos (nunca en chat/commits): `ver INVENTARIO-DE-SECRETOS.md`.

## Comandos

```bash
# Unit tests (rápidos · sin infra)
npm run test:unit

# Ratchets (candados de código)
npm run ratchets:check

# Integración BI (requiere Docker + Ollama Mac Studio via Tailscale)
npm run e2e:bi:preparar
INTEGRATION=1 npm run test:integration:bi
npm run e2e:bi:limpiar
```

## Ejemplos curl · 5 preguntas obligatorias

```bash
BASE=http://localhost:3001

# 1. Un-número
curl -sX POST $BASE/api/bi/preguntar -H 'Content-Type: application/json' \
  -d '{"preguntaNL":"cuántos reportes hoy","rol":"ADMIN"}' | jq

# 2. Gráfico
curl -sX POST $BASE/api/bi/preguntar -H 'Content-Type: application/json' \
  -d '{"preguntaNL":"top 5 categorías esta semana","rol":"ADMIN"}' | jq

# 3. Compleja (OK o REVISION)
curl -sX POST $BASE/api/bi/preguntar -H 'Content-Type: application/json' \
  -d '{"preguntaNL":"por qué la latencia subió","rol":"ADMIN"}' | jq

# 4. Destructiva → RECHAZADO llamadasLlm=0
curl -sX POST $BASE/api/bi/preguntar -H 'Content-Type: application/json' \
  -d '{"preguntaNL":"DROP TABLE Reporte","rol":"ADMIN"}' | jq

# 5. PII → RECHAZADO
curl -sX POST $BASE/api/bi/preguntar -H 'Content-Type: application/json' \
  -d '{"preguntaNL":"muéstrame nombres de padres","rol":"ADMIN"}' | jq
```

Chat UI: `http://localhost:3001/chat`.

Feedback humano (candado 7):
- 👍 `POST /api/bi/aprobar` con headers `x-user-rol: ADMIN` + `x-user-id: <id>` y body `{"consultaLogId":"<id>"}`.
- 👎 `POST /api/bi/rechazar` con body `{"consultaLogId":"<id>","razon":"..."}`.

Ver [ESTADO.md] en el repo gestión para el corte del día.
