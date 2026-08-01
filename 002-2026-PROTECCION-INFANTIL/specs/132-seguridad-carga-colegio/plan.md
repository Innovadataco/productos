# Implementation Plan: SPEC-132 — Seguridad de la carga masiva del colegio (S-3 + S-4)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/132-seguridad-carga-colegio/spec.md` (instructivo 002-PI-055)

## Summary

Dos fixes acotados en el flujo de carga masiva del colegio. **S-3**: el parser deja
`xlsx` (CVEs) por `exceljs` con fidelidad total (mismos fixtures) y límites explícitos
de tamaño/filas. **S-4**: el roster de alumnos sale del JWT: se persiste en una tabla
aditiva `CargaRosterSesion` (con `colegioId` y TTL) y el token firma SOLO el id de
sesión; la confirmación lee el roster por ese id con guardas de expiración y aislamiento.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: `exceljs` (NUEVA, reemplaza `xlsx` que se retira del runtime);
Prisma (tabla aditiva); `jose` (JWT corto, ya instalado). Ninguna otra dependencia nueva.

**Storage**: PostgreSQL 16 — `CargaRosterSesion` (ADITIVA): `id`, `colegioId`, `filas`
(Json), `creadoEn`, `expiraEn`

**Testing**: Vitest — fidelidad del parser (fixtures intactos), límites, token sin PII,
flujo validar→confirmar por id, ids vencidos/ajenos

**Target Platform**: Next.js standalone (dev Mac + prod VPS); worker para limpieza TTL

**Project Type**: hardening de seguridad en flujo de carga

**Performance Goals**: parseo con límites (sin reads ilimitados); roster en BD con lectura
por PK (sin impacto medible)

**Constraints**: fidelidad del parseo (fechas/encoding/columnas iguales); migración
ADITIVA; NADA de PII en el token; NO tocar motor, schema de Reporte ni visibilidad;
límites como parámetros (ADR_004) o constantes documentadas

**Scale/Scope**: 2 archivos del flujo (`parser.ts`, `token.ts` → reemplazo por sesión),
2 rutas, 1 tabla aditiva, 1 dependencia nueva, limpieza TTL, tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **§1.2 Solo texto / sin multimedia**: OK — el Excel de carga es el único archivo
  permitido del flujo colegio (existente); no se amplía nada.
- **§6.3 Protección de datos sensibles**: ES la spec S-4 — la PII de menores deja de
  viajar en un token legible; el roster vive server-side con TTL.
- **Seguridad / dependencias mantenidas**: ES la spec S-3 — se retira `xlsx` (CVEs) por
  `exceljs` (mantenida). La nueva dependencia queda justificada aquí (no es capricho:
  reemplazo de una librería vulnerable).
- **Migraciones aditivas**: OK — `CargaRosterSesion` es tabla nueva; nada se borra.
- **Multi-tenant**: OK — la sesión queda ligada a `colegioId` y la confirmación valida
  pertenencia (aislamiento intacto).
