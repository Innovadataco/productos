# Implementation Plan: Fix polling worker-notificaciones (cierra I-147)

**Branch**: `work/002-PI-192` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-192 · BRIEF-A-34 · I-147 · Reproducción en vivo prod 27-ago

---

## Summary

Fix quirúrgico de una línea en `scripts/worker-notificaciones.mjs`: eliminar `pollInterval.unref()` (línea 268). Con `.unref()`, el timer NO cuenta contra keep-alive; cuando pg-boss `boss.work` queda en espera silenciosa (sin jobs `active`), el polling nunca dispara y `procesarLote` no consulta la BD. Sin `.unref()`, el timer garantiza tick cada 10s como vía de respaldo. Se agrega log observable al final de `procesarLote` para que un poll con 0 pendientes deje rastro. Se agrega test integración que ejerce el flujo end-to-end con `Notificacion` sembrada y `enviarEmailNotificacion` mockeado. Se conserva `clearInterval(pollInterval)` en shutdown para que SIGTERM/SIGINT cierren limpiamente. Cero cambios en `quiet-hours.ts`, `motor.ts`, schemas, Prisma o `src/lib/ai/**`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Node.js ≥ 22 · TypeScript 5 · pg-boss · Prisma · Vitest |
| **Runtime del fix** | `scripts/worker-notificaciones.mjs` (worker de producción) |
| **Testing** | Vitest integration con BD real (Notificacion + Plantilla sembradas), mock de `enviarEmailNotificacion` |
| **Rendimiento** | Sin impacto — el polling ya declaraba 10s; solo garantizamos que efectivamente dispare |
| **Constraints** | Cero rediseño del motor · cero cambios a quietHours · cero migraciones · cero cambios en `src/lib/ai/**` · 4 `CANCELADA` intactas |
| **Autonomía** | Régimen D-51: build → PR → gate CI → auditoría Fábrica → deploy Jelkin → verificación en vivo (SC-005 obligatoria) |

---

## Constitution Check

- ✅ Solo texto — irrelevante.
- ✅ IA local — irrelevante; no toca motor.
- ✅ Migraciones aditivas y no destructivas — **cero migraciones**.
- ✅ Frontera DAL (Q-3) — `procesarLote` consume `NotificacionRepository`; el fix no cambia esa dependencia.
- ✅ Sin `any` ni stack traces al cliente — el worker no es endpoint.
- ✅ Un commit por User Story + uno de docs.

Sin violaciones. `Complexity Tracking` no aplica.

---

## Project Structure

### Documentation (this feature)

```text
specs/292-fix-emails-suscripcion-quiethours/
├── plan.md              # Este archivo
├── spec.md              # ya creado
├── tasks.md             # Fase 2
└── cierre.md            # Post-verificación (obligatorio, patrón SPEC-266+)
```

### Código a tocar

```text
002-2026-PROTECCION-INFANTIL/
├── scripts/
│   └── worker-notificaciones.mjs                    # QUITAR .unref() + AGREGAR log de poll + clearInterval en shutdown
├── src/lib/notificaciones/
│   └── procesar-lote.test.ts                        # NUEVO test integración (o unit con Prisma real)
├── specs/292-fix-emails-suscripcion-quiethours/
└── (opcional) specs/README.md                       # registrar SPEC-292
```

**Structure Decision**: alcance mínimo, quirúrgico. Fix de 1 línea + log + 1 test. Sin refactor. Sin cambio en la arquitectura del worker. Sigue el patrón de fixes urgentes (SPEC-286 fue análogo).

---

## Implementation Steps

### Fase 0 — Diagnóstico y reproducción en vivo (ya hecho, documentado en spec)

- 8 ENCOLADAs en prod, `intentos=0`, `ultimoError=NULL`.
- 12 jobs `pgboss.job` en `state=created` con `start_after=12:00 UTC`.
- Prueba: encolé notif con `enviarEn=NOW()-5min` → tras 25s sigue `ENCOLADA`. Cleanup ejecutado.
- Otros 4 workers no usan `setInterval(...).unref()` — patrón único de `worker-notificaciones.mjs`.

### Fase 1 — Fix + observabilidad

