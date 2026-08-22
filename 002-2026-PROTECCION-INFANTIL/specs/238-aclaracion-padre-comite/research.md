# Research & Decisions: SPEC-238 — Aclaración padre-comité

## Decisiones tomadas

### D-1. Máximo una aclaración por expediente (`@@unique([expedienteId])`)

**Contexto**: El brief §7.4 exige "1 iteración máx". Eso implica que un padre no puede pedir una segunda aclaración si ya existe una para el expediente.

**Opciones consideradas**:
1. Validación en aplicación antes de insertar.
2. Restricción única en BD (`@@unique([expedienteId])`).
3. Campo de contador de iteraciones.

**Decisión**: Opción 2. La restricción a nivel de base de datos elimina condiciones de carrera sin necesidad de locks adicionales y simplifica los tests de concurrencia. La aplicación convierte `P2002` en `409 Conflict`.

---

### D-2. Campo `estado` como `String` en lugar de enum Prisma

**Contexto**: El brief §7.4 define `estado String (PENDIENTE|RESPONDIDA|CERRADA_FORZOSAMENTE)`.

**Opciones consideradas**:
1. Crear un enum Prisma `EstadoAclaracionExpediente`.
2. Usar `String` y validar valores en Zod/servicio.

**Decisión**: Opción 2. Respeta literalmente el modelo del brief y evita modificar el enum si en el futuro se agregan estados transitorios. La validación de valores queda centralizada en `estadoAclaracionExpedienteSchema`.

---

### D-3. Extender el worker `pi-expediente-motor` (sin crear uno nuevo)

**Contexto**: El instructivo ZEUS (D-72) prohíbe crear un worker nuevo; el SLA de aclaraciones debe correr en el worker de expedientes.

**Opciones consideradas**:
1. Worker independiente `pi-aclaracion-sla.mjs`.
2. Cronjob externo.
3. Añadir un tick adicional al worker existente.

**Decisión**: Opción 3. El worker ya vigila estados y eventos del expediente; añadir una consulta por aclaraciones `PENDIENTE` no aumenta la complejidad operativa ni el número de procesos.

---

### D-4. Publicar eventos vía pg-boss

**Contexto**: SPEC-236 define el bus de eventos del expediente y ya siembra `expediente.aclaracion.solicitada` y `expediente.aclaracion.respondida`.

**Opciones consideradas**:
1. Llamadas directas a handlers dentro de la transacción.
2. Publicación best-effort vía pg-boss.

**Decisión**: Opción 2. Mantiene desacoplamiento y consistencia con el patrón de eventos del proyecto. La publicación es best-effort: si falla, se loguea pero no se revierte la transacción principal.

---

### D-5. Cierre forzoso idempotente

**Contexto**: Tanto el padre como el worker pueden intentar cerrar el mismo expediente.

**Opciones consideradas**:
1. Devolver `409` si ya está cerrado.
2. Devolver `200` sin cambios si ya está cerrado.

**Decisión**: Opción 2. Simplifica la lógica del worker y evita errores transitorios por reintentos o carreras.

---

### D-6. SLA calculado en hora Bogotá

**Contexto**: El SLA se define en horas (`padre.comite.sla_horas_normal`) y los usuarios operan en Colombia.

**Opciones consideradas**:
1. Usar `Date.now()` UTC directamente.
2. Convertir `solicitadaEn` y "ahora" a `America/Bogota` antes de comparar.

**Decisión**: Opción 2. Aunque PostgreSQL `Timestamptz` almacena UTC, la comparación se hace en zona Bogotá para evitar sorpresas por cambios de horario o percepción del usuario. `solicitadaEn` ya está en UTC; se suman horas y se compara con `nowBogota()`.

---

### D-7. No exponer textos en payloads por defecto

**Contexto**: `solicitudTexto` y `respuestaTexto` son datos sensibles (contienen la duda del padre y la respuesta del comité).

**Opciones consideradas**:
1. Incluir el texto completo en la respuesta 201/200.
2. Devolver solo metadatos; exponer el texto solo a actores autorizados en endpoints específicos.

**Decisión**: Opción 2. Reduce la superficie de exposición. La UI del comité puede leer el texto con el mismo permiso que necesita para responder.

---

## Candados respetados

| Candado | Cumplimiento |
|---------|--------------|
| No modificar `src/lib/ai/**` | ✅ La aclaración es texto; no usa IA |
| No crear worker nuevo | ✅ Se extiende `pi-expediente-motor` |
| Migraciones aditivas | ✅ Solo se añade `AclaracionExpediente` y valores `AccionAudit` |
| `Timestamptz(6)` | ✅ Todos los campos de fecha del modelo |
| DAL Q-3 | ✅ Todo acceso a BD pasa por `AclaracionRepository` |
| No implementar UI padre | ✅ UI padre queda en SPEC-232 |

---

## Dependencias externas

- **SPEC-236**: entrega `Expediente`, `InformeConsolidado`, `aplicarTransicion`, worker `pi-expediente-motor`, eventos y parámetro `padre.comite.sla_horas_normal`.
- **SPEC-237**: entrega permisos de comité, bandeja de consolidación y acceso por tenant/colegio.
- **SPEC-232**: implementará la UI del padre que consumirá estos endpoints.

---

## Notas de investigación

- El patrón `DbClient` + `withUnitOfWork` permite inyectar el cliente transaccional en el repositorio, lo cual es esencial para mantener la atomicidad entre la creación/actualización de la aclaración y la transición del expediente.
- `AccionAudit` ya tiene valores específicos por feature; añadir `ACLARACION_*` mantiene la trazabilidad operativa sin romper compatibilidad.
- La publicación de eventos `expediente.aclaracion.*` debe registrarse en `src/lib/queue.ts` siguiendo el patrón `send*` usado por otras features (SPEC-139, SPEC-149, SPEC-184).
