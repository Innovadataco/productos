# Tasks: SPEC-132 — Seguridad de la carga masiva del colegio

**Input**: Design documents from `specs/132-seguridad-carga-colegio/` (aprobados por
ZEUS en compuerta §4 con condiciones O-1..O-4)

## Phase 1: S-3 — Parser con exceljs

- [x] T001 `exceljs` instalado y `xlsx` fuera por completo (runtime y tests; `npm ls xlsx` vacío, O-3)
- [x] T002 `parser.ts` migrado a exceljs con fidelidad: fixtures de `parser.test.ts`
  intactos, expectativas sin cambios (O-1)
- [x] T003 Límites explícitos (`carga.max_archivo_bytes` 5 MB; `colegio.carga.max_filas`,
  misma clave que la ruta) + tests de rechazo

## Phase 2: S-4 — Roster server-side

- [x] T004 Tabla ADITIVA `CargaRosterSesion` (+FK a Colegio) y regenerar `01-modelo-datos.md` (O-4)
- [x] T005 `sesion-roster.ts`: crear/leer con guardas (TTL 15 min, tenant), consumir,
  purga backstop; `token.ts` firma SOLO `{ sesionId, colegioId }` (sin PII)
- [x] T006 `validar` persiste la sesión y firma el id; `confirmar` lee por id con
  guardas (vencida/inexistente/ajena) y BORRA la sesión en la MISMA tx del import (O-2)
- [x] T007 Limpieza backstop en el worker (`carga-roster-limpieza`, cada 15 min)

## Phase 3: Tests y cierre

- [x] T008 Tests: payload del JWT sin PII (guarda), guardas de sesión, single-use sin
  duplicados (route + flujo), test viejo de reuso actualizado al nuevo contrato
- [x] T009 Gates: 46 tests del flujo, `tsc`, build, `arch:check` VERDE (01-modelo y
  06-stack regenerados), suite completa
- [x] T010 Status IMPLEMENTADO en `spec.md` + Implementación con O-1..O-4 registradas +
  índice `specs/README.md`
