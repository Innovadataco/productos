# Cierre — SPEC-217 · Freemium 30 días (002-PI-117)

Fecha: 2026-08-24 · Rama: `work/002-PI-mega-cola-restante` · Responsable: ODIN

## Qué se implementó

Freemium del Módulo Pagos según la spec aprobada en compuerta:

1. **Activación (US-001/US-002, FR-001..FR-004)**: `crearSuscripcionCliente`
   (`src/lib/pagos/freemium.service.ts`) es el servicio compartido de creación
   de `Suscripcion` (no existía ninguno en producción; la Deuda técnica 4 de la
   spec pedía ubicarlo ahí). Si `pagos.freemium.activo=true` y el titular no
   tiene freemium histórico (`freemiumFechaFin != null` por `usuarioId` o
   `colegioId`), crea la suscripción `ACTIVA` con `esFreemium=true`, plan
   básico `MES_1` del año Bogotá y `freemiumFechaFin = fechaInicio +
   pagos.freemium.duracion_dias` al final del día de corte Bogotá
   (`fechaFin = freemiumFechaFin`). Si el freemium no aplica, la suscripción
   nace `SUSPENDIDA` (estado que requiere pago, AS-003). El código de referido
   propio se genera en el mismo servicio (hook de SPEC-215).
2. **Conversión por pago (US-003, FR-005)**: `extenderVigenciaDesdeFreemium`,
   invocado fail-open desde el endpoint admin de autorización de pagos tras el
   hook de referidos: `esFreemium=false`, `fechaFin = max(freemiumFechaFin,
   hoy Bogotá) + duracionCubierta`, `fechaCorteProgramado=null` y, si el worker
   ya la había suspendido, reactivación a `ACTIVA`. `freemiumFechaFin` se
   conserva como marca de histórico del anti-doble freemium.
3. **Vencimiento y notificaciones (US-004, FR-006/FR-007)**: ya cubiertos por
   el worker de vigencia de SPEC-213 (corte `ACTIVA→SUSPENDIDA` con
   `suscripcion.freemium.terminado` y recordatorios T-7/T-1); esta spec no
   tocó ese flujo.
4. **Vista cliente (US-005, FR-008)**: `VistaSuscripcion` expone
   `esFreemium`, `freemiumFechaFin` y `diasRestantesFreemium`;
   `SuscripcionResumen` muestra "Te quedan N días" / "Termina hoy" (SC-002).
5. **Auditoría (FR-009)**: `SUSCRIPCION_FREEMIUM_ACTIVADA` y
   `SUSCRIPCION_FREEMIUM_CONVERTIDA` (valores nuevos de `AccionAudit`); la
   transición a suspendida la audita el worker (SPEC-213).
6. **Frontera DAL (FR-010)**: `PagosFreemiumRepository` nuevo;
   `pagos-repository.ts` (ya sobre max-lines) intacto.

## Archivos

### Creados

- `prisma/migrations/20260824100000_spec_217_freemium/migration.sql`
- `src/lib/dal/repositories/pagos-freemium-repository.ts`
- `src/lib/pagos/freemium.service.ts`
- `src/lib/pagos/freemium-calculos.ts`
- `src/lib/pagos/freemium.service.test.ts` (unitario, mocks; 9 tests)
- `src/lib/pagos/freemium-calculos.test.ts` (unitario puro; 9 tests)
- `src/lib/pagos/freemium.service.integration.test.ts` (T008/T009/T010; 5 tests)
- `specs/217-freemium-pagos/cierre.md`

### Modificados

- `prisma/schema.prisma` (índices `Suscripcion` + 2 valores `AccionAudit`, al final de cada bloque)
- `src/app/api/admin/pagos/pendientes/[id]/autorizar/route.ts` (hook freemium fail-open)
- `src/lib/pagos/suscripcion-vista.service.ts` / `suscripcion-vista.types.ts` (FR-008)
- `src/lib/pagos/parametros-pagos.ts` (`esFreemiumActivo`, `obtenerDuracionFreemiumDias`)
- `src/components/modules/cliente/suscripcion/SuscripcionResumen.tsx` (+ test)
- `vitest.unit.includes.ts` (registro de los 2 unitarios)
- `specs/217-freemium-pagos/{spec,tasks}.md`, `checklists/requirements.md`
- **Hallazgo SPEC-215 (preexistente, corregido para desbloquear el gate)**:
  `src/lib/dal/repositories/pagos-referidos-repository.ts` (nuevo método
  `existeCodigoReferidoPropio`), `src/lib/pagos/referido.service.ts` (firma de
  `generarCodigoReferidoUnico` apunta al repo correcto),
  `src/lib/pagos/referido.service.test.ts` y
  `src/app/api/pagos/aplicar-referido/route.test.ts` (fixtures con
  `codigoReferidoPropio` obligatorio).

## Verificación

- `npx prisma generate` — OK (schema tocado).
- `npx tsc --noEmit` — **0 errores en todo el árbol** (antes fallaba por el
  hallazgo de SPEC-215).
- `npm run test:unit -- freemium-calculos freemium.service SuscripcionResumen`
  — **25/25 verdes** (3 archivos; los errores de umbral de cobertura al correr
  subsets son el artefacto conocido).
- `npx eslint` sobre todos los archivos tocados — limpio.
- `npm run tokens:check` — VERDE (1090 ≤ piso 1094).
- Tests de integración (`freemium.service.integration.test.ts`) escritos pero
  NO corridos localmente: la BD compartida la gestiona el coordinador.
- Build + `dev-restart.sh` + quickstart contra app: los ejecuta el coordinador
  del mega-lote (serialización de commits y deploy).

## Desviaciones de la spec

1. **T005**: la spec asumía un "servicio central de creación de `Suscripcion`"
   existente; no había ninguno (solo `PagosRepository.crearSuscripcion` y
   tests). Se creó `crearSuscripcionCliente` como ese servicio canónico. Los
   flujos de registro de cliente y creación admin (cuando existan) deben
   consumirlo.
2. **Sin plan básico**: la Decisión 3 decía "loggear error y no activar
   freemium"; como `planActualId` es obligatorio, sin plan `MES_1` del año no
   se puede crear la suscripción en absoluto → `AppError` 500 tras loggear
   (más estricto que la decisión, imposible cumplirla de otra forma).
3. **Estado sin freemium (AS-003)**: "estado que requiera pago" se resolvió
   como `SUSPENDIDA` con `suspendidaEn` y `fechaFin = fechaInicio` (el enum no
   tiene `PENDIENTE_PAGO`).
4. **Reactivación al pagar**: si el worker ya suspendió el freemium vencido, el
   pago autorizado la devuelve a `ACTIVA` (transición manual
   `SUSPENDIDA→ACTIVA` que SPEC-213 reserva a SPEC-212; aquí la ejecuta el
   hook de conversión).
5. **T012 no ejecutado**: `specs/README.md` está congelado por el coordinador;
   el estado se actualizó en el encabezado de `spec.md`.

## Deuda técnica

- Conectar `crearSuscripcionCliente` a los endpoints de registro de cliente y
  creación admin cuando esos flujos se implementen.
- Las notificaciones T-7/T-1/T=0 dependen del seed del catálogo §10
  (SPEC-201), como ya advierte el worker de vigencia.
- SC-007 (CI 6/6) pendiente del commit/push del coordinador.
