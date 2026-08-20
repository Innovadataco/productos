# Modelo de datos: SPEC-186

## Cambios propuestos

### Opción A (recomendada): columna aditiva `metodo` en `HealthProbe`

```prisma
model HealthProbe {
  id         String   @id @default(cuid())
  senal      String   // app | worker | bd | ollama_ping | ollama_smoke | tailscale
  ok         Boolean
  latenciaMs Int      @default(0)
  detalle    String?
  metodo     String?  @default("SMOKE") // PING | PIGGYBACK | SMOKE
  creadoEn   DateTime @default(now())

  @@index([senal, creadoEn])
  @@index([senal, metodo, creadoEn]) // opcional, para resumen 24h
}
```

**Justificación**: permite filtrar y agrupar por método sin parsear `detalle`. El default `"SMOKE"` asigna un método coherente a los probes históricos (todos eran smokes reales antes de SPEC-186).

**Migración SQL aditiva**:

```sql
ALTER TABLE "HealthProbe" ADD COLUMN "metodo" TEXT DEFAULT 'SMOKE';
```

### Opción B (alternativa): método codificado en `detalle`

Sin cambios en el schema. El `detalle` comienza con un prefijo consistente:

- `[PING] ...`
- `[PIGGYBACK] ...`
- `[SMOKE] ...`

Requiere parseo en el endpoint de historial. Menos limpio para agregaciones.

## Entidades de soporte (sin cambios)

- `ClasificacionIA`: se consulta `creadoEn` de la última fila para el piggyback.
- `IncidenteInfra`: sin cambios; el ciclo de incidentes se mantiene igual.
- `ParametroSistema`: se añaden/resiembran:
  - `monitoreo.ollama.smoke.piggyback_min` (INTEGER, default 15)
  - `monitoreo.ollama.smoke.intervalo_min` (INTEGER, default 30 en creación)
