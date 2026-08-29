# Modelo de datos: SPEC-188 — Visibilidad del operador en la bandeja

## Impacto en schema Prisma

Ninguno. No se añaden tablas ni columnas.

## Entidades existentes involucradas

- `Reporte`: campos `operadorId` (ya existe) y relación `operador → Usuario`.
- `Usuario`: campos `id`, `email`, `nombre`, `rol`, `estado`.
- `AuditLog`: campos `accion`, `tipoRecurso`, `recursoId`, `usuarioId`, `valorNuevo`, `creadoEn`.

## DTOs / tipos

### `ReporteListItem` (frontend)

Extensión opcional:

```ts
operadorId?: string | null;
operadorEmail?: string | null;
```

### `EventoAsignacionOperador` (backend)

```ts
export interface EventoAsignacionOperador {
    tipo: "ASIGNACION_OPERADOR";
    id: string;
    fecha: string;
    accion: "OPERADOR_ASIGNADO" | "OPERADOR_REASIGNADO" | "OPERADOR_DESASIGNADO";
    operadorEmail: string | null;
    actorEmail: string | null;
}
```

## Consultas clave

- Bandeja: join `Reporte.operador` para obtener email.
- Timeline: `AuditLog` where `tipoRecurso='Reporte'`, `recursoId=<id>`, `accion IN (...)`.
