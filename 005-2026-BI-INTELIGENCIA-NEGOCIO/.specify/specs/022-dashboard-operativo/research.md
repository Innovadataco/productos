# RESEARCH-022 · Dashboard OPERATIVO

## Vocabulario real esperado

### `Reporte.estado` (enum · verificado línea 470-479)
```
PENDIENTE · PROCESANDO · CLASIFICADO · REVISION_MANUAL ·
POSIBLE_SPAM · DUPLICADO · REQUIERE_ANONIMIZACION · CORREGIDO
```

### `SolicitudComite.estado` (String libre · default `'PENDIENTE'` · línea 1691)

**Ejecutado** contra `002-2026-proteccion-infantil-db-1`. F3C observación: 2026-08-29 00:0x COT. Re-consulta en PASO 5 sobre `bi-db-replica` cuando esté arriba.

```
$ docker exec 002-2026-proteccion-infantil-db-1 \
    psql -U proteccion -d proteccion_infantil -Atc "SELECT DISTINCT estado FROM \"SolicitudComite\";"

-- SolicitudComite       (0 filas) → ∅
-- Reporte.estado        (2 filas) → REVISION_MANUAL
-- TransicionReporte     (0 filas) → ∅
```

**Nota de muestra baja:** las tablas de flujo operativo (SolicitudComite · TransicionReporte) están vacías en dev. Vocabulario autoritativo por defaults y uso en código:
- `SolicitudComite.estado`: default schema `'PENDIENTE'`; el código app usa: `"PENDIENTE"`, `"ASIGNADA"`, `"REVISION_MANUAL"`, `"RESUELTA"` (evidencia: `src/lib/dal/repositories/solicitud-comite.ts:46`, `src/lib/dal/services/comite-bandeja.ts:159`, `src/lib/dal/repositories/comite-convivencia-solicitudes.ts:94`).
- `TransicionReporte.responsableTipo`: enum cerrado (arriba).

Se re-confirma en réplica productiva antes de mergear si aparece un valor nuevo.

### `TransicionReporte.responsableTipo` (enum · verificado línea 488-495)
```
IA · WORKER · SISTEMA · OPERADOR · COMITE · ADMIN
```

---

## Bloqueador D-022.1 — Definición "reporte no cerrado"

El schema no marca "cerrado". El brief §3.4 propone: `CLASIFICADO` y `CORREGIDO` son terminales lógicos. Pero hay ambigüedad con:

| Estado | ¿Se considera abierto o cerrado? | Argumento |
|---|---|---|
| `POSIBLE_SPAM` | ambiguo | ya se procesó → cerrado, pero puede reactivarse por revisión |
| `DUPLICADO` | probablemente cerrado | apunta a `reporteOrigenId` · caso terminó |
| `REQUIERE_ANONIMIZACION` | abierto | espera acción humana |
| `REVISION_MANUAL` | abierto | espera operador |
| `PENDIENTE` | abierto | recién ingresado |
| `PROCESANDO` | abierto | en pipeline |

**Propuesta por defecto** (KPI 1 spec.md): `NOT IN ('CLASIFICADO', 'CORREGIDO')`. Fábrica BI-2 pregunta a Jelkin si `POSIBLE_SPAM` y `DUPLICADO` deben excluirse también. Documentar respuesta aquí en PASO 5:

```
-- Respuesta Jelkin:  [pendiente]
-- Fecha respuesta:   [pendiente]
-- Ajuste al SQL:     [pendiente]
```

Si Jelkin no responde en 24 h → PARA + escala a CEO (regla dura INSTRUCTIVO-010).

---

## Decisiones de diseño

### D-022.1 · "No cerrado" = NOT IN ('CLASIFICADO', 'CORREGIDO') por defecto
Sujeto a confirmación de Jelkin (arriba).

### D-022.2 · `resueltoEn - creadoEn` en horas
KPI 3 devuelve horas para lectura humana (Jelkin razona en horas, no en segundos). `EXTRACT(EPOCH FROM ...) / 3600` da horas decimales; `ROUND(::numeric, 2)` deja 2 decimales.

### D-022.3 · KPI 5 muestra colegio con LEFT JOIN
Reportes en `REVISION_MANUAL` pueden ser anónimos (sin `tenantId`). Se muestran igual en la tabla con colegio vacío para que Fábrica vea el volumen total pendiente.

### D-022.4 · KPI 7 filtra `terminaEn IS NOT NULL`
Suscripciones con `terminaEn = NULL` son indefinidas · no vencen · no aparecen en el KPI. Esto se documenta pero no se muestra a Jelkin como "sin datos" — es correcto.

### D-022.5 · MV `mv_fact_operativo` no se usa directamente
La MV existe (migración `20260828120100_mv_fact_bi` líneas 54-71) pero agrupa transiciones día-a-día con LEFT JOIN a SolicitudComite. Los KPIs 1..7 necesitan lecturas ad-hoc a las tablas base (por ejemplo `estado = 'REVISION_MANUAL' AND creadoEn < NOW() - 7d`). La MV se reservará para dashboards futuros de tendencias mensuales de flujo.

---

## Fuentes consultadas

- `schema.prisma` PI · Reporte 1609-1685 · SolicitudComite 1687-1717 · TransicionReporte 1719-1737 · Subscription 851-859 · Colegio 1055-1105 · enum EstadoReporte 470-479 · enum ResponsableTransicion 488-495
- `prisma/migrations/20260828120100_mv_fact_bi/migration.sql` MV `mv_fact_operativo` líneas 54-71
- BRIEF-A-02 v1.1 §3.4 (7 KPIs · nota sobre definición "no cerrado")

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
