# Contrato API — Parámetros globales de pagos (`/api/admin/pagos/parametros`)

**Autenticación**: cookie `token` con JWT de usuario `ADMIN`.  
**Permiso de módulo**: `pagos_admin`.

---

## PATCH /api/admin/pagos/parametros

Actualiza en batch las 7 claves globales de pagos definidas en el BRIEF §6.3.

### Body

```json
{
  "pagos.iva.porcentaje": 19,
  "pagos.iva.aplica_a": "todos",
  "pagos.freemium.activo": true,
  "pagos.freemium.duracion_dias": 30,
  "pagos.recompensa.activa": true,
  "pagos.recompensa.meses_gratis": 1,
  "pagos.recompensa.max_por_año": 5
}
```

### Validaciones

| Clave | Tipo | Rango/Valores |
|-------|------|---------------|
| `pagos.iva.porcentaje` | float | 0 - 100 |
| `pagos.iva.aplica_a` | string | `todos`, `solo_colegios`, `solo_padres`, `ninguno` |
| `pagos.freemium.activo` | boolean | — |
| `pagos.freemium.duracion_dias` | integer | >= 1 |
| `pagos.recompensa.activa` | boolean | — |
| `pagos.recompensa.meses_gratis` | integer | 0 - 12 |
| `pagos.recompensa.max_por_año` | integer | 0 - 100 |

### Respuesta 200

```json
{
  "parametros": {
    "pagos.iva.porcentaje": "19",
    "pagos.iva.aplica_a": "todos",
    "pagos.freemium.activo": "true",
    "pagos.freemium.duracion_dias": "30",
    "pagos.recompensa.activa": "true",
    "pagos.recompensa.meses_gratis": "1",
    "pagos.recompensa.max_por_año": "5"
  }
}
```

> Los valores se almacenan como `string` en `ParametroSistema.valor`; la respuesta refleja el valor persistido.

### Respuestas

- `400 Bad Request` → algún valor fuera de rango o tipo incorrecto.
- `401/403/429` → auth/module/rate limit.

### Auditoría

Registra un único `AuditLog` con:

- `accion = PARAM_UPDATE`
- `tipoRecurso = ParametroSistema`
- `valorAnterior` y `valorNuevo` como JSON con el snapshot completo de las 7 claves.
- `metadatos.claves` con el listado de claves afectadas.

---

## Errores canónicos

```json
{
  "error": {
    "message": "...",
    "code": "VALIDATION_ERROR | RATE_LIMITED | ...",
    "details": [ ... ]
  }
}
```
