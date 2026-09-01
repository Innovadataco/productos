# SPEC-001 · BI v2 · Producto nuevo 006 sobre esqueleto PI

**Status:** DESARROLLO

## Objetivo

Crear el producto `006-2026-INTELIGENCIA-NEGOCIO` ("BI v2") desde cero, usando el esqueleto técnico y de diseño de PI, eliminando Vanna y Superset, y usando un solo modelo Ollama para NL→SQL. El producto ofrece análisis descriptivo de la operación de PI (qué pasó, qué está pasando, histórico): reportes por fechas, tendencias, comportamientos, proyecciones y estadísticas. El modelo genera SQL de solo lectura contra la réplica.

## Contexto del producto

- **Producto nuevo:** `006-2026-INTELIGENCIA-NEGOCIO` es una carpeta nueva del monorepo `productos`. No es una reconstrucción dentro de `005-2026-BI-INTELIGENCIA-NEGOCIO` (BI v1): no hay carpeta `_legacy` ni se toca código de 005.
- **BI v1 (005):** queda intacto, solo como referencia y cantera de activos reutilizables. El dueño pidió no arreglarlo pieza por pieza. En el VPS ya se borraron sus contenedores/volúmenes de Superset y Vanna y se paró el stack de BI v1. PI sigue corriendo intacto.
- **Aislamiento de PI:** BI corre aparte de PI a propósito; las consultas pesadas de BI no deben afectar la operación de PI (por eso réplica read-only).

## Razones

- El BI v1 no funciona a satisfacción del dueño del producto (Jelkin).
- Superset y Vanna consumen recursos y no aportan valor claro.
- El jurado de 3 modelos satura la Mac Studio sin mejora real.
- El BI v1 tiene fallas críticas de seguridad y gobierno.
- PI ya tiene una base de código madura, con auth, CI/CD y convenciones probadas.

## Decisiones

| Decisión | Valor |
|---|---|
| Producto | `006-2026-INTELIGENCIA-NEGOCIO` (nuevo, sucesor de 005) |
| Dominio | `https://bi.innovadataco.com/` |
| Stack app | Next.js 16 + TypeScript + Tailwind + Prisma |
| Base de datos | PostgreSQL réplica de PI (solo lectura) |
| Auth | JWT compartido con PI (no login propio con clave en claro) |
| NL→SQL | 1 solo modelo Ollama `qwen2.5:14b`, temperature 0, structured outputs |
| Dashboards | Nativos en Next.js + Tremor/Recharts/ECharts |
| Deploy | Docker Compose en VPS Hostinger |
| Ollama | Mac Studio vía Tailscale (`100.91.87.86:11435`) |

## Lo que se elimina

- Apache Superset (dashboards y metadata DB)
- Vanna.ai (servicio Python pesado)
- Jurado de 3 modelos
- Login propio con clave en claro
- Paso de `rol` por body del cliente

## Lo que se reutiliza de 005

- Catálogo BI (`BICatalogoTabla`, `BICatalogoColumna`, `BICatalogoMetrica`, `BICatalogoEjemplo`) + seed
- Vistas materializadas (`mv_fact_*`)
- Scripts de réplica pg_logical
- Concepto de log de consultas (`BIConsultaLog`)
- Cache semántico (`BICacheSemantico`)

## Migración de activos desde 005

La lista canónica de qué se copia de 005 a 006 vive en `inventario-activos-005.md` (mismo directorio). Cada activo se migra copiándolo a su ubicación en 006 y ajustándolo a las convenciones del producto nuevo; 005 nunca se modifica. Un activo no listado en el inventario no se migra.

## Estructura de BI v2

```
006-2026-INTELIGENCIA-NEGOCIO/
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
├── prisma/
│   ├── schema.prisma         # Catálogo BI + logs + cache
│   ├── migrations/           # MVs y schema
│   └── seed.ts               # Seed idempotente
├── scripts/
│   └── replica-setup/        # Configuración réplica
├── tests/
├── .github/workflows/        # CI/CD (nuevo)
├── .specify/specs/           # Specs Spec-Kit
└── docker-compose.yml        # Sin Superset ni Vanna
```

## Fases de implementación

1. **Fase 1:** Esqueleto + auth compartida + dominio + CI
2. **Fase 2:** Motor NL→SQL con 1 modelo + catálogo + validador
3. **Fase 3:** Dashboards en Next.js + chat UI
4. **Fase 4:** Deploy en Hostinger + verificación en vivo

## Riesgos a vigilar

- Cambios en la BD de PI requieren actualizar catálogo BI y MVs manualmente.
- Un solo modelo puede fallar; el validador post-LLM debe ser estricto.
- La réplica debe mantenerse actualizada; el healthcheck del BI debe detectar MVs rotas.

## Decisiones registradas por el CEO (2026-09-01)

- **006 = segunda versión de BI y reemplaza al 005.** El 005 es SOLO referencia de lectura: no se reutiliza su código por copia masiva, no se depende de él, no se toca. Se eliminará cuando el 006 esté desplegado en `bi.innovadataco.com`.
- **Dominio final:** `bi.innovadataco.com` (hoy lo sirve el 005). El corte de dominio lo ejecuta el CEO al final del proyecto.
- **La vista `/operacion`** que hoy vive en el 005 debe existir también en el 006 antes del corte de dominio.
- **Prefijo de rama:** el gate del repo exige prefijo de la lista `(pi|bi|mod|idc|sicov|sarlaft)`; el 006 ES el nuevo BI, así que usa prefijo `bi`.

## Estado

- **Fecha:** 2026-09-01
- **Autor:** Jelkin (decisión) + Fábrica (ejecución)
- **Rama:** `work/bi-SPEC-001-scaffolding-inicial`
- **Worktree:** `.worktrees/bi-SPEC-001-scaffolding`
