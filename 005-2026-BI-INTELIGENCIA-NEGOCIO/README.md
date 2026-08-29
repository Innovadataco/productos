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

**Fase de fundación** · 2026-08-28. Repo recién creado. Cero código aún.
Ver `ESTADO.md` en el repo gestión para el corte del día.
