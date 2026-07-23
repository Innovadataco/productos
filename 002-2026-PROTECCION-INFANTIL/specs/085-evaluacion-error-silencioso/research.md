# Research — 085-evaluacion-error-silencioso (ADR_006)

**Fecha**: 2026-07-23 · **Autor**: ODIN

## Pregunta abierta de ZEUS — respuesta verificada (previo a tocar nada)

¿Casos ya clasificados en producción bajo la etiqueta vieja de #43?
**No hay reportes reales afectados.** Verificado 2026-07-23: `SELECT COUNT(*) FROM "Reporte" WHERE identificador NOT LIKE 'SIM-%'` → **0** (dataset de desarrollo vacío; no existe producción). Los únicos afectados son artefactos de simulación: las 5 runs de la evaluación (`cmrx12k*`), cuyas filas `simulacion_reportes` (metadata de evaluación, no texto de reportes) se actualizaron con las etiquetas saneadas para el recomputo. Sin acción adicional requerida.

## R1 — Corrección de #43

- **Texto**: "Un adulto solicitó una videollamada privada a un menor insistiendo en que activara la cámara."
- **Etiqueta vieja**: `CONTACTO_INSISTENTE` (severidad 30). **Etiqueta saneada**: `SOLICITUD_MATERIAL` (severidad 80).
- **Justificación**: el núcleo no es la insistencia sino **lo que se solicita**: imagen en vivo del menor en un canal privado. Pedir activar la cámara en videollamada privada es solicitud de material visual en tiempo real; el mecanismo (videollamada vs. foto) no cambia la naturaleza de la conducta. La auditoría 3+ (ver R3) confirma: 4 de 5 modelos lo llevaron a categorías de mayor severidad (2× SOLICITUD_MATERIAL, 2× SOLICITUD_ENCUENTRO); los 5 coinciden en que CONTACTO_INSISTENTE lo subestima. Entre MATERIAL y ENCUENTRO gana MATERIAL: no hay propuesta de cita física, hay solicitud de imagen en vivo (el ADR la describe igual: "solicitud de material en vivo a un menor").

## R2 — Multi-etiqueta: secundaria como acierto

- #45: "se hizo pasar por agencia de modelaje para citar a una menor a solas" → primaria `SUPLANTACION_IDENTIDAD` (el medio), secundaria `SOLICITUD_ENCUENTRO` (el fin, más severo). Nota: se asignó primaria = suplantación por ser la conducta distintiva del texto; la secundaria cubre el intent de cita.
- #27: "reenvió capturas íntimas de una adolescente a varios contactos" → primaria `DIFUSION_NO_CONSENTIDA`, secundaria `COMPARTIMIENTO_SEXUAL`.
- Regla implementada: acierto si `asignado ∈ {esperada, secundariaEsperada}` (canonizadas). En multi-etiqueta del banco nuevo (24 casos), primaria = categoría de mayor severidad (7 casos re-ordenados al importar los lotes).

## R3 — Auditoría de etiquetas contradichas por 3+ modelos

Query sobre las 5 runs (`simulacion_reportes` + `ClasificacionIA`, desacuerdo por caso ≥ 3 modelos):

| Caso | Etiqueta | Desacuerdos | Resolución |
|---|---|---|---|
| #43 | CONTACTO_INSISTENTE | 4/5 (2× SOLICITUD_MATERIAL, 2× SOLICITUD_ENCUENTRO) | **Corregida** → SOLICITUD_MATERIAL (R1) |

**Ningún otro caso** alcanza 3+ desacuerdos. Banco restante: confirmado sin cambios.

## R4 — Recomputo con el banco saneado: el ranking CAMBIA (reporte a ZEUS+CEO)

Recalculado desde las clasificaciones existentes (sin re-correr modelos), con etiquetas saneadas y multi-etiqueta:

| Modelo | Accuracy | Silenciosos | Subestim. | ESPS | Lat p50 |
|---|---|---|---|---|---|
| **qwen2.5:32b** | **100.0%** | **0** | 0 | **0** | 64.5 s |
| gemma2:27b | 98.0% | **0** | 0 | **0** | 58.2 s |
| qwen2.5:14b | 98.0% | 1 | 0 | 10 | 11.9 s |
| ornith:9b | 96.0% | 1 | 2 | 150 | 17.2 s |
| aya-expanse:32b | 94.0% | 3 | 0 | 60 | 56.3 s |

**gemma2:27b ya NO es el mejor por errores silenciosos**: empata con qwen2.5:32b en 0 silenciosos / 0 ESPS, pero qwen2.5:32b tiene accuracy 100% vs 98% (con n=50, 1 caso de diferencia — IC Wilson se solapan, igual que antes; la diferencia NO es significativa). El default se cambió a gemma2:27b por mandato del entregable D3 antes del recomputo; **se reporta y NO se toca** — mantener o enmendar el ADR es decisión de ZEUS + CEO.

Notas del recomputo: aya sigue siendo el peor (3 silenciosos, sesgo CONTENIDO_GENERADO_IA→COMPARTIMIENTO_SEXUAL visible en su matriz); ornith sigue siendo el único que subestima (2 subestimaciones, severidad perdida 80).

## R5 — Confianza=auto-consistencia (contexto del ADR, sin acción en esta spec)

El umbral `reportes.classification.umbral_revision=1.0` deja pasar errores con confianza 1.00 (votos del MISMO modelo). La compuerta por severidad y el contraste entre modelos (§3.2/§3.3 del ADR) van en spec aparte — fuera de alcance aquí.

## R6 — Decisiones de implementación

- **Severidad desde parámetros**: `obtenerSeveridades()` reutiliza el cargador existente (`scoring.severity.*` con defaults del código como respaldo); los 12 parámetros se sembraron (seed). Nada de mapas nuevos en código.
- **ESPS**: `Σ|Δsev|` sobre errores silenciosos (fallos con `confianza >= umbral_revision`), subestimaciones ×3. Función pura `calcularEsps` testeada.
- **Procedencia del banco**: formato `{ fixtureVersion: 2, casos: [...] }` (parser retrocompatible con array plano); `fuente` por caso (`banco-50-original`, `curado-085`); el comparador advierte si se comparan runs con procedencias distintas.
- **Ampliación a 200**: 150 casos nuevos redactados en 2 lotes (75+75), validados: categorías del enum, ids únicos, parser OK, primaria ≥ secundaria en severidad, 24 multi-etiqueta, cobertura de las 12 categorías.
