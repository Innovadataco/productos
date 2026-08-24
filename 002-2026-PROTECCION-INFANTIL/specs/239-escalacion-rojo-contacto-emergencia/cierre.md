# Cierre: SPEC-239 — Escalación ROJO + SLA 12h + Contacto emergencia

**Fecha**: 2026-08-24 | **Rama**: `work/002-PI-mega-cola-restante`

---

## Resumen

Implementado el flujo completo: modelo `ContactoEmergencia` (CRUD del padre con ownership y baja lógica), handler de `expediente.gravedad.subio_a_rojo` que fija SLA efectivo 12h y audita con nivel CRITICAL, endpoint de activación de emergencia para el comité con fallback de contactos 1→2→3, extensión del tick del worker `pi-expediente-motor` para vigilar el SLA 12h desde `fechaEscaladoRojoEn`, y botón "Activar emergencia" (ruby + modal) en la vista de consolidación del comité.

## Archivos

### Creados

- `prisma/migrations/20260824140000_spec_239_contacto_emergencia/migration.sql` (aditiva: enum `RelacionContactoEmergencia`, tabla `contactos_emergencia`, columnas `Expediente.slaEfectivoHoras`/`fechaEscaladoRojoEn`, índices, 8 valores de `AccionAudit`).
- `src/lib/dal/repositories/contacto-emergencia.ts` — repo DAL acotado a `padreUsuarioId` (Q-3).
- `src/lib/dal/repositories/contacto-emergencia.test.ts` — integración (T006; corre el coordinador).
- `src/lib/expediente/handlers/gravedad-subio-a-rojo.ts` — handler FR-004.
- `src/lib/expediente/handlers/gravedad-subio-a-rojo.test.ts` — integración (T009).
- `src/lib/expediente/activar-emergencia.ts` — servicio US3/FR-005.
- `src/lib/expediente/motor/vigilar-sla-rojo.test.ts` — integración de la tarea del worker (T019).
- `src/lib/expediente/seed-emergencia.test.ts` — integración seed + render de plantilla (T023/T024/T025).
- `src/lib/schemas/contacto-emergencia.ts` — schemas Zod (E.164, FR-007).
- `src/lib/schemas/contacto-emergencia.test.ts` — unitario (registrado en `vitest.unit.includes.ts`).
- `src/app/api/padre/contacto-emergencia/route.ts` — GET/POST (rol PARENT).
- `src/app/api/padre/contacto-emergencia/route.test.ts` — integración (T016).
- `src/app/api/padre/contacto-emergencia/[id]/route.ts` — PATCH/DELETE (baja lógica).
- `src/app/api/padre/contacto-emergencia/[id]/route.test.ts` — integración (T016).
- `src/app/api/admin/comite/expediente/[id]/activar-emergencia/route.ts` — POST (rol COMITE_VALIDACION).
- `src/app/api/admin/comite/expediente/[id]/activar-emergencia/route.test.ts` — integración (T012).
- `src/components/modules/comite/consolidacion/BotonActivarEmergencia.tsx` — botón ruby + modal (US5/FR-010).
- `src/components/modules/comite/consolidacion/BotonActivarEmergencia.test.tsx` — unitario (registrado).

### Modificados

- `prisma/schema.prisma` — `ContactoEmergencia` + `RelacionContactoEmergencia` (final del archivo), relación inversa en `Usuario`, campos + índice aditivos en `Expediente`, 8 valores en `AccionAudit`.
- `prisma/seed.ts` — `seedEmergenciaExpediente()` (plantilla + regla Motor Notif, idempotente) conectada en `main()` y exportada.
- `src/lib/schemas/index.ts` — re-export `./contacto-emergencia` (ancla SPEC-239).
- `src/lib/dal/repositories/expediente-motor-repository.ts` — `marcarEscaladoRojo`, `listarRojosEnVigilanciaSla`, `obtenerUltimoAvisoSlaRojo`, `obtenerUltimaActivacionEmergencia`, `obtenerNombrePadre`.
- `src/lib/expediente/motor/tareas-motor.ts` — `recalcularGravedad24h` delega la subida a ROJO en el handler (T008); nueva tarea `vigilarSlaRojo` (FR-008).
- `scripts/worker-expediente-motor.mjs` — tick ejecuta `vigilarSlaRojo` (mismo worker, sin advisory lock nuevo, D-72).
- `src/components/modules/comite/consolidacion/ConsolidacionClient.tsx` — prop `puedeEmergencia` + render del botón.
- `src/app/dashboard/admin/comite/consolidacion/[expedienteId]/page.tsx` — pasa `puedeEmergencia` (solo COMITE_VALIDACION).
- `vitest.unit.includes.ts` — registro de los 2 tests unitarios (comentario `// SPEC-239:`).

## Gate local

