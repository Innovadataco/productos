# 006-2026-BI-INTELIGENCIA-NEGOCIO — BI v2

Inteligencia de negocio interna para Innovadataco (IDC): análisis **descriptivo** de la operación de Protección Infantil (PI) — qué pasó, qué está pasando e histórico — mediante reportes por fechas, tendencias, comportamientos, proyecciones y estadísticas sobre la operación.

## Por qué es un producto nuevo (006)

BI v1 (`005-2026-BI-INTELIGENCIA-NEGOCIO`) no funcionó a satisfacción del dueño del producto: Superset y Vanna consumían recursos sin aportar valor claro, el jurado de 3 modelos saturaba la Mac Studio y había fallas críticas de seguridad y gobierno. Se decidió reconstruir desde cero en vez de arreglar pieza por pieza.

- **Relación con 005 (BI v1):** queda intacto como **cantera de activos de solo lectura** — no se modifica ni se opera, y se eliminará cuando el 006 esté desplegado en `bi.innovadataco.com` (corte que ejecuta Jelkin). De ahí se reutilizan: el catálogo BI (`BICatalogoTabla/Columna/Metrica/Ejemplo` + seed), las vistas materializadas `mv_fact_*`, los scripts de réplica pg_logical, y los conceptos `BIConsultaLog` y `BICacheSemantico`. Se eliminan para siempre: Superset, Vanna, jurado de 3 modelos, login con clave en claro y paso de `rol` por body.
- **Relación con PI (`002-2026-PROTECCION-INFANTIL`):** PI es la **fuente de datos**, accedida vía una **réplica PostgreSQL read-only** (las consultas pesadas de BI no deben afectar la operación de PI). La **auth es login propio de BI**, cerrado por defecto: sin sesión válida no se ve nada. BI **NO comparte login/JWT/cookie/secreto con PI** — son productos separados en administración (decisión CEO 31-08-2026).

## Stack y dominio

- **Dominio:** https://bi.innovadataco.com/
- **App:** Next.js 16 + TypeScript + Tailwind + Prisma (dashboards nativos con Tremor/Recharts/ECharts).
- **Datos:** PostgreSQL, réplica read-only de PI (pg_logical, publicación `bi_replica` sin tablas con PII).
- **Motor NL→SQL:** un solo modelo Ollama `qwen2.5:14b` (temperature 0, structured outputs). El modelo genera SQL de **solo lectura** contra la réplica.
- **Deploy:** Docker Compose en VPS Hostinger.

## Arquitectura de alto nivel

```text
Usuario (login propio BI)
      │
      ▼
App Next.js (BI v2) ──VPS Hostinger──┐
      │                              │
      ├──► Réplica PostgreSQL        │ Docker Compose
      │    (read-only de PI)         │
      │                              │
      └──► Ollama qwen2.5:14b  ──────┘
           Mac Studio vía Tailscale
           (100.91.87.86:11435)
```

## Estado actual

**Fase 1 — base documental y scaffolding** (SPEC-001). No hay código de aplicación todavía. Trabajo en la **rama única** `work/bi-SPEC-006-bi-v2` (de ella salen todos los PRs; no se borra tras merge, se rebasa sobre `main`).

## Punteros

- `AGENTS.md` — reglas, convenciones y contexto para agentes de IA.
- `.specify/specs/001-scaffolding-inicial/spec.md` — spec de la fase actual.
