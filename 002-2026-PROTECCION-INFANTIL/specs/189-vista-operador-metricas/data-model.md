# Modelo de datos: SPEC-189 — Vista de operador con métricas

## Impacto en schema Prisma

Ninguno. La spec se implementa enteramente con consultas y agregaciones sobre el modelo existente.

## Entidades consultadas

| Entidad | Uso |
|---------|-----|
| `Usuario` + `PerfilOperador` | Datos del operador, cupo máximo, estado. |
| `Reporte` | Casos abiertos/resueltos del operador (`operadorId`, `estado`, `eliminado`). |
| `ClasificacionIA` | Categoría del reporte para métricas y listados. |
| `AuditLog` | Tiempos de asignación (`OPERADOR_ASIGNADO`), cierre (`CASO_CONFIRMADO`, `CASO_CORREGIDO`, `CASO_DADO_DE_BAJA`) y escalamiento (`CASO_ESCALADO`). |
| `Plataforma` | Nombre/clave para mostrar en tablas. |

## Índices existentes relevantes

- `Usuario.rol + estado` (usado por `findOperadoresActivosAsignacion`).
- `Reporte.operadorId` implícito por la relación.
- `AuditLog.accion`, `AuditLog.creadoEn`, `AuditLog.usuarioId`.

No se requieren índices nuevos para la fase inicial; si las métricas de 30 días resultan lentas en producción, se evaluará un índice compuesto aditivo en una spec posterior.

## DTOs / tipos

Ver [plan.md](./plan.md) §1 y `contracts/` si se formalizan JSON schemas.
