# SPEC-022 · Dashboard OPERATIVO

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 022 |
| **Nombre** | dashboard-operativo |
| **Origen** | BI · INSTRUCTIVO-010 · F3C 2026-08-28 22:34 COT |
| **Brief** | BI · A-02 v1.1 §3.4 |
| **Audiencia** | Fábrica + Jelkin ocasional |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Entregar en Superset el tablero **OPERATIVO** con 7 KPIs sobre la salud del proceso de casos (Reporte) y del Comité de Convivencia (SolicitudComite).

---

## Alcance · 7 KPIs

| # | KPI | Fuente | Visualización | Refresh |
|---|---|---|---|---|
| 1 | Reportes en flujo (no cerrados) | `Reporte` | Big Number | 15 min |
| 2 | Solicitudes comité pendientes | `SolicitudComite` | Big Number | 15 min |
| 3 | Tiempo promedio resolución comité (30d) | `SolicitudComite` | Big Number (horas) | 60 min |
| 4 | Distribución por estado Reporte | `Reporte` | Pie chart | 15 min |
| 5 | Reportes en REVISION_MANUAL > 7 días | `Reporte` × `Colegio` | Tabla | 15 min |
| 6 | Transiciones por responsable (7d) | `TransicionReporte` | Bar chart | 30 min |
| 7 | Vencimientos suscripciones próximos 30d | `Subscription` × `Colegio` | Tabla + Big Number | 60 min |

### SQL base (candado 15 · enum `EstadoReporte` líneas 470-479 schema PI)

**1 · Reportes en flujo (no cerrados)** — definición pendiente confirmación Jelkin (D-022.1)
```sql
SELECT count(*) AS en_flujo
FROM "Reporte"
WHERE estado NOT IN ('CLASIFICADO', 'CORREGIDO')
  AND "eliminado" = false;
```

**2 · Solicitudes comité pendientes** (`SolicitudComite.estado` default `'PENDIENTE'` mayúsculas · línea 1691)
```sql
SELECT count(*) AS comite_pendientes
FROM "SolicitudComite"
WHERE estado = 'PENDIENTE';
```

**3 · Tiempo promedio resolución comité (30 días)**
```sql
SELECT ROUND(AVG(EXTRACT(EPOCH FROM ("resueltoEn" - "creadoEn")) / 3600)::numeric, 2) AS horas_promedio
FROM "SolicitudComite"
WHERE "resueltoEn" IS NOT NULL
  AND "resueltoEn" >= NOW() - INTERVAL '30 days';
```

**4 · Distribución por estado Reporte**
```sql
SELECT estado::text AS estado, count(*) AS total
FROM "Reporte"
WHERE "eliminado" = false
GROUP BY estado
ORDER BY total DESC;
```

**5 · Reportes REVISION_MANUAL > 7 días** (candado 13 · sin PII)

`Reporte.identificador` es PII (handle de la persona reportada; mismo campo que `IdentificadorReportado`; el schema PI lo trata como PII en `PatronInstitucional`: "SIN PII por construcción... nunca identificador"). No se expone en la tabla — se muestra el `numeroSeguimiento` (identificador de expediente, no de persona) y `plataforma.nombre` para orientar al operador.

```sql
SELECT r.id,
       r."numeroSeguimiento",
       p.nombre AS plataforma,
       r."creadoEn",
       c.nombre AS colegio
FROM "Reporte" r
LEFT JOIN "Colegio" c ON c."tenantId" = r."tenantId"
LEFT JOIN "Plataforma" p ON p.id = r."plataformaId"
WHERE r.estado = 'REVISION_MANUAL'
  AND r."creadoEn" < NOW() - INTERVAL '7 days'
  AND r."eliminado" = false
ORDER BY r."creadoEn" ASC
LIMIT 500;
```

**6 · Transiciones por responsable (7 días)** (`ResponsableTransicion` enum: IA · WORKER · SISTEMA · OPERADOR · COMITE · ADMIN · línea 488-495)
```sql
SELECT "responsableTipo"::text AS responsable, count(*) AS transiciones
FROM "TransicionReporte"
WHERE "creadoEn" >= NOW() - INTERVAL '7 days'
GROUP BY "responsableTipo"
ORDER BY transiciones DESC;
```

**7 · Vencimientos suscripciones próximos 30 días**
```sql
SELECT s.id,
       c.nombre AS colegio,
       s."terminaEn"
FROM "Subscription" s
JOIN "Colegio" c ON c."tenantId" = s."tenantId"
WHERE s."terminaEn" IS NOT NULL
  AND s."terminaEn" BETWEEN NOW() AND NOW() + INTERVAL '30 days'
ORDER BY s."terminaEn" ASC
LIMIT 200;
```

Big Number contador: `SELECT count(*) FROM "Subscription" WHERE "terminaEn" BETWEEN NOW() AND NOW() + INTERVAL '30 days';`

---

## Fuera de alcance

- Alertas Telegram cuando `REVISION_MANUAL > 7d` (INSTRUCTIVO-008)
- Reasignación de casos desde Superset (Superset read-only)
- Vista comité con detalle de resolución (no PII en Fase 1)

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 9 | Sin datos → "No data" | Superset default |
| 11 | Multi-tenancy | Fase 1 solo ADMIN · row-level Fase 2 |
| 13 | Sanitizer PII | KPI 5 no expone `Reporte.texto` NI `Reporte.identificador` (handle de la persona reportada · PII). Se muestran solo `id` interno · `numeroSeguimiento` de expediente · `plataforma.nombre` · `colegio.nombre` |
| 14 | Verificación en vivo | Fábrica valida definición "no cerrado" con Jelkin antes de acusar CUMPLE |
| 15 | Verificar en fuente | Enum `EstadoReporte` y `ResponsableTransicion` verificados líneas 470-495 |
| 17 | spec+plan commiteado | Aplicado |

---

## Bloqueadores

- **D-022.1 · Definición "reporte no cerrado":** el schema no marca "cerrado" explícito. Interpretación por defecto: `CLASIFICADO` y `CORREGIDO` son terminales. Jelkin debe confirmar por escrito antes de CUMPLE. Fábrica BI-2 pregunta y espera respuesta 24 h; si no hay respuesta → PARA + escala a CEO (regla dura del INSTRUCTIVO-010 §2 REGLAS DURAS).

---

## Riesgos

- **`REVISION_MANUAL` > 500 casos** en tabla KPI 5 → paginar o subir LIMIT según petición Fábrica.
- **Suscripciones sin `terminaEn`** (contratos indefinidos) quedan fuera de KPI 7 → OK por definición.
- **`Reporte.tenantId = NULL`** en reportes anónimos → LEFT JOIN en KPI 5 muestra colegio vacío. Aceptable en Fase 1.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 22:45 COT |
| **Autor** | BI-Dev 2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
