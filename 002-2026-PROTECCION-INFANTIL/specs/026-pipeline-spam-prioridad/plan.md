# Plan — Spec 026: Pipeline de spam + prioridad + reintentos

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
- `Reporte`: campos `prioridadAlta` (Boolean), `processingError` (String?), `estado` (enum).
- `ClasificacionIA`: campo `categoria` (enum).
- `ParametroSistema`: parámetros `worker.max_reintentos` (INTEGER) y `worker.retry_delay_segundos` (INTEGER).

**Nuevo modelo (opcional, si pg-boss no cubre metadata de intentos):**

```prisma
model ReintentoReporte {
  id          String   @id @default(cuid())
  reporteId   String
  intento     Int
  error       String?  @db.Text
  exitoso     Boolean  @default(false)
  creadoEn    DateTime @default(now())

  reporte Reporte @relation(fields: [reporteId], references: [id], onDelete: Cascade)

  @@index([reporteId])
}
```

**Migraciones:**
1. `2026xxxxxx_add_spam_categoria` (ALTER TYPE `CategoriaConducta`).
2. `2026xxxxxx_add_reintento_reporte` (si se opta por tabla propia).

## Herramientas

- **Reutilizar**:
  - `pg-boss` (ya en uso via `src/lib/queue.ts` y worker) para jobs con retry/prioridad.
  - `src/lib/ai/keywords-riesgo.ts` para válvula de alto riesgo en anónimos.
  - `src/lib/anti-abuso/fuente-reporte.ts` y rate-limit para protección de volumen.
  - `DatasetEntrenamiento` + RAG para sembrar ejemplos de spam.
- **Verificar**: pg-boss soporta `priority` nativamente (documentación: sí, `send(..., { priority })`). No se suma otra cola.
- **Nueva**: ninguna.

## Dependencias

- Requiere **Spec 022** para registrar transiciones de reintentos, spam y cambios de prioridad.
- Requiere **Spec 025** para garantizar que ejemplos de spam en RAG estén anonimizados.

## Fases

1. Schema: agregar `SPAM` a `CategoriaConducta`; agregar parámetros de reintentos.
2. Quitar juicio de contenido de la heurística rápida (`src/app/api/reportes/route.ts` y `src/lib/reporte-lifecycle.ts`).
3. Ajustar clasificador: `SPAM` es categoría válida; si confianza alta → `POSIBLE_SPAM` o estado a revisión.
4. Sembrar dataset/RAG con ejemplos de spam (anonimizados).
5. Implementar prioridad en jobs pg-boss: autenticado=ALTA, anónimo=BAJA, keyword alto riesgo=ALTA.
6. Implementar reintentos: contador, metadata de intentos, fallback a `REVISION_MANUAL`.
7. UI de operador: ver intentos, reenviar a reprocesar.
8. Tests de integración.

## Notas

- El tuning de umbrales, precisión y RAG queda para SPEC-050.
- La categoría `SPAM` no se muestra al público; los reportes clasificados como spam pasan a revisión de operador.