- `npx tsc --noEmit` — limpio en todos los archivos de esta spec (los únicos errores del run son de SPEC-227 en progreso: `HistorialRecomendaciones.test.tsx`, ajenos).
- `npx prisma generate` — OK (cliente 5.22.0 regenerado).
- Tests unitarios propios: 15/15 verdes (`contacto-emergencia.test.ts` 10, `BotonActivarEmergencia.test.tsx` 5) con `--coverage.enabled=false`.
- ESLint sobre todos los archivos tocados — sin findings (incluye frontera DAL Q-3).
- `npm run tokens:check` — VERDE global (1090 ≤ piso 1094); los archivos nuevos de UI aportan 0 ocurrencias de color crudo.
- Tests de integración: escritos bajo `src/**`, NO corridos localmente (BD compartida; los corre el coordinador).
- Pendientes por diseño del mega-lote (coordinador): `arch:generate`/`arch:check` (T026), gate completo + `dev-restart.sh` (T027), quickstart manual (T029).

## Decisiones

1. **Repositorio destino de `marcarEscaladoRojo`**: la spec/tasks referencian `src/lib/dal/repositories/expediente.ts`, que no existe. El repositorio real del motor es `expediente-motor-repository.ts` (SPEC-236); se extendió ahí (FR-003 cumplido en espíritu y en frontera Q-3).
2. **Estado objetivo al activar emergencia**: si el expediente ya está en `PENDIENTE_COMITE` o `EN_APROBACION_PADRE` se conserva; si no, se mueve a `PENDIENTE_COMITE` vía DAL directo — la whitelist del motor (SPEC-236) no contempla `* → PENDIENTE_COMITE` y la emergencia no puede quedar bloqueada por la máquina de estados. Quda auditado en `EXPEDIENTE_EMERGENCIA_ACTIVADA`.
3. **Anti doble activación**: ventana de 5 minutos sobre `AuditLog` `EXPEDIENTE_EMERGENCIA_ACTIVADA` (edge case "Activación doble") → 409 `EMERGENCIA_YA_ACTIVADA`.
4. **Parámetro SLA**: `padre.comite.sla_horas_gravedad_roja = 12` YA lo sembraba SPEC-230 (`seedParametrosPadre`, upsert idempotente); no se duplicó (T002 satisfecho por el seed existente, verificado en `seed.ts:49`).
5. **Auditoría de la subida a ROJO**: `recalcularGravedad24h` deja de emitir `EXPEDIENTE_GRAVEDAD_SUBIO_A_ROJO` y ahora emite `EXPEDIENTE_ESCALADO_A_ROJO` (valor nuevo exigido por FR-013); el valor de SPEC-236 queda en el enum sin uso. No había tests que asertaran el valor antiguo.
6. **GET de contactos**: por defecto solo activos; `?incluirInactivos=true` incluye la papelera lógica (US1.3 + paginación estándar `{ items, pagination }`).

## Hallazgos / desviaciones de la spec

1. **Canal SMS no existe**: `CanalNotificacion` solo tiene `EMAIL` e `IN_APP`, `programar()` resuelve destinatarios por email y el instructivo prohíbe modificar el código del Motor Notif. → La notificación urgente al contacto se programa por **EMAIL** (plantilla + regla `CONTACTO_EMERGENCIA`/EMAIL sembradas). Un contacto sin email no recibe notificación: la activación continúa y el endpoint responde **202 con `notificacionProgramada: false` y `advertencia`** (edge case "Fallo del Motor Notif" de la propia spec). Deuda: canal SMS requiere extensión del Motor Notif (otra spec).
2. **`AuditLog` no tiene columna `nivel`**: el "nivel CRITICAL" pedido se registra en `metadatos.nivel = "CRITICAL"` (handler, activación, sin-contactos y SLA vencido).
3. **Notificación "admin/CEO" al subir a ROJO**: se reutiliza la plantilla/reglas existentes `expediente.gravedad.subio_a_rojo` de SPEC-236 (destinatarios: padre + comité de validación), tal como mandan los Acceptance Scenarios US2.2/FR-009 ("usando la plantilla existente").
4. **Solape de vigilancias SLA**: `vigilarSlaComite` (SPEC-236, reloj `updatedAt`) y `vigilarSlaRojo` (SPEC-239, reloj `fechaEscaladoRojoEn`) pueden ambos alertar un ROJO en `PENDIENTE_COMITE`. Motor Notif reemplaza programaciones futuras duplicadas por (evento, sujeto, destinatario, canal), así que no hay doble email; quedan dos filas de auditoría con acciones distintas. No se tocó `vigilarSlaComite` porque `worker-expediente-motor.test.ts:155` aserta su comportamiento ROJO actual. Deuda técnica: unificar relojes en una fase posterior.

## Deuda técnica

- Canal SMS real para contactos de emergencia (requiere extender Motor Notif: enum `CanalNotificacion`, worker de envío y proveedor).
- Unificar los dos relojes de SLA (updatedAt vs fechaEscaladoRojoEn) para ROJO en PENDIENTE_COMITE.
- UI padre para administrar contactos: SPEC-232 (fuera de scope aquí).
- Historial de emergencias y escalamiento a autoridades: fases posteriores (research D-rechazadas).

## Verificación de invariantes

- `src/lib/ai/**` intacto; código del Motor Notif (`src/lib/notificaciones/**`) intacto — solo catálogo aditivo vía seed (T028).
- Sin advisory lock nuevo: se extendió el worker existente (lock 123456793 de SPEC-236).
- Migración 100% aditiva (IF NOT EXISTS en todo; cero DROP).
- AuditLogs sin textos de reportes ni teléfonos (solo ids, prioridades y claves).
