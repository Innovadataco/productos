# Plan: Mejora del prompt del clasificador (Spec 050)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/050-mejora-prompt-clasificador/spec.md`. El plan se entrega para revisión humana; no se implementa código hasta aprobación.

---

## Summary

Aplicar un cambio quirúrgico en el system prompt de `src/lib/ai/classifier.ts` para corregir dos fallos sistemáticos observados en simulación: (1) `SOLICITUD_MATERIAL` se confunde con `OFRECIMIENTO_REGALOS` cuando hay ofrecimiento a cambio, y (2) `CONTACTO_INSISTENTE` no detecta señales tempranas de grooming. El cambio es solo de texto del prompt; no se modifica lógica, modelos, schemas ni base de datos. La validación requiere un set de referencia validado por humanos, no ejemplos sintéticos.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Ollama local (qwen2.5:32b, ornith:9b, ornith:35b), `llamarOllamaStructured` en `src/lib/ai/ollama-client.ts` |
| **Storage** | Sin cambios de BD |
| **Testing** | Vitest + eval harness existente (`IaEvalManager`, `casoEval`, `EvalRun`) |
| **Target Platform** | Docker Compose / Mac Studio |
| **Project Type** | Next.js full-stack |
| **Performance Goals** | Mantener latencia promedio y p95 actuales; no aumentar tokens de prompt más allá del 10-15% |
| **Constraints** | Solo cambio de texto en `buildSystemPrompt`; sin migraciones; sin afectar las otras 10 categorías |
| **Scale/Scope** | Un archivo (`src/lib/ai/classifier.ts`) y un set de evaluación |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | El prompt es texto; no se añaden imágenes ni multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | El cambio mejora la clasificación sin emitir juicios sobre personas |
| §1.4 Umbral parametrizable en BD | ✅ Pass | No se modifica el umbral de visibilidad ni parámetros de configuración |
| §2.1 Stack heredado | ✅ Pass | No se añaden dependencias |
| §2.2 Roles | ✅ Pass | No cambia permisos |
| §2.3 Multi-tenant | ✅ Pass | No afecta aislamiento |
| §2.4 Modelo SaaS | ✅ Pass | No afecta facturación |
| §3.1 TypeScript strict | ✅ Pass | Cambio de string literal, no tipos |
| §3.4 Códigos HTTP correctos | ✅ Pass | No hay endpoints nuevos |
| §3.5 Logs y auditoría | ✅ Pass | El logger existente cubre el fallback |
| §3.6 Límites de tamaño | ✅ Pass | El prompt se mantiene dentro de límites razonables |
| §4.1 Singletons | ✅ Pass | No se tocan singletons |
| §4.2 Rutas API individuales | ✅ Pass | No se añaden endpoints |
| §4.3 Paginación estándar | ✅ Pass | No aplica |
| §6.1 JWT en cookie httpOnly | ✅ Pass | No se toca autenticación |
| §6.2 Validación manual explícita | ✅ Pass | No se añaden inputs de usuario |
| §6.3 Datos sensibles encriptados | ✅ Pass | No se toca encriptación |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/050-mejora-prompt-clasificador/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (no changes)
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
└── src/
    └── lib/
        └── ai/
            └── classifier.ts   # Único archivo a modificar (solo buildSystemPrompt)
