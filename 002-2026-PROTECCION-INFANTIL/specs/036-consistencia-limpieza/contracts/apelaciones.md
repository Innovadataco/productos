# Contract: Apelaciones — Renombramiento de rutas

**Base Path**: `/api/apelaciones` (antes `/api/apeaciones`)

## Endpoints públicos

### POST /api/apelaciones/solicitar

Solicitar una apelación. Requiere verificación SMS.

### POST /api/apelaciones/verificar

Verificar el OTP de apelación.

### GET /api/apelaciones/:token

Consultar el estado de una apelación por token.

## Endpoints admin

**Base Path**: `/api/admin/apelaciones` (antes `/api/admin/apeaciones`)

### GET /api/admin/apelaciones

Listar apelaciones pendientes/resueltas.

### GET /api/admin/apelaciones/:id

Obtener detalle de una apelación.

### PATCH /api/admin/apelaciones/:id/resolver

Resolver una apelación (mantener, anonimizar, eliminar).

### PATCH /api/admin/apelaciones/:id/rehabilitar

Rehabilitar un identificador tras apelación.

### POST /api/admin/apelaciones/vencer

Marcar apelaciones vencidas por SLA.

## Notas

- Todos los consumidores (frontend, librerías, proxy, navegación) se actualizan al nuevo nombre.
- No hay cambio de funcionalidad, solo nomenclatura corregida.
