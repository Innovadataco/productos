# Data Model — SPEC-303 · Ficha colegio admin Fase 1

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

## Alcance del documento

Este fix NO añade tablas ni migraciones. Documenta:

1. Modelos Prisma existentes consumidos.
2. Shape del resultado del nuevo repositorio `ColegioActividadRepository.actividadDelColegio(...)`.
3. Definición operativa de "estados abiertos" (alertas + expedientes).
4. Nuevas claves de `ParametroSistema`.

Cero cambios en `prisma/schema.prisma`.

## 1. Modelos Prisma existentes usados

### `Reporte` (schema:1609)

Campos relevantes:
- `id` (cuid) — usado para dedup.
- `tenantId` (denormalizado, comparte con `Colegio.tenantId @unique`) — ruta A.
- `identificador` (string) + `plataformaId` (FK) — usados para ruta B.
- `estado` (enum `EstadoReporte`) — usado en `porEstado`.
- `createdAt` — usado para `ultimaActividad` y filtro por rango.
- NO tiene `colegioId` directo (motivo del bug I-98).

### `AlertaColegio` (schema:1370)

Campos relevantes:
- `colegioId` (FK directo a `Colegio`) — ruta C, y candado testigo I-98 (SELECT COUNT WHERE colegioId=X).
- `reporteId` (FK a `Reporte`) — ruta C.
- `estado` (string) con valores `nueva|vista|gestionada|escalada|cerrada`. Abiertos: `nueva|vista|escalada`.

### `Colegio` (schema:1055)

Campos relevantes:
- `id` (cuid) — parámetro del método.
- `tenantId @unique` — usado para ruta A.
- `estado` (string, default `"activo"`) — no consumido por este fix.

### `IdentificadorEstudiante` (schema:1348)

Campos relevantes:
- `estudianteId` (FK a `Estudiante`) — join adicional para obtener `colegioId`.
- `identificador`, `plataformaId` — usados para join con `Reporte`.

### `Estudiante` (schema:1440 · asumido)

- `colegioId` (FK) — desanuda desde `IdentificadorEstudiante` a colegio.

### `IdentificadorProfesor` (schema:1303)

- `colegioId` (denormalizado directo) — ruta B más simple.
- `identificador`, `plataformaId`.

### `IdentificadorAcudiente` (schema:1279)

- `colegioId` (denormalizado directo).
- `identificador`, `plataformaId`.

### `Expediente` (schema:2286)

- `colegioId` (asumido; verificar en `/speckit-implement`).
- `estado` (string; valor terminal a confirmar — `'cerrado'` o `'CERRADO'` o `'FINALIZADO'`).

### `ParametroSistema` (schema existente)

- `clave` (unique string) — 3 nuevas claves añadidas.
- `valor` (JSON o string según convención del proyecto — verificar en seed).

## 2. Resultado del método `actividadDelColegio(colegioId, rango)`

Shape TypeScript propuesto:

```ts
interface ActividadDelColegio {
  reportes: ReporteSummary[];      // deduplicados por Reporte.id
  total: number;                    // reportes.length
  porEstado: Record<EstadoReporte, number>;   // conteo por estado del enum
  casosAbiertos: number;            // alertas del colegio no-cerradas + expedientes activos
  ultimaActividad: Date | null;     // MAX(reporte.createdAt) o null si total=0
}

interface ReporteSummary {
  id: string;
  estado: EstadoReporte;
  createdAt: Date;
  // NO se expone texto del reporte (constitución §6.3 · texto crudo en logs prohibido)
  // NO se expone identificador ni datos personales
  categorias?: string[];  // opcional · categorías de la clasificación IA para agregados
}
```

**Justificación de `ReporteSummary` sin texto crudo**: la ficha del ADMIN muestra números agregados, no textos. La constitución §6.3 prohíbe exponer texto de reporte fuera de las vistas específicas de moderación. `ReporteSummary` es la proyección mínima para las agregaciones.

## 3. Definición operativa de estados abiertos

### Alertas abiertas

`AlertaColegio.estado IN ('nueva', 'vista', 'escalada')` para el `colegioId` dado.

