# Research: SPEC-237 — Bandeja comité CONSOLIDACION + aprobación multi-miembro

**Date**: 2026-08-22
**Feature**: specs/237-bandeja-comite-consolidacion/spec.md

---

## Decisions

### D1: Enriquecer la bandeja existente, no clonarla (D-72)

**Decision**: Extender `ComiteBandeja` y su DTO para soportar dos tipos de tarea (`REVISION_REPORTE` y `CONSOLIDACION_EXPEDIENTE`) mediante filtro, badge e icono; no crear una bandeja paralela.

**Rationale**: El instructivo ZEUS explícitamente prohíbe clonar la bandeja ("NO clone bandeja (D-72 enrich)"). El comité opera sobre un mismo pool de trabajo; separarlo en dos vistas aumentaría la carga cognitiva y duplicaría lógica de paginación, filtros y permisos.

### D2: Aprobaciones almacenadas en JSON (`aprobadoPorMiembrosJson`)

**Decision**: Guardar el array de aprobaciones en `InformeConsolidado.aprobadoPorMiembrosJson` en lugar de una tabla normalizada.

**Rationale**: El umbral default es 2 y rara vez superará 5 miembros. Un campo JSON es suficiente, evita joins y mantiene la trazabilidad compacta. Si en el futuro el comité crece o se requieren queries agregadas por miembro, se evaluará normalizar.

### D3: Correcciones append-only (`correccionesJson`)

**Decision**: Cada corrección añade un snapshot con texto anterior, texto nuevo, autor, motivo y timestamp; nunca se elimina.

**Rationale**: El instructivo lo establece como requisito no negociable. Preserva la evolución del razonamiento del comité y facilita auditoría sin exponer textos originales de reportes.

### D4: Estado `CORREGIDO` (no `APROBADO`) tras corrección

**Decision**: Después de una corrección el informe queda en estado `CORREGIDO`; la transición del expediente solo ocurre cuando se alcanza el umbral de aprobaciones.

**Rationale**: Una corrección no es una aprobación. Separar ambos estados evita que un miembro corrija y, sin revisión posterior, el expediente avance. La aprobación multi-miembro sigue siendo el gate.

### D5: Evento `expediente.comite.aprobo` publicado automáticamente

**Decision**: Al alcanzar el umbral, el repositorio/servicio invoca `aplicarTransicion(expedienteId, 'EN_APROBACION_PADRE')` y publica el evento `expediente.comite.aprobo`.

**Rationale**: El motor de estados y eventos (SPEC-236) es la fuente de verdad de transiciones; esta spec lo consume. El evento permite a otros módulos (notificaciones, métricas, padre UI futura) reaccionar sin acoplarse al repositorio.

### D6: Guía de acción por defecto = categoría dominante

**Decision**: El selector de guía de acción inicia con la categoría de conducta dominante del expediente; el comité puede cambiarla.

**Rationale**: Reduce carga cognitiva y acelera la decisión. La categoría dominante ya se calcula en SPEC-234; reutilizarla no requiere IA adicional (respeta el candado de no tocar `src/lib/ai/**`).

### D7: SLA en zona `America/Bogota` con `date-fns-tz`

**Decision**: Calcular y mostrar el SLA siempre en hora de Bogotá, usando `date-fns-tz`.

**Rationale**: Los operadores/comité están en Colombia. Mostrar el SLA en UTC confundiría; mostrarlo en zona local del navegador podría variar entre usuarios. Bogotá como referencia única garantiza consistencia.

### D8: Colores `pino` / `ambar` / `rubi` para semáforo

**Decision**: Usar los tokens de semáforo existentes `VERDE=pino`, `AMARILLO=ambar`, `ROJO=rubi`.

**Rationale**: El instructivo fija el sistema visual. No se inventan nuevos nombres ni se mapean a colores hex arbitrarios.

### D9: Migraciones aditivas y `Timestamptz(6)`

**Decision**: Todos los cambios de schema son `ALTER ... ADD`; timestamps usan `Timestamptz(6)`.

**Rationale**: Candados del instructivo y de la constitución (I-49). Precisión 6 es el estándar del proyecto para campos `DateTime`.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Crear bandeja separada `/dashboard/admin/comite/consolidaciones` | Prohibido por instructivo ZEUS (D-72) |
| Tabla normalizada `AprobacionInformeConsolidado` | Overkill para umbral default 2; JSON es suficiente y más simple |
| Estado `APROBADO` tras corrección | Confunde corrección con aprobación; el instructivo exige `CORREGIDO` |
| Publicar evento manualmente desde UI | Riesgo de doble publicación; se centraliza en repositorio/servicio |
| SLA basado en zona del navegador | Inconsistente entre usuarios; Bogotá es la referencia operativa |
| Llamar a `src/lib/ai/**` para sugerir guía | Prohibido por instructivo; se usa categoría dominante existente |

---

## Candados respetados

- **NO `src/lib/ai/**`**: la guía de acción proviene de la categoría dominante existente; no se invoca clasificador ni LLM.
- **NO clonar bandeja**: se enriquece `ComiteBandeja` con filtro y variantes.
- **Migraciones aditivas**: solo se añaden campos/valores; cero `DROP`.
- **`Timestamptz(6)`**: todos los timestamps nuevos/modificados usan esta precisión.
- **DAL Q-3**: todo acceso a `InformeConsolidado` pasa por `informe-consolidado-repository`.
- **NO implementar SPEC-238**: aclaración padre-comité queda fuera.
- **NO implementar SPEC-239**: escalación ROJO queda fuera.
- **NO implementar SPEC-232**: UI padre queda fuera.

---

## Open Questions (0 remaining)

Todos los puntos del instructivo ZEUS están cubiertos. Las dependencias con SPEC-234 (modelos) y SPEC-236 (transiciones/eventos) se documentan como asumidas.
