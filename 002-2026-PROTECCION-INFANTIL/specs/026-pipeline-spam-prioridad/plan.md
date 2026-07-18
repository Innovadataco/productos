> # Plan — Spec 026: Pipeline de spam

## Modelos y campos de BD (schema.prisma)

**Enum existente modificado:**
- `CategoriaConducta`: agregar `SPAM`.

```prisma
enum CategoriaConducta {
  CONTACTO_INSISTENTE
  SOLICITUD_MATERIAL
  OFRECIMIENTO_REGALOS
  SUPLANTACION_IDENTIDAD
  SOLICITUD_ENCUENTRO
  COMPARTIMIENTO_SEXUAL
  OTRO
  EXTORSION
  CONTENIDO_GENERADO_IA
  DIFUSION_NO_CONSENTIDA
  DOXING
  SPAM
}
```

**Modelos existentes:**
- `Reporte`: campos `estado` (enum), `prioridadAlta` (Boolean).
- `ClasificacionIA`: campo `categoria` (enum).
- `DatasetEntrenamiento`: para sembrar ejemplos de spam.

**Migración:** `2026xxxxxx_add_spam_categoria` (ALTER TYPE `CategoriaConducta`).

## Herramientas

- **Reutilizar**:
  - Clasificador IA `ornith:9b` + RAG existente.
  - `DatasetEntrenamiento` + `EmbeddingDataset` para sembrar spam.
  - `src/lib/ai/keywords-riesgo.ts` para válvula de alto riesgo en anónimos (eleva prioridad, no decide spam).
  - `ParametroSistema` para umbrales de spam.
  - Motor de encolamiento de **Spec 027** (incluye `ReintentoReporte`).
- **Nueva**: ninguna.

## Dependencias

- Requiere **Spec 022** para registrar transiciones de spam.
- Requiere **Spec 025** para garantizar que ejemplos de spam en RAG estén anonimizados.
- Requiere **Spec 027** para prioridad, reintentos e historial de intentos.

## Fases

1. Schema: agregar `SPAM` a `CategoriaConducta`.
2. Quitar juicio de contenido de la heurística rápida (`src/app/api/reportes/route.ts` y `src/lib/reporte-lifecycle.ts`).
3. Ajustar clasificador: `SPAM` es categoría válida; si confianza alta → `POSIBLE_SPAM` o `REVISION_MANUAL`.
4. Sembrar dataset/RAG con ejemplos de spam anonimizados.
5. UI de operador: revisar spam, marcar válido/spam; visualizar historial de reintentos proveniente de Spec 027.
6. Tests de integración.

## Notas

- La categoría `SPAM` no se muestra al público; los reportes clasificados como spam pasan a revisión de operador.
- El historial de reintentos se define e implementa en **Spec 027**. Esta spec solo lo consume para mostrarlo al operador.
- El tuning de umbrales, precisión y RAG queda para SPEC-050.
