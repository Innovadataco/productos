# Modelo de datos: SPEC-195 — Motor SPAM + Aprendizaje operativo

> Cero migraciones destructivas. Se reutilizan tablas existentes; no se añaden campos nuevos.

## Entidades reutilizadas

| Entidad | Uso en esta SPEC | Notas |
|---------|------------------|-------|
| `Reporte` | Estado del reporte; `prioridadAlta`, `esRafaga`, `keywordsDetectadas`. | El patrón coordinado fuerza `REVISION_MANUAL` + `prioridadAlta=true`. |
| `ClasificacionIA` | Almacena clasificación del motor o heredada del caché (`modeloUsado="cache:humano:<id>"`). | `latenciaMs=0` en hits de caché. |
| `CorreccionAdmin` | Confirma correcciones humanas (`categoriaOriginal=SPAM` → `categoriaCorregida`). | Fuente de verdad para el caché humano-confirmado. |
| `DatasetEntrenamiento` | Guarda texto + clasificación correcta de cada decisión humana. | Alimenta futuro RAG y trazabilidad. |
| `EmbeddingReporte` | Embedding de cada reporte; usado para caché y patrón coordinado. | Similitud coseno con pgvector. |
| `EmbeddingDataset` | Embedding de cada ejemplo de `DatasetEntrenamiento`. | Alimenta futuro RAG. |
| `IncidenteInfra` | Registro del patrón coordinado con señal `patron_coordinado:<hash-texto>`. | Reusado de SPEC-171/184; campos: `senal`, `estado`, `inicio`, `fin`, `detalle`, `ultimoEmailEn`. |
| `AuditLog` | Trazabilidad de decisiones humanas. | Sin texto completo del reporte. |
| `ParametroSistema` | Umbrales, SLA, template de notificación, severidad. | 9 parámetros nuevos. |
| `Usuario` | Email del denunciante para notificación. | Solo autenticados. |

## Estados relevantes

- `POSIBLE_SPAM`: motor detectó SPAM con confianza ≥ umbral.
- `REVISION_MANUAL`: patrón coordinado o revisión por guardas.
- `CLASIFICADO`: corrección/procesar_como_acoso.
- `DADO_DE_BAJA`: spam confirmado.

## Consultas principales

### Caché semántico

```sql
SELECT r.id, c.categoria, c.confianza, 1 - (e.vector <=> $1::vector) AS similitud
FROM "EmbeddingReporte" e
JOIN "Reporte" r ON r.id = e."reporteId"
JOIN "ClasificacionIA" c ON c."reporteId" = r.id
LEFT JOIN "CorreccionAdmin" ca ON ca."clasificacionId" = c.id
WHERE 1 - (e.vector <=> $1::vector) >= $2
  AND r.id != $3
  AND (
      (r.estado = 'CORREGIDO' AND ca.confirmada = true)
      OR ($4 = false AND r.estado = 'CLASIFICADO' AND c.confianza >= 0.9)
  )
ORDER BY e.vector <=> $1::vector ASC
LIMIT 1;
```

### Patrón coordinado

```sql
SELECT COUNT(DISTINCT r.identificador) AS identificadores_distintos,
       array_agg(DISTINCT r.id) AS reportes_relacionados
FROM "EmbeddingReporte" e
JOIN "Reporte" r ON r.id = e."reporteId"
WHERE 1 - (e.vector <=> $1::vector) >= $2
  AND r."creadoEn" >= NOW() - INTERVAL '$3 minutes'
  AND r.id != $4;
```

## Consideraciones

- El modelo de embeddings debe ser el mismo para que la similitud sea comparable. El helper filtrará por `modeloUsado` si es necesario.
- `IncidenteInfra` se usa para patrón coordinado: señal fija con hash del texto, detalle JSON, cierre automático tras 60 min sin matches.