1. **`scripts/worker-notificaciones.mjs`**:
   - Línea 268: eliminar `pollInterval.unref();`.
   - En `procesarLote()` (final del bloque `if (pendientes.length === 0)`): agregar `console.log("[PI-NOTIFICACIONES] poll: 0 pendientes")` — el log actual "Procesando lote" ya cubre el caso `>0`.
   - Extraer `pollInterval` a scope de módulo (o pasar por referencia) para poder `clearInterval` desde `shutdown()`. En `shutdown()`: `if (pollInterval) clearInterval(pollInterval);` antes de `releaseAdvisoryLock()`.
2. Verificar en dry-run local que `SIGTERM` cierra el proceso limpio (no queda colgado por el timer con ref).

### Fase 2 — Extraer función pura testeable

3. **Refactor mínimo** para exponer `procesarLote` a los tests: extraer `procesarLote()` y sus dependencias a `src/lib/notificaciones/procesar-lote.ts` (módulo TS), importado por el worker. El worker sigue orquestando arranque, lock, pg-boss; la lógica de "consulta y procesa" queda en el módulo puro.
   - Alternativa (más conservadora): mantener `procesarLote` en el worker `.mjs` y exportar via `export async function` en la parte superior del archivo. Sin embargo, Vitest importa `.ts` mejor que `.mjs` — decisión: crear `src/lib/notificaciones/procesar-lote.ts` con la función y consumir desde el worker.
4. **`src/lib/notificaciones/procesar-lote.ts`** (nuevo): exporta `procesarLote(repoNotif, repoPlantilla, config, opciones)` — misma semántica que la actual pero con dependencias inyectables (para el test).

### Fase 3 — Test integración

5. **`src/lib/notificaciones/procesar-lote.test.ts`** (nuevo, Vitest integration):
   - `beforeEach`: `resetDatabase()`, sembrar `NotificacionPlantilla { clave: "consentimiento.aceptado.email", canal: "EMAIL", cuerpoMarkdown: "Hola {{nombre}}", asunto: "Test" }`.
   - Mock `enviarEmailNotificacion` con `vi.mock("@/lib/email")` → resuelve `{id: "test-proveedor-id-123"}`.
   - Caso feliz: crear `Notificacion { estado: "ENCOLADA", enviarEn: new Date(Date.now() - 60_000), canal: "EMAIL", plantillaClave: "consentimiento.aceptado.email", destinatarioEmail: "test@example.com", variables: {nombre: "Test"} }`. Ejecutar `procesarLote()`. Assert: estado=`ENVIADA`, proveedorId=`test-proveedor-id-123`.
   - Caso CANCELADA: crear `Notificacion { estado: "CANCELADA", ... }`. Ejecutar `procesarLote()`. Assert: sigue `CANCELADA` (no reactivada).
   - Caso `enviarEn` futuro: crear con `enviarEn = NOW()+10min`. Ejecutar. Assert: sigue `ENCOLADA` (query lo excluye).

### Fase 4 — Gate LOCAL

6. `npx tsc --noEmit`
7. `npm run lint` — 0 err
8. `npm run tokens:check`
9. `npm run arch:check`
10. `npm run locks:check` (worker-notificaciones sigue con ID `987654321` — sin cambios en `ADVISORY-LOCKS.md`)
11. `npm run ratchets:check`
12. `npm run test:unit` (incluye el nuevo `procesar-lote.test.ts` si va a unit; si va a integration, `npm run test:integration -- procesar-lote`)

### Fase 5 — Pre-push (I-101/I-104)

13. `git fetch origin && git rebase origin/feature/001-scaffolding`
14. `git diff --name-status origin/feature/001-scaffolding..HEAD` — verificar solo archivos SPEC-292. Cero archivos ajenos.

### Fase 6 — Push + PR + merge

15. `git push origin work/002-PI-192`. Fábrica abre PR + mergea cuando CI cierre verde.

### Fase 7 — Verificación en vivo obligatoria (SC-005)

16. **Antes** del reinicio del worker en prod: consultar BD → 8 ENCOLADAs esperadas, 4 CANCELADAs (baseline).
17. Jelkin ejecuta `deploy-prod.sh` con la nueva imagen — el worker `pi-notificaciones` reinicia con el fix.
18. **Después** de 30s desde el reinicio: consultar BD:
    - 8 ENCOLADAs con `enviarEn <= NOW()` → esperado `ENVIADA` (o `REINTENTANDO` con `intentos>0` si Resend falla temporalmente — la clave es que **el worker YA las tocó**).
    - 4 CANCELADAs → siguen `CANCELADA`.
    - Consultar logs del worker: aparecen `[PI-NOTIFICACIONES] Procesando lote { pendientes: N }` (y/o `poll: 0 pendientes` en ciclos vacíos).
