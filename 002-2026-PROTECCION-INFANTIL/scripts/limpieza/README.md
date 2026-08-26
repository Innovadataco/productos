# scripts/limpieza/ — SPEC-265 (002-PI-168)

Scripts reutilizables para borrar data de prueba de bases vivas. Sustituyen los
SQL inline que ZEUS ejecutaba a mano.

## Regla de oro

**Sin `--confirm` = dry-run.** Todos los scripts imprimen los conteos que
borrarían y salen sin tocar la base. Con `--confirm` ejecutan la purga
transaccional.

**`--motivo="..."` es obligatorio** en los 5 scripts (mínimo 20 caracteres,
patrón D-56). Se guarda en `AuditLog.metadatos.motivo`.

## Scripts

| Script | Firma | Uso |
|--------|-------|-----|
| `borrar-reporte.ts` | `--id=<reporteId> --motivo=<texto> [--confirm]` | Borra un reporte + derivados |
| `borrar-simulacion.ts` | `--id=<simulacionId> --motivo=<texto> [--confirm]` | Borra una SimulacionRun + reportes derivados |
| `borrar-padre.ts` | `--email=<email> --motivo=<texto> [--confirm]` | Borra un usuario PARENT + reportes + contactos + suscripciones |
| `borrar-colegio.ts` | `--id=<colegioId> --motivo=<texto> [--confirm]` | Borra un colegio, su tenant y todos sus derivados |
| `reset-piloto.ts` | `--motivo=<texto> --confirm --backup=<ruta.sql>` | Orquesta los 4 anteriores. `--backup` obligatorio |

### Ejemplo (dry-run)
```
node --env-file=.env --import tsx scripts/limpieza/borrar-colegio.ts \
  --id=colegio_abc123 \
  --motivo="baja voluntaria colegio X — solicitud 2026-08-26"
```

### Ejemplo (real)
```
node --env-file=.env --import tsx scripts/limpieza/borrar-colegio.ts \
  --id=colegio_abc123 \
  --motivo="baja voluntaria colegio X — solicitud 2026-08-26" \
  --confirm
```

### Ejemplo reset-piloto
```
node --env-file=.env --import tsx scripts/limpieza/reset-piloto.ts \
  --motivo="reset piloto agosto 2026 antes de demo" \
  --backup=/var/backups/pi/pre-reset-2026-08-26.sql \
  --confirm
```

## Auditoría

Cada ejecución con `--confirm` deja un `AuditLog` con:
- `accion`: `LOGS_MANTENIMIENTO_PURGA` (existente, SPEC-193)
- `tipoRecurso`: `PurgaData`
- `metadatos.tipo`: `colegio` | `padre` | `reporte` | `simulacion` | `reset_piloto`
- `metadatos.motivo`: el texto pasado en `--motivo`
- `metadatos.filasBorradas`: total
- `metadatos.idsAfectados`: lista de ids

**Búsqueda futura**:
```sql
SELECT * FROM "AuditLog"
WHERE accion = 'LOGS_MANTENIMIENTO_PURGA'
  AND metadatos->>'tipo' = 'colegio'
ORDER BY "creadoEn" DESC;
```

## Preservados (NUNCA se borran)

### Usuarios
- `soporte@innovadataco.com`

### Reportes excluidos de `reset-piloto`
Evidencia viva de I-105 / I-100 / I-113 / I-114 / I-121 (D-001 §5):
- `RPT-1RR278`
- `RPT-2JFULR`
- `RPT-FA1C23`

### Tablas de seed (nunca se tocan)
`ParametroSistema` · `Plan` · `notificacion_reglas` · `notificacion_plantillas` ·
`Pais` · `Departamento` · `Ciudad` · `Plataforma` · `ModuloPermisible` ·
`GuiaAccionCategoria` · `reglas_recomendacion` · `FuenteReporte` ·
`DatasetEntrenamiento` · `EmbeddingDataset` · `AuditLog`

## Producción

**NO** los ejecuta ODIN ni la IA. Los corre el responsable del despliegue,
siempre con `--motivo` que ata la operación a un ticket u orden de ZEUS.

`reset-piloto.ts` genera un `pg_dump` antes de tocar nada; sin backup válido
(mínimo 1 KB) aborta.

## Diseño

- Cada script exporta su función core (`borrarReporte`, `borrarPadre`, etc.)
  además del `main()`. `reset-piloto.ts` importa las funciones core en vez
  de hacer shell-out a los otros scripts.
- Transacción por unidad borrada. Si algo falla → rollback automático.
- Reportes se borran uno a uno (no `deleteMany`) para reutilizar el orden
  FK-safe validado y limpiar identificadores huérfanos por reporte.
