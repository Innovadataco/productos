# Cierre: SPEC-182 — Reconciliación de reportes huérfanos (I-60)

**Fecha**: 2026-08-19 · **Rama**: `work/002-pi-077` · **PR**: contra `feature/001-scaffolding`.

## Qué se implementó

1. **Modelo y parámetros**
   - Nuevo valor `RECONCILIACION_HUERFANOS` en el enum `AccionAudit` de `prisma/schema.prisma`.
   - Migración aditiva `20260819010000_spec_182_reconciliacion_huerfanos_audit`.
   - Parámetros sembrados en `prisma/seed.ts`: `operadores.reconciliacion_intervalo_min` (default 15) y `operadores.reconciliacion_enabled` (default true).

2. **Servicio de reconciliación** (`src/lib/operadores/reconciliacion-huerfanos.ts`)
   - Busca reportes `estado='REVISION_MANUAL'`, `operadorId IS NULL`, `eliminado=false`.
   - Llama `asignarOperadorAReporte` por cada huérfano sin modificar la lógica del asignador.
   - Maneja resultados `asignado`, `todos al cupo máximo`, `sin operadores del tenant`, error transitorio.
   - Escribe log estructurado y crea `AuditLog` agregado cuando `asignados > 0`.

3. **Worker** (`scripts/worker-reportes.mjs`)
   - Cola `operadores-reconciliacion-huerfanos` con `ensureQueue` + `boss.schedule` + `boss.work`.
   - Al arrancar lee `operadores.reconciliacion_intervalo_min` y construye la expresión cron `*/X * * * *` (default `*/15 * * * *`); un restart aplica cambios del parámetro.

4. **Script one-shot legacy** (`scripts/reasignar-huerfanos-legacy.mjs`)
   - Ejecuta la misma lógica de reconciliación una vez y emite resumen `encontrados/asignados/fallidos`.
   - Listo para correr en prod tras deploy y limpiar los 26 reportes legacy.

5. **Test de integración** (`src/lib/operadores/reconciliacion-huerfanos.test.ts`)
   - Crea reporte huérfano → ejecuta reconciliación → verifica operador asignado + AuditLog agregado.
   - Cubre casos: todos al cupo, reporte ya con operador, parámetro deshabilitado.

6. **Registro en specs/README.md** en ambas tablas como 🟢 Implementada.

## Decisiones documentadas

- Se reutilizó `asignarOperadorAReporte` tal cual; SPEC-182 no cambia la política de asignación.
- El worker de reportes ya garantiza una sola instancia activa vía advisory lock, por lo que no se agregó lock adicional.
- Los reportes con `tenantId=NULL` (los 26 legacy) dependen de que el asignador pueda operar con tenant nulo; el script reportará la causa si no es posible.
- La frecuencia se lee del parámetro en cada arranque del worker; cambios en caliente requieren restart.

## Evidencia

- Test de integración del servicio: 4/4 verdes.
- Test de integración completo (`npm run test:integration`): 219 archivos passed, 1 skipped; 1273 tests passed, 1 skipped; EXIT_CODE 0.
- Gate local: `npx tsc --noEmit`, `npm run lint -- --no-cache`, `npm run arch:check`, `npm run build` verdes.

## Nota

- Sin cambios al motor `src/lib/ai/**`.
- Migración aditiva, sin índices ni DROP.
