# SPEC-038 · BI v2 · Reconstrucción limpia sobre esqueleto PI

> **NOTA (2026-09-01):** documento HISTÓRICO rescatado de la rama `work/bi-SPEC-038-rebuild-v2` (eliminada). Sus decisiones de auth (JWT compartido con PI) y de servicio FastAPI quedaron **superadas** por el mensaje CEO del 31-08-2026: login propio cerrado por defecto, sin servicio Python separado (el motor NL→SQL vive en Next.js), carpeta `006-2026-BI-INTELIGENCIA-NEGOCIO` y rama única `work/bi-SPEC-006-bi-v2`. El documento vigente es `spec.md` de este directorio.

## Objetivo

Reconstruir el producto BI desde cero, usando el esqueleto técnico y de diseño de PI, eliminando Vanna y Superset, y usando un solo modelo Ollama para NL→SQL.

## Razones

- El BI actual no funciona a satisfacción del dueño del producto (Jelkin).
- Superset y Vanna consumen recursos y no aportan valor claro.
- El jurado de 3 modelos satura la Mac Studio sin mejora real.
- El BI actual tiene fallas críticas de seguridad y gobierno.
- PI ya tiene una base de código madura, con auth, CI/CD y convenciones probadas.

## Decisiones

| Decisión | Valor |
|---|---|
| Dominio | `https://bi.innovadataco.com/` |
| Stack app | Next.js 16 + TypeScript + Tailwind + Prisma |
| Base de datos | PostgreSQL réplica de PI (solo lectura) |
| Auth | JWT compartido con PI (no login propio con clave en claro) |
| NL→SQL | FastAPI ligero + Ollama 1 modelo (`qwen2.5:14b`) |
| Dashboards | Next.js + Tremor/Recharts/ECharts |
| Alertas | Bot Telegram simple (solo cuando el core funcione) |
| Deploy | Docker Compose en VPS Hostinger |
| Ollama | Mac Studio local vía Tailscale (`100.91.87.86:11435`) |

## Lo que se elimina

- Apache Superset (dashboards y metadata DB)
- Vanna.ai (servicio Python pesado)
- Jurado de 3 modelos
- Login propio con clave en claro
- Paso de `rol` por body del cliente

## Lo que se reutiliza del BI actual

- Catálogo BI (`BICatalogoTabla`, `BICatalogoColumna`, `BICatalogoMetrica`, `BICatalogoEjemplo`)
- Vistas materializadas (`mv_fact_*`)
- Configuración de réplica pg_logical
- Concepto de log de consultas (`BIConsultaLog`)
- Cache semántico (`BICacheSemantico`)

## Estructura de BI v2

```
005-2026-BI-INTELIGENCIA-NEGOCIO/
├── _legacy/                    # BI viejo (solo referencia)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # Auth compartida con PI
│   │   │   └── bi/
│   │   │       ├── preguntar/ # Motor NL→SQL
│   │   │       ├── kpis/      # KPIs live
│   │   │       └── estado-sistema/
│   │   ├── dashboard/         # Home con KPIs
│   │   ├── chat/              # Chat NL→SQL
│   │   └── operacion/         # Tablero operativo
│   ├── components/
│   │   ├── bi/               # Componentes BI
│   │   └── ui/               # Componentes base (copiados de PI)
│   └── lib/
│       ├── auth/             # Sesión JWT compartida
│       ├── bi/               # Motor NL→SQL
│       ├── catalogo/         # Catálogo dinámico
│       └── observabilidad/   # Logs y métricas
├── docker/
│   └── nl2sql/               # FastAPI ligero (1 modelo)
├── prisma/
│   ├── schema.prisma         # Catálogo BI + logs + cache
│   ├── migrations/           # MVs y schema
│   └── seed.ts               # Seed idempotente
├── scripts/
│   └── replica-setup/        # Configuración réplica
├── tests/
├── .github/workflows/        # CI/CD (nuevo)
└── docker-compose.bi.yml     # Sin Superset ni Vanna
```

## Fases de implementación

1. **Fase 1:** Esqueleto copiado de PI + auth + dominio + CI/CD
2. **Fase 2:** Motor NL→SQL con 1 modelo + catálogo + validador
3. **Fase 3:** Dashboards en Next.js + chat UI
4. **Fase 4:** Deploy limpio en Hostinger + verificación en vivo

## Riesgos a vigilar

- Cambios en la BD de PI requieren actualizar catálogo BI y MVs manualmente.
- Un solo modelo puede fallar; el validador post-LLM debe ser estricto.
- La réplica debe mantenerse actualizada; healthcheck del BI debe detectar MVs rotas.

## Estado

- **Fecha:** 2026-09-01
- **Autor:** Jelkin (decisión) + Fábrica (ejecución)
- **Rama:** `work/bi-SPEC-038-rebuild-v2`
- **Worktree:** `.worktrees/bi-SPEC-038-rebuild-v2`
