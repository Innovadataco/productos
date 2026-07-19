# Data Model: Fixes de seguridad y limpieza

**Date**: 2026-07-19
**Feature**: specs/037-seguridad-limpieza/spec.md

---

## Cambios al modelo de datos

No hay cambios en el esquema de Prisma para este spec.

### Entidades afectadas (solo lectura/escritura existente)

- **`RateLimit`**: La tabla ya almacena contadores por scope; ahora se usa también en los endpoints admin pendientes.
- **`TransicionReporte`**: El campo `metadatos` (JSON) dejará de contener el mensaje de error crudo; pasará a contener un mensaje genérico y un código de error.
- **`Reporte`**: El campo `processingError` puede seguir conteniendo un mensaje genérico; no se amplía ni se modifica su schema.

### Relaciones

```text
Usuario ||--o{ RateLimit : "consume por request"
Usuario ||--o{ TransicionReporte : "origina como responsable"
Reporte ||--o{ TransicionReporte : "registra cambios de estado"
```

### Notas

- No se requiere migración nueva.
- No se requiere actualización de seed.
- No se crean ni eliminan tablas, índices ni enums.