```

**Structure Decision**: No se crean nuevos archivos. El cambio es un reemplazo controlado del string literal en `buildSystemPrompt`.

---

## Complexity Tracking

| Área | Complejidad | Riesgo | Notas |
|---|---|---|---|
| Redacción del prompt | Baja | Medio | El verdadero riesgo es semántico: que el modelo interprete bien las nuevas fronteras |
| Validación con datos humanos | Media | Alto | Depende de disponibilidad del set de referencia; sin él no hay aprobación |
| Medición de regresión | Media | Medio | Requiere evaluar las 12 categorías, no solo las 2 afectadas |
| Latencia/costo de tokens | Baja | Bajo | El prompt es ~20-25% más largo; se mide impacto |
| Migración | Ninguna | Ninguno | No hay cambios de BD |

---

## Decisiones de diseño propuestas

1. **Cambio de prompt puro, no de lógica**:
   - Se reemplaza el texto de `basePrompt` en `buildSystemPrompt`.
   - No se toca la votación, el desempate, el schema de respuesta, ni el cálculo de confianza.
   - Si la validación falla, se revierte el commit del prompt.

2. **Regla de prioridad explícita para SOLICITUD_MATERIAL**:
   - Se añade una frontera excluyente que dice: "solicitud de material íntimo + ofrecimiento = SOLICITUD_MATERIAL".
   - Se corrige el ejemplo problemático `"te compro un celular si me mandas fotos" → OFRECIMIENTO_REGALOS` a `SOLICITUD_MATERIAL`.
   - Se agrega un ejemplo negativo (`OFRECIMIENTO_REGALOS` sin solicitud de material) para mantener la frontera.

3. **Ampliación de CONTACTO_INSISTENTE con grooming temprano**:
   - Se redefine la categoría para incluir señales tempranas: edad/curso/colegio, secreto de padres, privado, aislamiento.
   - Se agregan 3 ejemplos contrastivos: uno positivo claro, uno negativo claro, uno de límite.
   - Se enfatiza que el contexto de acercamiento inapropiado es necesario; no se clasifica toda pregunta casual.

4. **Validación contra datos humanos**:
   - El criterio de aceptación es medir recall/precisión contra reportes reales corregidos por operador/comité o contra el eval harness con `casoEval` validado.
   - No se acepta validación con ejemplos sintéticos generados para el prompt.
   - Si no hay set de referencia disponible, la implementación se bloquea y se documenta el gap.

5. **Medición de regresión**:
   - Se ejecuta el Laboratorio IA con el mismo fixture/modelo antes y después del cambio.
   - Se reporta recall, precisión y error silencioso por categoría.
   - Se define umbral aceptable de variación: ±5% o sin caída significativa según tamaño de muestra.

---

## Riesgos y mitigaciones

- **Riesgo**: Subir el recall de `SOLICITUD_MATERIAL` y `CONTACTO_INSISTENTE` baja la precisión (sobre-clasificación). **Mitigación**: medir precisión y falsos positivos en el set de referencia; si baja más de lo aceptable, iterar el prompt o descartar el cambio.
- **Riesgo**: El prompt más largo aumenta latencia/costo. **Mitigación**: medir latencia promedio y p95 en el Laboratorio; si supera el 10-15% extra, acortar el prompt manteniendo las fronteras.
- **Riesgo**: No hay set de referencia humano disponible. **Mitigación**: no implementar hasta tenerlo; documentar el bloqueador.
- **Riesgo**: El modelo no sigue la nueva instrucción a pesar del prompt. **Mitigación**: probar con los 3 modelos (qwen2.5:32b, ornith:9b, ornith:35b); si ninguno mejora, descartar y reportar.
- **Riesgo**: El cambio afecta otras categorías. **Mitigación**: medir todas las categorías en el eval; revertir si hay regresión.

---

## Approach

1. Research: documentar el gap, el criterio de medición y los riesgos.
2. Diseño: redactar el prompt propuesto y los ejemplos contrastivos.
3. Planificación: crear `tasks.md` con fases y dependencias.
4. Revisión humana: entregar el plan y detenerse hasta aprobación.
5. Implementación (tras aprobación): reemplazar el prompt en `buildSystemPrompt`, ejecutar eval, medir, iterar o revertir.

---

## Notes

- No se toca `classificationResponseSchema` ni `OllamaMetrics`.
- No se añaden ejemplos corregidos dinámicos; el cambio es en el `basePrompt`.
- El eval harness existente (`src/lib/ai/eval-runner.ts`, `IaEvalManager`) es la herramienta de validación natural.
- La medición debe ser reproducible: mismo modelo, mismo fixture, misma semilla, con y sin el nuevo prompt.
