# Tasks · SPEC-360 · A-70 tanda 2

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-01 · **Dev**: PI-1

## Fase 1 · Análisis real en Mis reportes (F11)

- [x] T001 Extender `EventoCadenaDto` con `analisisIa` y `ficha` en `src/lib/dal/services/cadenas-padre.ts`
- [x] T002 Leer `ClasificacionIA` (categoría, confianza, secundarias, modelo) en el `include` del listado
- [x] T003 Parser tolerante `leerSecundarias()` para el `Json` libre de `categoriasSecundarias`
- [x] T004 Reescribir `src/components/modules/padre/VerAnalisis.tsx`: resultado real + `EstadoTransicion` + ficha
- [x] T005 Bajar la explicación parametrizada a una línea "Qué significa"
- [x] T006 Estado honesto ("En revisión por una persona") cuando no hay clasificación
- [x] T007 [P] Tests en `src/lib/dal/services/cadenas-padre.test.ts` (5)

## Fase 2 · Bitácora del menor (F10)

- [x] T008 Leer en fuente `hijos/hijos.ts` la forma real de cada `logAudit` (candado 15v5)
- [x] T009 Agregar `{ hijoId }` al metadato de `HIJO_IDENTIFICADOR_DESVINCULADO`
- [x] T010 Servicio `src/lib/dal/services/bitacora-menor.ts` con boundary 404
- [x] T011 Ruta `GET /api/padre/hijos/[id]/bitacora`
- [x] T012 Componente `src/components/modules/padre/BitacoraMenor.tsx`
- [x] T013 Montarla bajo demanda en la tarjeta de `MisHijos.tsx`
- [x] T014 [P] Tests en `src/lib/dal/services/bitacora-menor.test.ts` (8)
- [x] T015 Regresión de `hijos/` completo (candado 24v2): 24 verdes

## Fase 3 · Detalles del expediente (G18, G19, G20)

- [x] T016 `EncuadrarEnPuntos` con `fitBounds` en `MapaUbicaciones.tsx` (G18)
- [x] T017 Selector de velocidad 0.5×/1×/2×/4× en `ExpedienteVivo.tsx` (G19)
- [x] T018 `fechaHoraSinMinutos()` y `aHoraEnPunto()` en `src/lib/format/fecha.ts` (G20)
- [x] T019 `step={3600}` y normalización al capturar en `ReporteStepDetalle.tsx`
- [x] T020 [P] Tests de formato (11)

## Fase 4 · Puertas

- [x] T021 `tsc --noEmit` limpio
- [x] T022 `arch:check` verde (`02-roles-capacidades.md` regenerado por la ruta nueva)
- [x] T023 `tokens:check` verde (1083, sin subir del piso)
- [x] T024 `locks:check` verde
- [x] T025 `lint` sin errores
- [x] T026 `test:unit` verde
