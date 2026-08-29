# Tasks — SPEC-292 · Fix polling worker-notificaciones (I-147)

**Branch**: `work/002-PI-192`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

---

## Fase 0 — Diagnóstico (ya hecho, documentado en spec §Diagnóstico verificado)

- **T000** [✓] Reproducción en vivo: notif con `enviarEn=NOW()-5min` no procesada tras 25s. Cleanup ejecutado.

## Fase 1 — Extraer procesarLote a módulo testeable (FR-004)

- **T001** [✓] `src/lib/notificaciones/procesar-lote.ts` — módulo TS con `procesarLote(deps, config, opciones)`. Dependencias inyectables: `NotificacionRepository`, `NotificacionPlantillaRepository`, `enviarEmail` (para test). Sin cambio semántico.
- **T002** [✓] `scripts/worker-notificaciones.mjs` — importar `procesarLote` del nuevo módulo. Eliminar el cuerpo local. Sigue orquestando arranque, lock, pg-boss.

## Fase 2 — Fix + observabilidad (FR-001..FR-003)

- **T003** [✓] `scripts/worker-notificaciones.mjs:268` — eliminar `pollInterval.unref();`.
- **T004** [✓] `procesarLote` — cuando `pendientes.length === 0` loggear `[PI-NOTIFICACIONES] poll: 0 pendientes`.
- **T005** [✓] `scripts/worker-notificaciones.mjs:shutdown()` — `clearInterval(pollInterval)` antes de `releaseAdvisoryLock()`. Elevar `pollInterval` a scope de módulo.

## Fase 3 — Test integración (FR-004)

- **T006** [✓] `src/lib/notificaciones/procesar-lote.test.ts` — 3 casos con BD real + mock `enviarEmailNotificacion`:
  - Caso feliz: `ENCOLADA` `enviarEn=NOW()-1min` → `ENVIADA`, `proveedorId` no null.
  - Caso CANCELADA: sigue `CANCELADA` (dedup).
  - Caso futuro: `enviarEn=NOW()+10min` → sigue `ENCOLADA` (query lo excluye).

## Fase 4 — Gate LOCAL

- **T007** [✓] `tsc --noEmit`
- **T008** [✓] `lint` 0 err
- **T009** [✓] `tokens:check` · `arch:check` (regenerar docs si drift) · `locks:check` · `ratchets:check`
- **T010** [✓] `test:unit` (o `test:integration` según pool)
- **T011** [✓] Registro `specs/README.md` con SPEC-292.

## Fase 5 — Pre-push (I-101/I-104)

- **T012** [✓] Fetch + rebase + `git diff --name-status` — solo archivos SPEC-292.

## Fase 6 — Push

- **T013** [✓] `git push origin work/002-PI-192`. Fábrica abre PR + mergea.

## Fase 7 — Verificación en vivo (SC-005 · obligatoria post-deploy)

- **T014** [✓] BD prod: 8 ENCOLADAs con `enviarEn <= NOW()` pasan a `ENVIADA` (o `REINTENTANDO` con `intentos>0`).
- **T015** [✓] BD prod: 4 CANCELADAs siguen `CANCELADA`.
- **T016** [✓] BD prod: notif nueva `enviarEn=NOW()-1min` → `ENVIADA`/`REINTENTANDO` en <15s. Cleanup.
- **T017** [✓] `cierre.md`: H1 refinada aplicada, 3 conteos BD, TODO A-35 (métrica + ratchet unref).

---

## Restricciones activas

- 🔒 CERO cambios en `src/lib/notificaciones/quiet-hours.ts` (candado §4 brief).
- 🔒 CERO reactivación de las 4 `CANCELADA` (dedup correcto).
- 🔒 CERO rediseño del motor / `motor.ts` / `bounces.ts`.
- 🔒 CERO cambios en `src/lib/ai/**` · CERO migraciones.
- 🔒 CERO cambio en advisory lock ID `987654321` (SPEC-284).
- 🔒 SC-5: verificación por BD prod (SSH+psql), NO por logs del worker (D-004).
