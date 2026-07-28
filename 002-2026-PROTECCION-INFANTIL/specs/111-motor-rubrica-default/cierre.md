# Cierre — SPEC-111: D-28 — la rúbrica como motor predeterminado

**Fecha**: 2026-07-28 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA, **SIN DESPLEGAR** (lo autoriza el CEO por lote).

## Lo hecho (por FR)

- **FR-001 (seed, APLICADO de verdad)**: `prisma/seed.ts` — `ia.rubrica.enabled` se siembra
  en `true` (con descripción actualizada a D-28). No es una recomendación: está en el seed.
- **FR-002 (BD operada)**: `scripts/aplicar-rubrica-default-111.ts` — idempotente
  verificado con dos corridas reales en dev: la primera `false → true`, la segunda
  `ya estaba en true. Nada que hacer`. Listo para ejecutarse en prod en el lote
  (quickstart paso a paso).
- **FR-003 (test de efecto)**: `src/app/api/reportes/procesar/efecto-motor-111.test.ts` —
  con `enabled=true` el pipeline llama a la rúbrica (NO al legacy) y persiste
  `ClasificacionRubricaVoto`; con `enabled=false` llama al legacy (NO a la rúbrica) y no
  hay votos. **Prueba en rojo verificada**: forzando el efecto invertido (`false` en el
  caso true) el test falla exactamente donde debe ("debe llamarse el motor rúbrica: … got
  0 times"); restaurado, vuelve a verde.
- **FR-004 (reversión)**: `docs/runbook.md` §12c — reversión en caliente (parámetro a
  `false`, sin reiniciar ni desplegar) con verificación SQL y evidencia de que el cambio
  aplica sin reinicio (medición 2026-07-28: dos procesamientos seguidos en el mismo
  proceso, false→legacy 37.7 s, true→rúbrica 52.0 s).

## Capacidad (medida, pipeline real)

legacy **37.7 s** · rúbrica **52.0 s** (< 3 min) · **~69 reportes/hora** (~138/h a
concurrencia 2). `scripts/medicion-capacidad-111.ts`.

## Restricciones verificadas

- Diff sin tocar `rubrica-semilla.ts` (textos), terna de modelos ni umbral 60%.
- BD de dev dejada como se encontró (`ia.rubrica.enabled=false` restaurado al final).
- **NO desplegado**: la aplicación en prod queda como script idempotente para el lote del CEO.

## Gate

tsc ✅ · lint ✅ (0 errores) · **941/941 tests** ✅ (2 nuevos de efecto) · build ✅ ·
CI GitHub: run a la vista en el commit final.
