# Tasks: SPEC-130 — Cifrado en reposo del texto del reporte

**Input**: Design documents from `specs/130-cifrado-reposo-texto-reporte/` (aprobados por
ZEUS en compuerta §4 con política D4 y condiciones O-1..O-5)

## Phase 1: Helper y escritura cifrada

- [x] T001 Helper `src/lib/texto-reporte-cifrado.ts` + tests (idempotencia lectura y
  escritura, O-3; marcador D4 nunca se cifra, O-2)
- [x] T002 Creación escribe `texto` cifrado (`dal/services/reporte-creation.ts`)
- [x] T003 Anonimización escribe cifrado (pipeline `anonimizacion.ts` y ruta admin
  `reportes/[id]/anonimizar`)

## Phase 2: Lectura por caminos autorizados

- [x] T004 Pipeline descifra al leer (`seguridad.obtenerReporte`)
- [x] T005 Resolvers y lectores al helper: spam resolver, correcciones, validar-anonimización,
  reportes-revision/[id], spam/pendientes, comité apelaciones detalle
- [x] T006 Guarda de frontera O-1 (`texto-reporte-frontera.test.ts`): ninguna ruta lee o
  escribe `Reporte.texto` sin el helper

## Phase 3: Política D4 (decisión ZEUS)

- [x] T007 Purga de `texto` a marcador en DUPLICADO al cierre del pipeline
- [x] T008 Purga en `darDeBajaReporte` (baja y spam confirmado); reactivar restaura la
  copia de trabajo desde `textoOriginal` (evidencia siempre cifrada, nunca purgada)

## Phase 4: Migración y cierre

- [x] T009 `scripts/migrar-cifrado-texto-reportes.ts` (lotes, conteos, idempotente);
  validada en DEV (O-4). PROD NO se corre hasta confirmación BL-2 del CEO
- [x] T010 Tests ajustados al nuevo contrato (descifrado conserva el contenido) y gates:
  suite completa + `tsc --noEmit` + build + `arch:check` verdes (O-5)
- [x] T011 Status IMPLEMENTADO en `spec.md` + Implementación con D4/O-1..O-5 registradas +
  índice `specs/README.md`