19. Encolar una `Notificacion` de prueba con `enviarEn=NOW()-1min` vía SQL → tras 15s: `ENVIADA` (o `REINTENTANDO` si Resend). Cleanup: `UPDATE ... SET estado='CANCELADA', motivoCancelacion='SPEC-292 verif post-deploy'`.
20. Reportar bitácora en `cierre.md`.

### Commit map

- `docs(spec-kit): SPEC-292 · spec + plan · fix polling worker-notificaciones (I-147) [002-PI-192]`
- `refactor(notificaciones): extraer procesarLote a src/lib/notificaciones/procesar-lote.ts [SPEC-292]`
- `fix(worker-notificaciones): eliminar .unref() del pollInterval + log de tick + clearInterval en shutdown [SPEC-292]`
- `test(notificaciones): integración procesarLote (bug I-147 no vuelve) [SPEC-292]`

---

## Test Strategy

- **Unit / integration (Vitest, BD real)**: `procesar-lote.test.ts` cubre 3 casos (ENCOLADA vencida→ENVIADA · CANCELADA→sigue · futuro→sigue). Mock de `enviarEmailNotificacion` — cero dependencia de Resend real.
- **Manual local**: dry-run del worker con `NODE_ENV=development`, seed de una notif, verificar en stdout el `poll` cada 10s.
- **Verificación en vivo (SC-005)**: obligatoria. Reporte con 3 conteos concretos.

---

## Risks & Mitigations

| Riesgo | Mitigación |
|---|---|
| Quitar `.unref()` deja el proceso colgado tras SIGTERM. | `clearInterval(pollInterval)` en `shutdown()` antes de `releaseAdvisoryLock()`. Test manual: `kill -TERM $(docker inspect ...)` → proceso cierra en <2s. |
| El nuevo log de poll con 0 pendientes genera ruido en Loki (10s × 8640 = 8.6k logs/día). | El log es una sola línea de texto ~50 bytes. ~430 KB/día en Loki. Aceptable frente a la observabilidad ganada. Si molesta, se sube a nivel `debug` en Fase 2 — TODO en cierre.md. |
| El refactor `procesar-lote.ts` cambia semántica accidentalmente. | El refactor es literal (mismo cuerpo, solo cambia de archivo). Test integración cubre el flujo end-to-end. Diff se revisa con `git diff -w` para asegurar cero cambio de lógica. |
| El worker en prod tarda >30s en reiniciar y las 8 ENCOLADAs no salen inmediatamente. | El polling es cada 10s y `enviarEn <= NOW()` está satisfecho — se procesa en el primer poll post-arranque. Si Resend está caído, quedan en `REINTENTANDO` con `intentos>0` — sigue siendo evidencia de que el fix funciona. |
| Rebase sobre `origin/feature/001-scaffolding` genera conflicto por SPEC-290 (worker-sesiones toca `scripts/`). | SPEC-290 modificó `scripts/worker-sesiones.mjs`. Este frente modifica `scripts/worker-notificaciones.mjs`. Archivos distintos, cero conflicto esperado. Si aparece en `docker-compose.prod.yml` (no lo toco), conservar ambos bloques (§9.6 CLAUDE.md). |
| Alguien reintroduce `.unref()` en el worker. | El test integración `procesar-lote.test.ts` no lo caza directamente (no arranca el worker), pero un ratchet nuevo tipo `no-unref-en-polling-workers` es out-of-scope para 1-2h. TODO en cierre.md para brief A-35. |

---

## Out of Scope

- Refactor completo del worker de notificaciones (mantiene su forma actual).
- Cambios a `quiet-hours.ts` (correcta operativamente).
- Reactivar las 4 `CANCELADA` (dedup correcto).
- Nueva métrica `notif.pendientes_vencidas` en pi-monitor (brief §5-2 diferido a A-35).
- Ratchet estático que prohíba `.unref()` en workers (TODO A-35).
- Cambios al motor IA `src/lib/ai/**`.
- Cambios al schema Prisma o migraciones.
