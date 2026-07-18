> # Quickstart — Estados de cara al usuario + SLA visible

## Escenario A: Seguimiento por código muestra "En proceso"

**Prerrequisitos**: Reporte creado recientemente en estado `PENDIENTE` con `numeroSeguimiento = RPT-ABC123`.

1. Sin autenticación, llamar `GET /api/reportes/seguimiento/RPT-ABC123`.

**Validación**:
```json
{
  "numeroSeguimiento": "RPT-ABC123",
  "estadoVisual": "En proceso",
  "mensaje": "Tu reporte está en proceso — puede tardar hasta 24 horas",
  "slaHoras": 24
}
```

**Esperado**: `200`; el estado visual es "En proceso" aunque el estado interno sea `PENDIENTE`.

---

## Escenario B: Seguimiento por código muestra "Procesado"

**Prerrequisitos**: Reporte procesado por el worker a estado `CLASIFICADO`.

1. Llamar `GET /api/reportes/seguimiento/RPT-ABC123`.

**Validación**:
```json
{
  "numeroSeguimiento": "RPT-ABC123",
  "estadoVisual": "Procesado",
  "mensaje": "Tu reporte ha sido procesado y clasificado."
}
```

**Esperado**: `200`; estado visual "Procesado".

---

## Escenario C: Reporte dado de baja no aparece en seguimiento

**Prerrequisitos**: Reporte con `numeroSeguimiento = RPT-BAJA123` marcado como `eliminado = true`.

1. Llamar `GET /api/reportes/seguimiento/RPT-BAJA123`.

**Validación**: Respuesta `404` con mensaje "Número de seguimiento no encontrado".

**Esperado**: El usuario final no puede ver reportes eliminados.

---

## Escenario D: Mis reportes filtra eliminados

**Prerrequisitos**: Usuario autenticado con 3 reportes: 2 activos (`CLASIFICADO`, `PENDIENTE`) y 1 dado de baja.

1. Iniciar sesión como usuario PARENT.
2. Llamar `GET /api/reportes/mis-reportes`.

**Validación**:
- Total devuelto: 2 reportes.
- El reporte `eliminado = true` no aparece.
- Estados visuales: "Procesado" y "En proceso" respectivamente.

**Esperado**: `200`; lista sin reportes eliminados.

---

## Escenario E: SLA configurable desde administración

**Prerrequisitos**: Admin autenticado.

1. Llamar `PATCH /api/config/parametros/ui.sla_horas_procesamiento` con `{ "valor": "48" }`.
2. Consultar seguimiento de un reporte `PENDIENTE`.

**Validación**: El mensaje dice "puede tardar hasta 48 horas".

**Esperado**: `200` en ambas llamadas; el parámetro se refleja inmediatamente.

---

## Escenario F: Estados internos se mantienen en el panel de operación

**Prerrequisitos**: Operador logueado con reporte en `REVISION_MANUAL`.

1. Abrir bandeja de operador.
2. Verificar que el reporte muestra `REVISION_MANUAL` (no el mapeo visual).

**Validación**: El estado interno es visible para operadores.

**Esperado**: No se aplica el mapeo visual en bandejas internas.

---

## Escenario G: DUPLICADO se muestra como "Procesado" con badge muted

**Prerrequisitos**: Reporte marcado como `DUPLICADO` por el sistema.

1. El usuario que lo creó consulta `/mis-reportes`.

**Validación**: Estado visual "Procesado", badge `muted`, sin detalle de clasificación.

**Esperado**: No se confunde con "En proceso" ni con "Procesado" exitoso.