### Expedientes activos

`Expediente.estado != 'cerrado'` (case-insensitive · valor exacto verificado en `/speckit-implement`) para el `colegioId` dado.

**Composición `casosAbiertos`**:

```
casosAbiertos = COUNT(AlertaColegio abiertas) + COUNT(Expediente activos)
```

Sin dedup entre alertas y expedientes — son entidades distintas del negocio, aunque un expediente pueda derivar de una alerta. El brief §3 los define como el conjunto de "acciones que espera el admin", sumando ambos.

### Estados "abiertos" de reporte (NO usados en casosAbiertos)

Los estados `REVISION_MANUAL` y `POSIBLE_SPAM` del reporte son procesamiento interno (los procesa el worker o el operador humano de moderación), NO responsabilidad del ADMIN del colegio. Por eso NO cuentan hacia `casosAbiertos`.

## 4. Nuevas claves de `ParametroSistema`

Namespace REUTILIZADO: `analytics.colegios.*` (5 keys preexistentes + 3 nuevas).

| Clave nueva | Default | Tipo | Uso |
|---|---|---|---|
| `analytics.colegios.casos_abiertos_alto` | `5` | integer (>= 0) | Umbral: si `casosAbiertos > este valor`, semáforo tira a rojo |
| `analytics.colegios.casos_sin_movimiento_dias` | `14` | integer (>= 0) | Umbral: si alguna alerta abierta lleva más de N días sin cambio de estado, semáforo tira a rojo |
| `analytics.colegios.porcentaje_procesado_min` | `0.7` | float en [0, 1] | Umbral: si `% reportes procesados` cae bajo este ratio, semáforo tira a amarillo/rojo |

Sembradas con:

```ts
await prisma.parametroSistema.upsert({
  where: { clave: p.clave },
  update: {},
  create: p,
});
```

## 5. Diagrama de rutas de pertenencia

```
                       Colegio (colegioId)
                       ─────┬──────────────
                            │
    ┌───────────────────────┼──────────────────────────────────┐
    │                       │                                  │
    ▼                       ▼                                  ▼
Ruta A (tenantId)     Ruta B (identificador enrolado)    Ruta C (alerta)
    │                       │                                  │
    ▼                       ▼                                  ▼
Reporte                Identificador*                    AlertaColegio
  tenantId ==            (Est/Prof/Acud)                   colegioId ==
  Colegio.tenantId       └─ colegioId matchea               (FK directo)
                          Reporte.identificador+plataforma
                            │
                            ▼
                          Reporte (por join)
                            
                       Todos → UNIÓN por Reporte.id
                       (DISTINCT · dedup)
```

## 6. Reglas de validación

- `colegioId` DEBE existir en `Colegio`. El repo lanza `AppError(404)` si no.
- `rango.desde` DEBE ser `<= rango.hasta`. El repo lanza `AppError(400)` si no.
- `rango` DEBE cubrir un máximo razonable (hard-cap 5 años) para prevenir queries hostiles. El default (30d) queda muy dentro del cap.

## 7. Estados relevantes (state transitions)

### `AlertaColegio`

```
nueva → vista → escalada → gestionada → cerrada
              ↘─→ gestionada → cerrada
              ↘─→ cerrada (sin gestión)
```

"Abiertos" (para `casosAbiertos`): `nueva`, `vista`, `escalada`.

### `Reporte`

```
PENDIENTE → PROCESANDO → CLASIFICADO
                       → REVISION_MANUAL → CORREGIDO
                       → POSIBLE_SPAM
                       → DUPLICADO
                       → REQUIERE_ANONIMIZACION
```

Todos los estados NO-PENDIENTE cuentan en `total` del rango si su `createdAt` está en el rango. `porEstado` refleja la distribución exacta.

## 8. Sin migración Prisma

Este fix NO toca `schema.prisma`. Todos los modelos usados existen. Si durante `/speckit-implement` se descubre que `Expediente` no tiene los campos esperados, se ajusta el default de `casosAbiertos` (fallback a solo alertas) y se documenta en el `plan.md` sin escribir migración. La deuda queda como brief separado.
