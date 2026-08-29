# CIERRE — SPEC-122 (bloque R4): capa de datos de reportes

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Sin push** (empuja el coordinador)

## Qué se hizo

Refactor ADITIVO de la capa de datos en rutas API: una lib central de predicados
(`src/lib/reportes-acceso.ts`) captura las formas manuales del filtro
`eliminado: false` y 12 rutas migran a ella. El predicado de "aprobado"
(`whereReporteAprobado`, spec 089) se reutiliza por reexportación, sin duplicarse.

## Commits (cronológicos)

| Hash | Contenido |
|------|-----------|
| `6652d4ae` | feat(datos): capa central de predicados + test de equivalencia (20 casos) |
| `62e0fe48` | refactor(api): estadísticas públicas + detalle de consulta |
| `eb786ccf` | refactor(api): mis-reportes del padre |
| `f0b8452a` | refactor(api): estadísticas admin (2 rutas, 16 copias) |
| `9dc3974a` | refactor(api): operadores, asignación, reasignar, padres |
| `476a9e01` | refactor(api): bandejas spam/revisión + resolver de comité |

El séptimo commit (`docs(spec-122)`) introduce esta carpeta de artefactos; ver
`git log --oneline -7` en la rama.

## Rutas migradas (forma manual → predicado central)

1. `estadisticas-publicas/route.ts:45` — anidado `reporte: { estado in aprobados, eliminado:false }` → `whereReporteEnEstados(ESTADOS_APROBADOS)`
2. `consulta/detalle/route.ts:71` — `{ identificador, estado in visibles, eliminado:false }` → `whereReporteEnEstados(ESTADOS_VISIBLES, { identificador })`
3. `reportes/mis-reportes/route.ts:39` — `{ usuarioId, eliminado:false }` → `whereReporteVigente`
4. `admin/estadisticas/route.ts` (13 copias) — counts/groupBy/anidados → `whereReporteVigente` / `whereReporteEnEstado` / `whereReporteEnEstados`
5. `admin/estadisticas/clasificacion/route.ts` (3) — `REVISION_MANUAL` variantes → `whereReporteEnEstado`
6. `admin/operadores/route.ts` (2) — por operador → `whereReporteEnEstado` / `whereReporteVigente`
7. `admin/operadores/asignacion/route.ts` (2) — sin asignar / distribución → `whereReporteEnEstado`
8. `admin/reportes-revision/[id]/reasignar/route.ts` (1) — cupo → `whereReporteEnEstado`
9. `admin/padres/route.ts` (1) — conteo agregado → `whereReporteVigente`
10. `admin/spam/pendientes/route.ts` (1) — `{ eliminado:false, OR }` → `whereReporteVigente({ OR })`
11. `admin/reportes-revision/route.ts` (1) — asignación dinámica → `incluirEliminados ? {} : whereReporteVigente()`
12. `admin/comite/apelaciones/[id]/resolver/route.ts` (1) — validación de bajas → `whereReporteVigente`

**Migradas: 28 de 31 copias en `src/app/api/**`.** Restantes: 3 en
`reportes/procesar/helpers/rafagas.ts` (helper del motor — regla "no tocar el
motor", deuda T020) y 8 en `src/lib/**` (otros frentes, deuda T021).

## Equivalencia demostrada

- `src/lib/reportes-acceso.test.ts`: 20/20 verdes. Cada predicado es profundamente
  igual a la copia manual que reemplaza (objeto where idéntico ⇒ SQL idéntico);
  `whereReporteAprobado` reexportado es la MISMA referencia (`toBe`).
- Tests de integración de cada ruta migrada verdes por zona durante la migración
  (7 + 4 + 5 + 14 + 16 = 46 tests de ruta ejecutados).

## Evidencia del gate (bajo candado `/tmp/pi-gate-lock`)

- `npx tsc --noEmit`: ✅ `TSC_OK` (0 errores).
- `npm run lint`: ✅ `LINT_OK` (0 errores; 1 warning ajeno en
  `src/components/modules/ia/IaModelSelector.tsx:77`, componente UI de otro agente).
- `npm run build` (tras `rm -rf .next`): ✅ `BUILD_OK`.
- Suite completa `npm run test`: **1185 passed / 1 failed / 1 skipped** (190 archivos,
  267 s). El único fallo es AJENO/en vuelo: `src/lib/specs-discipline.test.ts:130`
  exige que `specs/README.md` indexe las carpetas nuevas (`122-capa-datos-reportes`,
  `123-…`, `124-…`); ese README pertenece a otro agente de la cola (regla de
  convivencia: no tocarlo) y lo actualiza el frente documental. Los 46 tests de las
  rutas migradas y los 20 del test de equivalencia pasan dentro de la suite.

## Deuda técnica

- T020: migrar las 3 copias de `rafagas.ts` cuando el frente del motor lo permita.
- T021: migrar las 8 copias de `src/lib/**` (apelaciones, lifecycle, asignador,
  círculo-confianza ×2, fuente-reporte ×2, colegio ×2) en su frente correspondiente.

## Confirmaciones

Sin push · sin tocar el motor · sin ablandar tests · sin secretos en commits ·
staging solo de archivos propios · equivalencia demostrada antes de migrar.