- **Metodología Spec-Kit**: OK — spec+plan; compuerta §4 (PARA antes de tasks/implement).

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/132-seguridad-carga-colegio/
├── plan.md              # This file
├── research.md          # Phase 0 (CVEs de xlsx, fidelidad exceljs, opciones de store)
├── quickstart.md        # Phase 1 (validación S-3 + S-4 end-to-end)
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Phase 2 (speckit-tasks) — TRAS aprobación de ZEUS (compuerta §4)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                       # + CargaRosterSesion (ADITIVA)
│   └── migrations/NNNN_carga_roster_sesion/
├── src/lib/colegio/carga/
│   ├── parser.ts                           # xlsx → exceljs + límites (S-3)
│   ├── token.ts                            # JWT corto SOLO { sesionId, colegioId } (S-4)
│   ├── sesion-roster.ts                    # NUEVO: persistir/leer roster por id (TTL)
│   └── parser.test.ts                      # fixtures INTACTOS (fidelidad)
├── src/app/api/colegio/carga/
│   ├── validar/route.ts                    # persiste sesión, firma solo el id
│   └── confirmar/route.ts                  # lee roster por id (guardas TTL/aislamiento)
├── scripts/ (worker)                       # limpieza de sesiones expiradas
├── package.json                            # + exceljs, − xlsx
└── docs/architecture/01-modelo-datos.md    # regenerado (arch:check)
```

**Structure Decision**: `token.ts` deja de transportar datos y pasa a firmar ids; la
sesión vive en `sesion-roster.ts` (DAL del flujo). El parser conserva la forma pública
(`parseArchivoCarga`, `FilaCargaAlumno`, errores por fila) para fidelidad total.

## Decisiones de diseño (Phase 1)

### D1 — exceljs con fidelidad verificada por fixtures (S-3)
`parser.ts` reemplaza `XLSX.read` por `ExcelJS.Workbook.xlsx.load(arrayBuffer)`:
- Se lee la PRIMERA hoja y se materializa a la misma matriz de strings de hoy
  (`header: 1`, `defval: ""`, `blankrows: false`, `raw: true` → equivalencia: celdas
  con su valor crudo, fechas como `Date` → `String(fecha)` — verificar contra fixtures:
  los tests de `parser.test.ts` NO cambian su expectativa).
- Límites (S-3): `carga.max_archivo_bytes` (default 5 MB) y `carga.max_filas`
  (default 2000) como parámetros de sistema con fallback documentado; el exceso se
  rechaza con error claro ANTES de procesar filas.
- El CSV manual actual se conserva tal cual.
- `xlsx` se elimina de `package.json` (fuera del bundle de producción).

### D2 — Sesión de roster en BD con TTL (S-4)
Tabla ADITIVA `CargaRosterSesion { id String @id @default(cuid()), colegioId String,
filas Json, creadoEn DateTime @default(now()), expiraEn DateTime }`.
- `validar`: tras validar filas, crea la sesión (expiraEn = now + 15 min) y firma un JWT
  corto SOLO con `{ sesionId, colegioId }`.
- `confirmar`: verifica el JWT, carga la sesión por `sesionId` y valida: existe,
  `expiraEn > now`, `colegioId` del usuario = `colegioId` de la sesión. Rechazos con
  mensaje claro ("la validación expiró, vuelve a validar el archivo").
- Limpieza: job del worker (mismo patrón que apelacion-mantenimiento) borra sesiones
  con `expiraEn < now` (diario; la guarda de lectura ya impide su uso).

### D3 — El token sin PII con guarda de test (FR-004, SC-003)
`generarTokenCarga({ sesionId, colegioId })` → payload solo ids. Test estructural:
decodifica el JWT de validar y falla si el payload contiene `filas`, nombres o
identificadores (guarda anti-recaída).

### D4 — Flujo confirmar idéntico en resultado (FR-005)
`confirmar` cambia SOLO la fuente del roster (de `payload.filas` del JWT a
`sesion.filas` de la BD); el importer (`importer.ts`) NO se toca: misma importación,
mismos tests de flujo. Doble confirmación con el mismo token: comportamiento actual
documentado (idempotencia del importer, sin cambios).

## Research resumido (Phase 0 → research.md)

Estado actual (token con roster en claro, xlsx vulnerable), equivalencia exceljs vs xlsx
para los fixtures, y opciones de store (BD con TTL vs caché en memoria): se elige BD por
robustez a reinicios y auditoría, con migración aditiva.

## Quickstart (validación) → [quickstart.md](quickstart.md)

Validación guiada: parser idéntico, límites, token sin PII (decodificar y comprobar),
validar→confirmar end-to-end por id, id vencido/ajeno rechazado, limpieza TTL y gates.

## Contracts

N/A — mismos endpoints (`validar` devuelve `tokenConfirmacion`; `confirmar` lo consume);
solo cambia el CONTENIDO del token (ids, no roster) y la fuente del roster en confirmar.

## Data Model

ADITIVA: `CargaRosterSesion` (id, colegioId, filas Json, creadoEn, expiraEn) + índice
por `expiraEn` (limpieza). Sin cambios destructivos.

## Constitution Check (post-diseño)

Re-evaluado tras Phase 1: sin cambios — ninguna violación.

## Complexity Tracking

Sin violaciones de constitución que justificar.
