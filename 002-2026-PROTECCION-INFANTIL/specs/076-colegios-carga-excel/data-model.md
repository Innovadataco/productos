# Data Model: Colegios · Fase 3 — Carga masiva por Excel/CSV

## Entidades transitorias (no persistidas en BD)

La carga masiva se valida en memoria y se confirma en una transacción. Las filas válidas se transportan entre validación y confirmación mediante un token JWT firmado de corta duración.

No se requieren cambios en el modelo Prisma salvo:
- Posible adición de un `ParametroSistema` `colegio.carga.max_filas` (aditivo, no requiere migración).
- Posible adición de acciones `COLEGIO_CARGA_MASIVA` en el enum `AccionAudit` (aditivo, requiere migración si el enum es nativo de Prisma/PostgreSQL).

## Estructura de filas validadas

```typescript
type FilaCargaAlumno = {
  fila: number;
  curso: { nombre: string; grado: string | null; anioLectivo: string | null };
  alumno: { nombre: string };
  identificador: {
    tipo: string;
    valor: string;
    etiquetaRelacion: EtiquetaRelacionAlumno;
    plataformaId: string | null;
  };
};
```

## Notas

- No se persiste el archivo subido.
- No se crea tabla de carga masiva.
- El token JWT de confirmación tiene duración de 15 minutos.
- En caso de confirmación fallida por duplicados concurrentes, se revierte toda la transacción.
