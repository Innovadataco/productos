# Research & Decisiones de diseño — SPEC-193

**Date**: 2026-08-21  
**Feature**: [spec.md](spec.md)

---

## 1. ¿Por qué una tabla única `WorkerLog`?

Se optó por una sola tabla genérica en lugar de una tabla por servicio o por nivel.

- **Simplicidad operativa**: un solo endpoint, un solo índice de búsqueda, una sola UI.
- **Escalabilidad inicial**: el volumen esperado (cuatro workers, eventos puntuales) no justifica particionar por servicio.
- **Consistencia con patrones existentes**: `AuditLog` y `TransicionReporte` ya son tablas append-only de eventos; `WorkerLog` sigue el mismo patrón.
- **Costo de cambio bajo**: si en el futuro un servicio genera mucho más volumen, se puede agregar particionamiento por `creadoEn` o archivado sin cambiar el contrato del endpoint.

Riesgo mitigado: se limita `mensaje` a 500 caracteres y se usa `contextoJson` opcional para evitar filas gigantes.

---

## 2. ¿Por qué el sink a base de datos es opcional?

El helper `workerLogger` siempre escribe a `stdout`, pero persiste en PostgreSQL solo cuando `monitoreo.logs.enabled=true` y el nivel es suficiente.

- **No perder trazas nunca**: `stdout` es la fuente primaria y no depende de la base de datos.
- **Control de costo/ruido**: en desarrollo o en entornos con mucho tráfico se puede deshabilitar el sink a BD.
- **Resiliencia**: si PostgreSQL está lento o caída, el worker continúa operando. El fallo se loguea en `stdout` y no se propaga.
- **Alineación con el BRIEF**: el requisito explícito es "escribe siempre a stdout y a BD solo si...".

Patrón existente: el proyecto ya usa `fail-open` en `src/lib/rate-limit.ts`; el logger aplica la misma filosofía.

---

## 3. ¿Por qué no hay purga automática?

El BRIEF establece que la purga automática fue descartada por decisión del CEO.

- **Trazabilidad humana**: toda eliminación requiere un motivo y genera `AuditLog`.
- **Evitar pérdida accidental**: una política automática mal configurada podría borrar evidencia de incidentes.
- **Flexibilidad operativa**: el admin decide cuándo limpiar según volumen real y políticas internas.

La UI deja el diseño extensible: en el futuro se puede agregar una acción de mantenimiento adicional (por ejemplo, "Archivar logs antiguos") sin rediseñar la sección.

---

## 4. ¿Por qué `WARN` como nivel mínimo por defecto?

- **Balance señal/ruido**: en producción, `INFO` de cuatro workers puede generar miles de filas diarias; `WARN` reduce el volumen a eventos relevantes.
- **Diagnóstico suficiente**: la mayoría de los incidentes operativos se manifiestan como advertencias o errores.
- **Bajo riesgo**: si un admin necesita más detalle, puede cambiar a `INFO` o `DEBUG` desde configuración sin deploy.

---

## 5. ¿Por qué reutilizar un modal para reasignar?

El BRIEF indica que el botón "Reasignar" de SPEC-189 es dead-end (I-73). Se diseña `ReasignarModal` como componente reusable.

- **Dos puntos de entrada**: ficha del operador (`/dashboard/admin/operadores/[id]`) y listado de casos.
- **Consistencia de UX**: mismo formulario, mismas validaciones, mismo flujo de confirmación.
- **Menor mantenimiento**: un solo componente a testear y evolucionar.

Patrón existente: el proyecto ya reutiliza modales para confirmaciones (por ejemplo, baja de reportes en SPEC-012).

---

## 6. Decisiones de validación

### Reasignación

Se restringe a reportes en `REVISION_MANUAL` o `PROCESADO` **con operador asignado**.

- Evita reasignar casos que aún no han sido asignados (`PENDIENTE`).
- Mantiene la integridad del modelo: si no hay `operadorId`, no hay "de dónde" mover.
- El estado no cambia: solo se actualiza `operadorId`.

### Purga

- `hasta` máximo "ayer": evita borrar logs del día en curso que podrían estar siendo consultados.
- Motivo obligatorio 20-500 caracteres: fuerza documentación suficiente para auditoría.
- Conteo previo: reduce errores humanos al mostrar cuántas filas se borrarán antes de confirmar.

---

## 7. Riesgos identificados

| Riesgo | Mitigación |
|--------|------------|
| `WorkerLog` crece sin control | Límite de 500 chars en mensaje; purga manual; índices por `creadoEn`; posible particionamiento futuro. |
| Escritura a BD ralentiza workers | Sink opcional; escritura asíncrona con `catch` silencioso; siempre hay `stdout` como respaldo. |
| Exposición de PII en logs | Validación de mensajes sin datos personales; contexto estructurado; acceso solo `ADMIN`. |
| Reasignación concurrente | Verificación del `operadorId` actual antes del `UPDATE`; respuesta `409` si cambió. |
| Confusión con `TransicionReporte` vs `ReporteTimeline` | El BRIEF usa el nombre `ReporteTimeline`; el esquema actual es `TransicionReporte`. La implementación usará `TransicionReporte` sin crear una nueva tabla. |

---

## 8. Referencias a patrones existentes

- **Logging**: formato `[Módulo] Acción: resultado — detalle` ya usado en el resto de la aplicación.
- **Rate-limiting**: scopes `admin_read` y `admin_write` ya existen en `src/lib/rate-limit.ts`.
- **Configuración parametrizada**: `ParametroSistema` + `prisma/seed.ts` (sección `monitoreoNuevos`) usados en SPEC-020 y SPEC-171.
- **Auditoría**: `AuditLog` con `accion`, `metadatos`, `usuarioId`, `ipAddress`, `userAgent` ya es patrón estándar.
- **Timeline de reportes**: `TransicionReporte` se usa en SPEC-022 para trazabilidad de cambios de estado.
- **Errores**: `AppError` con códigos canónicos (`src/lib/errors.ts`) se aplicará en los tres endpoints nuevos.
- **Paginación**: patrón `{ items, total }` para listados administrativos (igual que otros endpoints admin del proyecto).
