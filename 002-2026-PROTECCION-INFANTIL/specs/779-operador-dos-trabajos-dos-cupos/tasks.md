# SPEC-779 · Tasks

## Fase 1 · Motor (piezas 1 y 2) — HECHO

- [x] T001 `contarSesionesVigentesDeOperador(operadorId, estados, desde)` con corte de fecha. `src/lib/dal/repositories/solicitud-cita.ts`
- [x] T002 `seleccionarOperador` filtra por cupo adentro y devuelve `null`; `OperadorCandidato` genérico (`cupo`/`cargaActual`). `src/lib/operadores/asignador.ts`
- [x] T003 `obtenerConfigAsignacion` expone `cupoSesionesDefault`; el camino de CASOS conserva conducta. `src/lib/operadores/asignador.ts`
- [x] T004 Asignador de citas usa cupo de sesiones + conteo vigente + maneja `null` (sube al admin). `src/lib/operadores/asignador-citas.ts`
- [x] T005 Parámetro `operadores.cupo_sesiones_default` en el arnés de test. `src/lib/reporte-test-utils.ts`
- [x] T006 [P] Candado estructural (over-cupo → null, nunca colapsa) + RED-first probado. `src/lib/operadores/asignador-cupo.candado.test.ts`
- [x] T007 [P] Candado de integración con dato real (mutación ambos sentidos + corte de fecha). `src/lib/operadores/asignador-citas-cupo.candado.test.ts`

## Fase 2 · Pantalla (pieza 3) — HECHO (pendiente cert de Diseño)

- [x] T008 `CargaDosTrabajos` + `chipAlTope` (FORMA-SPEC779). `src/components/modules/operadores/CargaDosTrabajos.tsx`
- [x] T009 Detalle: reemplaza `OperadorDetalleClient.tsx:104-105`; métricas cuentan sesiones con la misma fuente. `src/lib/dal/services/operador-metricas.ts`
- [x] T010 Lista: columna Carga (dos mini-barras + chip); `operadores.listar` computa sesiones con la misma fuente. `src/app/dashboard/admin/operadores/gestion/GestionClient.tsx`
- [x] T011 [P] Candado de render (dos cargas / sin total / sin semáforo / ámbar-no-rubí / opuestas / número real). `src/components/modules/operadores/CargaDosTrabajos.candado.test.tsx`
- [ ] T012 Certificación de Diseño de la pantalla (vía CEO). NO la certifica Desarrollo.

## Fuera de alcance (declarado)

- Cupo de sesiones PER-OPERADOR (columna nueva → Datos). Hoy es un tope global por parámetro.
