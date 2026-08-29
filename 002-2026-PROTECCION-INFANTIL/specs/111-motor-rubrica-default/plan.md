# Implementation Plan: SPEC-111 — D-28: el motor de rúbrica pasa a ser el predeterminado

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/111-motor-rubrica-default/spec.md`

## Summary

Encender de verdad la D-28: `ia.rubrica.enabled` pasa a `true` en el seed y, mediante un
script idempotente, en la BD de producción ya operada. Test de EFECTO (true→rúbrica con
votos persistidos, false→legacy), reversión en caliente documentada en el runbook, y
capacidad YA medida (pipeline real): legacy 37.7 s, rúbrica 52.0 s (< 3 min), ~69
reportes/hora (~138/h a concurrencia 2). Sin tocar textos, terna ni umbral; sin desplegar.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: `src/lib/ai/rubrica.ts` (ya implementada, SPEC-090/104), Prisma
(`ParametroSistema`, `ClasificacionRubricaVoto`), Vitest

**Storage**: PostgreSQL 16

**Testing**: Vitest (suite existente + test de efecto nuevo)

**Constraints**: textos de preguntas, terna de modelos y umbral 60% intactos; NO desplegar
(lo autoriza el CEO por lote); el motor default pasa a rúbrica SOLO por parámetro.

**Scale/Scope**: seed (1 línea), script de aplicación en BD operada, 1-2 tests, runbook.

## Constitution Check

*GATE: verificado antes de Fase 0 y tras el diseño (2026-07-28).*

- **IA local, textos sensibles nunca salen del servidor**: la rúbrica corre 100% en Ollama
  local (Mac por tailnet en prod). CUMPLE.
- **La IA clasifica conductas, no personas; presunción de inocencia**: la rúbrica es el
  motor multi-etiqueta ya validado con 0 silenciosos graves. CUMPLE.
- **Todo parametrizable (ADR_004)**: el cambio de motor es literalmente un parámetro;
  reversión en caliente sin desplegar. CUMPLE.
- **Medición antes de decidir (D-28)**: capacidad medida en el pipeline real, no estimada.

Sin violaciones que justificar.

## Diseño

1. **FR-001 (seed)**: `prisma/seed.ts` — `ia.rubrica.enabled` se siembra con valor `true`
   (upsert no destructivo para bases operadas; en base nueva queda `true`).
2. **FR-002 (BD operada)**: script `scripts/aplicar-rubrica-default-111.ts` idempotente:
   lee el parámetro; si ya es `true` → no-op con log; si no, lo fija en `true` con log de
   evidencia. Documentado en el quickstart para ejecutarse en prod en el lote de despliegue
   (NO se ejecuta ahora: el despliegue lo autoriza el CEO).
3. **FR-003 (test de efecto)**: test de integración que (a) con `enabled=true` procesa un
   reporte por el pipeline real y verifica que existen filas de `ClasificacionRubricaVoto`
   para ese reporte (clasificado por rúbrica), y (b) con `enabled=false` verifica que NO se
   crean votos (clasificado por legacy). Si el pipeline real con Ollama no es viable en el
   test, se implementa sobre el mismo camino de código del procesamiento con el modelo
   real local (la suite ya corre con Ollama local en dev).
4. **FR-004 (runbook)**: sección nueva en `docs/runbook.md` — reversión en caliente:
   `UPDATE ParametroSistema SET valor='false' WHERE clave='ia.rubrica.enabled'` (o vía
   panel de parámetros), efecto inmediato en el siguiente reporte (no requiere reinicio ni
   despliegue), y cómo verificar (procesar un reporte de prueba y confirmar ausencia de
   votos de rúbrica).
5. **Restricciones**: diff sin `rubrica-semilla.ts`, sin `ia.rubrica.modelos`, sin
   `ia.rubrica.umbral_presencia`. Medición ya ejecutada y reportada (no se repite).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Repetir el error I-27 (recomendado sin aplicar) | FR-002 con script idempotente + quickstart paso a paso para prod |
| Test de efecto lento (Ollama real) | Un solo reporte por sentido (~1-2 min); marcado como integración |
| Costo de capacidad en prod | Medido: 52 s/reporte, ~138/h a concurrencia 2 — reportado en la spec |

## Project Structure

### Documentation (this feature)

```text
specs/111-motor-rubrica-default/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── checklists/
│   └── requirements.md  # Validación de la spec
└── cierre.md            # Al cerrar (pendiente)
```

### Source Code (repository root)

```text
prisma/seed.ts                              # ia.rubrica.enabled: true en base nueva
scripts/aplicar-rubrica-default-111.ts      # FR-002: fija true en BD operada (idempotente)
scripts/medicion-capacidad-111.ts           # evidencia de capacidad (ya ejecutada)
src/app/api/reportes/procesar/*.test.ts     # FR-003: test de efecto true/false
docs/runbook.md                             # FR-004: reversión en caliente
```

**Structure Decision**: proyecto único Next.js; el cambio es de configuración + evidencia,
sin tocar el motor. Sin contratos externos (no aplica `contracts/`).
