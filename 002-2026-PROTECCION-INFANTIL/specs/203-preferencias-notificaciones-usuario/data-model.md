> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Modelo de datos: SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100)

## Resumen

No hay cambios de schema. SPEC-203 consume el modelo `NotificacionPreferencia` creado en SPEC-201.

## Modelo usado

`NotificacionPreferencia`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `usuarioId` | `String` | |
| `eventoRegla` | `String` | `"evento.canal"` |
| `habilitado` | `Boolean @default(true)` | |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | |

`@@unique([usuarioId, eventoRegla])`.

## Semántica

- Si no existe fila para `(usuarioId, eventoRegla)`, se asume `habilitado = true` (opt-out).
- Si la regla correspondiente es `obligatoria: true`, la preferencia se muestra como no editable.

## Integración

- `src/lib/notificaciones/motor.ts` consulta preferencias antes de programar.
- `src/lib/notificaciones/preferencias.ts` expone helpers de lectura/escritura.
