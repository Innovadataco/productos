# Data Model: Restablecimiento de Contraseña

## Entidades

### TokenRecuperacion

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String @id @default(cuid()) | Identificador único interno |
| email | String | Email al que se envió el token (no único) |
| tokenHash | String | Hash bcrypt del token de un solo uso |
| expiraEn | DateTime | Fecha/hora de expiración (1 hora) |
| usado | Boolean @default(false) | Indica si ya fue consumido |
| creadoEn | DateTime @default(now()) | Timestamp de creación |
| actualizadoEn | DateTime @updatedAt | Timestamp de última actualización |
| usuarioId | String? | Referencia opcional al usuario |
| usuario | Usuario? | Relación con `Usuario` |

### Relaciones

- `Usuario` 1:N `TokenRecuperacion` (un usuario puede tener varios tokens históricos)

### Índices

- `email`: búsqueda por email para invalidación y rate limiting
- `tokenHash`: búsqueda de token (hash)
- `expiraEn`: limpieza de tokens expirados

## Notas de seguridad

- Nunca se almacena el token en texto plano; solo su hash bcrypt.
- Al generar un nuevo token se invalidan los anteriores no usados para el mismo email.
- El token tiene expiración de 1 hora y se marca como usado inmediatamente tras un restablecimiento exitoso.
