# Contracts — SPEC-196

## `POST /api/admin/anti-abuso/bloquear`

### Request (nuevo)

```json
{
  "ip": "192.0.2.50",
  "motivo": "IP asociada a robot de spam",
  "duracion": "24h"
}
```

### Validación

- `ip`: string, IPv4 o IPv6 válida.
- `motivo`: string, 1..500 chars.
- `duracion`: enum `"24h" | "7d" | "permanente"`.

### Procesamiento

- Backend calcula `sha256(ip.trim().toLowerCase())` y persiste el hash.
- Respuesta igual a la actual: `{ ok: true, bloqueo }`.

## `POST /api/admin/anti-abuso/desbloquear`

### Request (nuevo)

```json
{
  "id": "cuid-del-bloqueo",
  "motivo": "Falsa alarma confirmada por soporte"
}
```

### Validación

- `id`: CUID válido.
- `motivo`: string, 20..500 chars.

### Procesamiento

- Elimina el bloqueo.
- Registra `AuditLog` con `accion = IP_DESBLOQUEADA_MANUAL` y metadatos `{ ipHash, motivo, admin_id, bloqueo_id, duracion_original }`.
- Respuesta igual a la actual: `{ ok: true, bloqueo }`.
