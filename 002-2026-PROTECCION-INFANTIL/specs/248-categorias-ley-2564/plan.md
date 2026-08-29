# Implementation Plan: SPEC-248 — Categorías Ley 2564 completas + Definiciones legales editables

**Branch**: `work/002-PI-151` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/248-categorias-ley-2564/spec.md`

## Summary

Cerrar la cobertura del motor de clasificación IA frente a la Ley 2564 art. 6 (3 categorías nuevas) + dar a `ADMIN` un editor de fundamento legal por categoría, sin deploy. Enfoque: replicar 1:1 el patrón de SPEC-195/199 (agregado del motor SPAM) para las 3 categorías nuevas, y reutilizar el mecanismo de parámetros dinámicos (`ParametroSistema`) ya usado por `ia.rubrica.preguntas` para el nuevo `ia.rubrica.definiciones`. Cero tablas nuevas, cero endpoints paralelos a los ya existentes de rúbrica — solo extensión aditiva.

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Node.js ≥22

**Primary Dependencies**: Next.js 16 App Router (API Routes), Prisma 5.22 + PostgreSQL 16 (`pgvector/pgvector:pg16`), React 19 (Server/Client Components), Tailwind CSS 3.4

**Storage**: PostgreSQL — 1 migración aditiva de enum (`CategoriaConducta` +3 valores) + 1 migración aditiva de enum (`AccionAudit` +1 valor, ver Decisiones) + parámetros nuevos/actualizados en `ParametroSistema` (tabla existente, sin cambio de esquema)

**Testing**: Vitest (unitario: `rubrica-semilla.test.ts`; integración: `route.test.ts` de los 3 endpoints tocados/nuevos) — sin Playwright nuevo (no hay flujo E2E nuevo, es un editor dentro de una vista admin existente)

**Target Platform**: mismo runtime que el resto del producto (Next.js server, worker no se toca)

**Project Type**: web-service (Next.js monolito, App Router) — Option 1 del template, sin frontend/backend separados

**Performance Goals**: sin objetivo nuevo; el editor es de bajo tráfico (uso admin ocasional). El motor de clasificación no cambia su latencia (definiciones no entran al prompt).

**Constraints**: migración de enum sin lock destructivo (Postgres ≥12, cumplido); cero breaking change en `GET /api/admin/ia/rubrica`; candado de motor IA (`src/lib/ai/**`) — solo `rubrica-semilla.ts` es tocable.

**Scale/Scope**: 3 categorías nuevas (de 12 a 15 en el enum), 14 definiciones legales, 1 componente UI nuevo, 2 endpoints nuevos + 1 extendido, 1 migración con 4 `ALTER TYPE` (3 `CategoriaConducta` + 1 `AccionAudit`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio (constitution.md) | Cumple | Nota |
|---|---|---|
| §1.5 Clasificación de conductas, no scoring de personas | ✅ | Las 3 categorías nuevas son conductas, no juicios sobre personas; mismo patrón que las 11 existentes. |
| §1.5 IA local, textos nunca salen del servidor | ✅ | No se toca `ollama-client.ts` ni el flujo de llamado a modelos; solo se agregan categorías al vocabulario existente. |
| §2.1 Stack heredado (Next.js/Prisma/JWT/pg-boss) | ✅ | Sin nuevas dependencias. |
| §3.1 TypeScript estricto, sin `any` | ✅ | `DefinicionCategoria` tipado; filtros Prisma con `Prisma.*WhereInput` donde aplique (no hay filtros dinámicos nuevos, es `findUnique`/`upsert` por clave). |
| §4.5 Migraciones aditivas, `tenantId` en entidades de negocio | ✅ | `ParametroSistema` y `CategoriaConducta`/`AccionAudit` son catálogos globales (no llevan `tenantId`, igual que hoy). |
| I-101 candado motor IA | ⚠️ ver Decisión 1 abajo | Resuelto sin tocar `rubrica.ts`. |

Sin violaciones que requieran `Complexity Tracking`.

## Decisiones técnicas (para auditoría de ZEUS en la compuerta §4)

### Decisión 1 — `definiciones` se resuelve en el route handler, NO en `src/lib/ai/rubrica.ts`

El candado autoriza tocar únicamente `src/lib/ai/rubrica-semilla.ts` dentro de `src/lib/ai/**`. `cargarConfigRubrica()` (en `src/lib/ai/rubrica.ts`, INTOCABLE) es la función que hoy arma la respuesta de `GET /api/admin/ia/rubrica`. En vez de extender esa función, el `GET` extendido y los 2 endpoints nuevos leen `ia.rubrica.definiciones` directamente vía `getParametroSistema()` (mismo helper que ya usa `rubrica.ts`, importado desde `src/lib/parametros.ts`, fuera del candado) con fallback a `DEFINICIONES_CATEGORIA` (constante en `rubrica-semilla.ts`, sí tocable). Cero cambio en `rubrica.ts`, cero cambio en el flujo de clasificación (embudo/voto). Esta lógica de "leer parámetro con fallback a constante" queda inline en cada route handler (2-3 líneas, 3 call sites) en vez de crear un archivo nuevo bajo `src/lib/ai/` — crear un archivo nuevo ahí también caería bajo el candado.

### Decisión 2 — `AccionAudit` gana un valor nuevo (`RUBRICA_DEFINICION_UPDATE`), migración aditiva adicional

El instructivo pide explícitamente `AuditLog` con `accion: 'RUBRICA_DEFINICION_UPDATE'`. El campo `accion` de `AuditLog` está tipado como enum `AccionAudit` (no string libre) — no existe hoy ese valor. La sección "schema.prisma sagrado" del candado menciona por nombre solo los 3 valores de `CategoriaConducta`; no menciona `AccionAudit`. Se resuelve agregando el valor de forma aditiva en la MISMA migración (`ALTER TYPE "AccionAudit" ADD VALUE IF NOT EXISTS 'RUBRICA_DEFINICION_UPDATE';`), replicando el patrón ya usado por SPEC-239 para `CONTACTO_EMERGENCIA_CREADO`/`_ACTUALIZADO`/`_ELIMINADO`/`_FALLBACK_USADO` (mismo archivo `schema.prisma`, mismo tipo de `ALTER TYPE`, mismo commit). **Se señala explícitamente aquí porque el candado no lo menciona por nombre — es el punto que más cambiaría el veredicto de ZEUS si no lo lee.** Alternativa descartada: reutilizar `PARAM_UPDATE` (como hace hoy `PATCH .../rubrica/preguntas`) — se prefiere el valor específico porque el instructivo lo pide explícitamente y el precedente SPEC-239 confirma que es la convención vigente del proyecto para acciones de dominio nuevas.

### Decisión 3 — `ui.grupos_categoria`: se agregan entradas, no se reemplaza la estructura

El parámetro ya existe con una agrupación editada por el CEO (5 grupos: `contacto_sexual`, `manipulacion_engano`, `amenazas_extorsion`, `contenido_falso_ia`, `otro`) — distinta del default propuesto en el brief §5.6 (9 grupos estilo Ley 2564). Se sigue el candado literal: el seed usa `update: {}` (no pisa si ya existe). Las 3 categorías nuevas quedan en el DEFAULT que se siembra únicamente si el parámetro no existe aún (instalación nueva); en un ambiente con el parámetro ya vivo (como producción hoy), quedarán sin grupo comercial asignado hasta que el CEO las agregue manualmente desde `/admin/configuracion` — esto es consistente con "reutilizar mecanismos existentes, no inventar lógica de merge que el mecanismo actual no tiene".

## Project Structure

### Documentation (this feature)

```text
specs/248-categorias-ley-2564/
├── spec.md               # hecho
├── plan.md               # este archivo
├── research.md           # Phase 0
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
├── contracts/
│   └── rubrica-definiciones-api.md
└── tasks.md              # Phase 2 — /speckit.tasks, DESPUÉS de la aprobación de ZEUS
```

### Source Code (repository root: `002-2026-PROTECCION-INFANTIL/`)

```text
prisma/
├── schema.prisma                                  # enum CategoriaConducta +3, enum AccionAudit +1
├── migrations/
│   └── 20260825_agregar_categorias_ley_2564/      # ALTER TYPE x4, sin DROP/CREATE
└── seed.ts                                        # bloque rubricaParams (forzar preguntas) +
                                                     # bloque nuevo ia.rubrica.definiciones (idempotente) +
                                                     # severidadesSeed +3 + ui.grupos_categoria (respetuoso)

src/lib/
├── ai/rubrica-semilla.ts                          # ÚNICO archivo tocable del motor IA:
│                                                    #   RUBRICA_SEMILLA +3 bloques
│                                                    #   type DefinicionCategoria (nuevo)
│                                                    #   DEFINICIONES_CATEGORIA (nuevo, 14 entradas)
└── labels.ts                                       # CATEGORIAS_LABELS +3

src/app/api/admin/ia/rubrica/
├── route.ts                                        # GET: agrega `definiciones` (lee param + fallback)
└── definiciones/
    ├── route.ts                                    # GET — todas las definiciones (ADMIN | COMITE_VALIDACION)
    └── [categoria]/
        └── route.ts                                # PATCH — 1 definición (ADMIN), AuditLog

src/components/modules/ia/
├── RubricaTab.tsx                                  # agrega <DefinicionLegalCard/> antes de las preguntas
└── DefinicionLegalCard.tsx                          # NUEVO: card ámbar + modal edición (4 campos)

tests/
├── src/lib/ai/rubrica-semilla.test.ts              # 5 preguntas x3, 2 decisivas, 14 definiciones
├── src/app/api/admin/ia/rubrica/route.test.ts       # extiende: `definiciones` presente, campos previos intactos
├── src/app/api/admin/ia/rubrica/definiciones/route.test.ts           # GET nuevo
└── src/app/api/admin/ia/rubrica/definiciones/[categoria]/route.test.ts  # PATCH nuevo: 200/403/404 + AuditLog
```

**Structure Decision**: monolito Next.js existente (Option 1). No hay frontend/backend separados; el "contrato" de los 2 endpoints nuevos se documenta en `contracts/` porque son API Routes consumidas por `RubricaTab.tsx`/`DefinicionLegalCard.tsx` en el mismo repo.

## Complexity Tracking

Sin violaciones de la constitución que requieran justificación. Las 2 migraciones de enum aditivas (Decisión 2) se documentan arriba para auditoría, no porque violen un principio — son del mismo tipo ya usado en SPEC-239.
