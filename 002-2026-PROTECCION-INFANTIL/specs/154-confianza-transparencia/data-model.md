# Modelo de datos: SPEC-154 — Confianza

## Sin cambios en schema.prisma

SPEC-154 no introduce nuevas tablas ni columnas. Reutiliza:

- **`AuditLog`**: para el historial de auditoría del colegio.
  - `colegioId` (String?, FK a Colegio, indexado).
  - `creadoEn` (DateTime, indexado).
  - `accion`, `tipoRecurso`, `recursoId`, `usuarioId`, `valorAnterior`, `valorNuevo`.

## Documentos fuente

Archivos Markdown en `docs/rector/`:

- `transparencia.md`
- `protocolo.md`
- `compromiso.md`

No se almacenan en base de datos; se leen del filesystem con allowlist.

## Tipos TypeScript (propuestos)

```ts
interface DocumentoConfianza {
    clave: string;
    titulo: string;
    ruta: string;
}

interface EventoAuditoriaColegio {
    id: string;
    accion: string;
    tipoRecurso: string;
    recursoId: string | null;
    usuarioId: string | null;
    fecha: string; // ISO
    resumen: string | null;
}

interface AuditoriaColegioResultado {
    items: EventoAuditoriaColegio[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}
```
