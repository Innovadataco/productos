# Plan SPEC-265 — Scripts reutilizables de limpieza

## Estructura de archivos a crear

```
scripts/limpieza/
  borrar-colegio.ts
  borrar-padre.ts
  borrar-reporte.ts
  borrar-simulacion.ts
  reset-piloto.ts
  README.md
specs/265-scripts-limpieza/
  spec.md  ← este documento
  plan.md  ← plan de implementación
  tasks.md ← CI guard
specs/README.md  ← añadir entrada SPEC-265
```

---

## Tarea 1 — `scripts/limpieza/borrar-reporte.ts` (base, sin dependencias entre scripts)

Más simple → implementar primero para validar el patrón.

```
node --env-file=.env --import tsx scripts/limpieza/borrar-reporte.ts --id=<id> [--confirm]
```

**Lógica:**
1. Parsear `--id` (requerido) y `--confirm` (opcional → dry-run si ausente)
2. Dry-run: imprimir conteos de filas a borrar (SolicitudComite, CorreccionAdmin, EventoMatch, IdentificadorReportado orphan, Reporte)
3. Con `--confirm`: `prisma.$transaction()` con orden FK-safe (spec.md §borrar-reporte)
4. `prisma.auditLog.create({ accion: "LOGS_MANTENIMIENTO_PURGA", metadatos: { tipo: "REPORTE_PURGADO", reporteId, filas: N } })`
5. Console.log resumen con conteos reales

---

## Tarea 2 — `scripts/limpieza/borrar-simulacion.ts`

```
node --env-file=.env --import tsx scripts/limpieza/borrar-simulacion.ts --id=<id> [--confirm]
```

**Lógica:**
1. Parsear `--id` y `--confirm`
2. Recopilar `reporteIds` de `simulacion_reportes`
3. Dry-run: contar SimulacionRun, SimulacionReporte, Reporte derivados
4. Con `--confirm`: `prisma.$transaction()` → `SimulacionRun.delete()` (cascade SimulacionReporte) → `Reporte.deleteMany({ where: { id: { in: reporteIds } } })`
5. AuditLog `LOGS_MANTENIMIENTO_PURGA` / `metadatos.tipo: "SIMULACION_PURGADA"`

---

## Tarea 3 — `scripts/limpieza/borrar-padre.ts`

```
node --env-file=.env --import tsx scripts/limpieza/borrar-padre.ts --email=<email> [--confirm]
```

**Lógica:**
1. Parsear `--email` y `--confirm`
2. Verificar que el usuario existe y es PARENT (error si es otro rol)
3. Guard: NO borrar `soporte@innovadataco.com`
4. Dry-run: contar ContactoConfianza, Reporte, CodigoVerificacion, TokenRecuperacion, Suscripcion, Usuario
5. Con `--confirm`: `prisma.$transaction()` con orden FK-safe (spec.md §borrar-padre)
6. AuditLog `LOGS_MANTENIMIENTO_PURGA` / `metadatos.tipo: "PADRE_PURGADO"`

---

## Tarea 4 — `scripts/limpieza/borrar-colegio.ts` (más complejo)

```
node --env-file=.env --import tsx scripts/limpieza/borrar-colegio.ts --id=<colegioId> [--confirm]
```

**Lógica:**
1. Parsear `--id` y `--confirm`
2. Cargar colegio + tenantId + adminId + comiteColegioId
3. Dry-run: contar todas las entidades vinculadas (reportes, estudiantes, cursos, suscripciones, usuarios)
4. Con `--confirm`: `prisma.$transaction()` con orden FK-safe completo (spec.md §borrar-colegio)
5. NO borrar Reporte de padres externos (usuarios cuyo `tenantId != colegio.tenantId`)
6. AuditLog `LOGS_MANTENIMIENTO_PURGA` / `metadatos.tipo: "COLEGIO_PURGADO"`

---

## Tarea 5 — `scripts/limpieza/reset-piloto.ts` (orquestador)

```
node --env-file=.env --import tsx scripts/limpieza/reset-piloto.ts --confirm --backup=<ruta.sql>
```

**Lógica:**
1. Parsear `--confirm` y `--backup=<ruta>` (error inmediato si falta cualquiera de los dos)
2. Ejecutar `pg_dump` con `child_process.execSync` al archivo de backup
3. Listar colegios activos → llamar función interna `borrarColegio(id)` para cada uno
4. Listar usuarios PARENT excepto `soporte@innovadataco.com` → llamar `borrarPadre(email)`
5. Listar reportes huérfanos (sin colegioId ni usuarioId en tenant activo) excepto `RPT-1RR278`, `RPT-2JFULR`, `RPT-FA1C23` → llamar `borrarReporte(id)`
6. Listar SimulacionRun → llamar `borrarSimulacion(id)`
7. AuditLog `LOGS_MANTENIMIENTO_PURGA` / `metadatos.tipo: "RESET_PILOTO_EJECUTADO"` con resumen total

*Implementación*: cada script exporta su función core (además de `main()`); `reset-piloto.ts` importa esas funciones.

---

## Tarea 6 — `scripts/limpieza/README.md`

Documenta:
- Los 5 scripts con su firma completa
- Comportamiento `--confirm` obligatorio / dry-run por defecto
- Lista de entidades preservadas
- Reportes excluidos de reset-piloto (con referencia a D-001 §5)
- Orden de deploy para el responsable

---

## Tarea 7 — CI guards

- `specs/265-scripts-limpieza/tasks.md` (CI guard)
- `specs/README.md` — añadir entrada SPEC-265

---

## Verificación pre-push

```bash
npx tsc --noEmit    # cero errores en scripts/limpieza/
npx vitest run --config vitest.unit.config.ts prisma/seed-security.test.ts
npx vitest run --config vitest.unit.config.ts src/lib/specs-discipline.test.ts
npm run arch:check
```

Dry-run de los 5 scripts en dev (sin `--confirm`): debe imprimir conteos, nunca borrar.
