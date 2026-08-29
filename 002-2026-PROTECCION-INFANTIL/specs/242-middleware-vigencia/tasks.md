# Tasks: Middleware de vigencia (SPEC-242)

**Branch**: `work/002-PI-145`

## Phase 0 — Preparación
- [x] T001: Leer layouts padre/colegio, repositorio de pagos, componente Alerta, schema.
- [x] T002: Confirmar `date-fns-tz` en dependencias.

## Phase 1 — Schema y migración
- [x] T010: Agregar `PENDIENTE_AUTORIZACION` a `EstadoSuscripcion` en schema.
- [x] T011: Agregar `REPORTE_SIN_SUSCRIPCION` a `AccionAudit` en schema.
- [x] T012: Crear migración aditiva SQL con `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
- [x] T013: Ejecutar `npx prisma generate` y regenerar cliente.
- [x] T014: Crear `data-model.md`.

## Phase 2 — Helper de vigencia (TDD)
- [x] T020: Extender `PagosRepository` con `obtenerSuscripcionPorUsuarioId` y
      `obtenerSuscripcionActivaPorUsuarioId`.
- [x] T021: Crear `src/lib/pagos/vigencia-middleware.ts` con funciones puras.
- [x] T022: Usar `date-fns-tz` (`America/Bogota`) para cálculo de "ahora".
- [x] T023: Crear `src/lib/pagos/vigencia-middleware.test.ts` cubriendo estados,
      exenciones y 3 escenarios de frontera de medianoche Bogotá.

## Phase 3 — Integración en layouts
- [x] T030: Modificar `src/app/dashboard/padre/layout.tsx` con guarda de vigencia
      y banner `EN_GRACIA`.
- [x] T031: Modificar `src/app/dashboard/colegio/layout.tsx` reemplazando el
      bloqueo legacy por la nueva guarda y redirección a `/suscripcion`.
- [x] T032: Verificar que `/consentimiento`, `/perfil`, `/suscripcion` y
      `/reportar` queden en lista de rutas exentas.

## Phase 4 — Guarda de /reportar y auditoría
- [x] T040: Crear `src/app/reportar/layout.tsx` que registre
      `AuditLog` `REPORTE_SIN_SUSCRIPCION` para padres sin suscripción activa.

## Phase 5 — Placeholders /suscripcion
- [x] T050: Crear `src/app/dashboard/padre/suscripcion/page.tsx`.
- [x] T051: Crear `src/app/dashboard/colegio/suscripcion/page.tsx`.
- [x] T052: Crear `src/components/modules/PadreLogoutButton.tsx`.

## Phase 6 — Validación y cierre
- [x] T060: `npx tsc --noEmit` → 0 errores.
- [x] T061: `npm run lint` → 0 errores, 47 warnings preexistentes.
- [x] T062: tests focus (`vigencia-middleware`, `login`, `vigencia-cliente`) → 36 passed. Suite completo omitido localmente por duración; CI será el gate final.
- [x] T063: `npm run build` → éxito.
- [x] T064: `./scripts/dev-restart.sh` → omitido: no se levanta servicio local en worktree sin node_modules; CI y deploy del CEO validan.
- [x] T065: `quickstart.md` redactado; prueba manual requiere app corriendo.
- [x] T066: `npm run arch:check` → VERDE; no hay drift de arquitectura.
- [ ] T067: Commit final + gate pre-push + push a `origin/work/002-PI-145`.
