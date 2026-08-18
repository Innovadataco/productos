# Data Model: SPEC-173 — Restructura nav por rol + fixes H01-H06

**Sin cambios de schema Prisma. Cero migraciones.** (Candado del instructivo: solo Zod, UI y DTO.)

## Cambios de validación (Zod, `src/lib/schemas/index.ts`)

| Schema | Antes | Después |
|--------|-------|---------|
| `alertaBatchSchema.accion` | `["vista","gestionada","escalada","cerrada","asignar","desasignar"]` | `["vista"]` (batch final del rector = solo "Revisar en lote"; `escalada` prohibida → 400) |
| `cursoMateriaBodySchema.materiaId` | `cuidIdSchema` | `z.union([cuidIdSchema, z.string().uuid()])` |
| `cursoMateriaIdParamsSchema.materiaId` | `cuidIdSchema` | `z.union([cuidIdSchema, z.string().uuid()])` |

`profesorId` sin cambios (CUID).

## Cambios de DTO (sin BD)

`EstadisticasInteligenciaColegio` (`src/lib/colegio/inteligencia.ts`):

```ts
alertasPorTipoSujeto: { ESTUDIANTE: number; PROFESOR: number; ACUDIENTE: number }
```

Fuente: `AlertaColegioRepository.contarPorTipoSujeto(colegioId)` — `prisma.alertaColegio.groupBy({ by: ["tipoSujeto"], where: { colegioId, estado: { in: ESTADOS_VISIBLES } }, _count: true })`.

## Payloads API nuevos/extendidos

- `GET /api/colegio/comite/estadisticas` (NUEVO): `{ casosPorEstado: Record<EstadoSolicitud, number>, tiempoMedioResolucionDias: number | null, topCategorias: Array<{ categoria: string, total: number }> }` — solo agregados del colegio autenticado.
- `GET /api/colegio/onboarding` (extendido): cuando `estado === "completado"`, añade `resumen: { estudiantes: number, cursos: number, profesores: number }` (counts tenant-first).
- `POST /api/colegio/alertas/[id]/escalar`: sin cambios de contrato — la UI por fin envía el `motivo` que `escalarAlertaSchema` ya exige.

## Entidades leídas (no modificadas)

`AlertaColegio` (estado, tipoSujeto), `SolicitudComite` (estado, categoria, fechas, SLA), `SeguimientoCaso` (bitácora del resolver), `Materia` (ids mixtos UUID/CUID — ver Assumptions de spec.md), `Plataforma` (catálogo activo).
