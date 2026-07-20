# Research: Disciplina y reconciliación Spec-Kit

**Date**: 2026-07-20
**Feature**: specs/044-disciplina-spec-kit/spec.md

---

## Decisions

### D1: Snapshot histórico basado en el commit a449bbe

**Decision**: El commit `a449bbe4a04afc08cb5ef621269d84d9dfb71834` se toma como snapshot de cierre del spec 031 y línea base del saneamiento.

**Rationale**: El asunto del commit (`docs: cierre de fixes 031 UI + UX seguimiento`) indica que marca el punto donde el spec 031 y el seguimiento de UX quedaron documentados. Usarlo como referencia permite rastrear el estado del repo en el momento de iniciar el saneamiento.

**Datos del commit**:
- Hash: `a449bbe4a04afc08cb5ef621269d84d9dfb71834`
- Fecha: 2026-07-19 00:35:09 -0500
- Autor: Jelkin Zair Carrillo Franco `<jelkin.carrillo@innovadataco.com>`
- Asunto: `docs: cierre de fixes 031 UI + UX seguimiento`

### D2: No retrofitar specs cerrados

**Decision**: Los specs 022-031 que están cerrados no se retrofitan con `tasks.md` ni `checklists/requirements.md`.

**Rationale**: Reabrir specs cerrados solo para alinear el formato crearía ruido en el historial y no aporta valor funcional. La deuda se documenta en el spec 044 para futuras auditorías.

### D3: Valores canónicos de Status

**Decision**: El conjunto canónico de valores para el campo `Status` de un spec es: `PLANEADO`, `DESARROLLO`, `IMPLEMENTADO`, `PENDIENTE DE PRUEBA`, `FINALIZADO`, `CERRADA`.

**Rationale**: Unifica la nomenclatura actual (`EN DISEÑO`, `EN DESARROLLO`, `EN PLANIFICACIÓN`, `PLANEADO`, `CERRADA`, `IMPLEMENTADO`) en valores semánticamente claros y ordenados.

### D4: Convención de cierre en AGENTS.md

**Decision**: La convención de cierre y los pasos del flujo Spec-Kit se registran en `AGENTS.md`.

**Rationale**: `AGENTS.md` es el documento transversal que todo agente debe leer. Incluir la convención allí garantiza visibilidad y cumplimiento.

### D5: Sin cambios de código fuente

**Decision**: El spec 044 no modifica archivos de la aplicación (`src/`, `prisma/`, `public/`, etc.).

**Rationale**: El saneamiento es documental. Cualquier cambio de código requiere un spec funcional aparte.

---

## Audit Findings

### Tabla de estado real de los specs 022-043

| Spec | Status actual | Status corregido | cierre.md | tasks.md | requirements.md | Notas |
|------|---------------|------------------|-----------|----------|-----------------|-------|
| 022-expediente-transiciones | EN DISEÑO | CERRADA | ✅ (specs/022/cierre.md) | ❌ | ❌ | Formato clásico; se normaliza a `CERRADA`. |
| 023-estados-usuario-sla | EN DISEÑO | CERRADA | ✅ | ❌ | ❌ | Formato clásico; se normaliza a `CERRADA`. |
| 024-comite-validacion | CERRADA | CERRADA | ✅ | ❌ | ❌ | Ya estaba correcto. |
| 025-anonimizacion-reforzada | EN DISEÑO | CERRADA | ✅ | ❌ | ❌ | Formato clásico; se normaliza a `CERRADA`. |
| 026-pipeline-spam-prioridad | EN DISEÑO | CERRADA | ✅ | ❌ | ❌ | Formato clásico; se normaliza a `CERRADA`. |
| 027-motor-encolamiento | EN DISEÑO | CERRADA | ✅ | ❌ | ❌ | Formato clásico; se normaliza a `CERRADA`. |
| 028-redisenio-home | CERRADA | CERRADA | ✅ | ❌ | ❌ | Ya estaba correcto. |
| 029-redisenio-consulta-panel-usuario | EN DISEÑO | CERRADA | ✅ | ❌ | ❌ | Tenía `cierre.md` con `CERRADA`; encabezado desincronizado. |
| 030-circulo-confianza-multiples-identificadores | (no declarado) | CERRADA | ✅ | ❌ | ❌ | Sin línea de estado; se agrega `Status: CERRADA`. |
| 031-mejoras-ui-agrupacion-categorias | (no declarado) | CERRADA | ✅ | ❌ | ❌ | Sin línea de estado; se agrega `Status: CERRADA`. |
| 033-correcciones-vistas-roles | EN DESARROLLO | CERRADA | ✅ (docs/cierre-033.md) | ✅ | ✅ | Cierre en `docs/` (aceptado históricamente). |
| 034-config-guardado-mapa-comite | EN DESARROLLO | CERRADA | ✅ (docs/cierre-034.md) | ✅ | ✅ | Cierre en `docs/` (aceptado históricamente). |
| 035-correcciones-034-blindaje-critico | EN PLANIFICACIÓN | CERRADA | ✅ (docs/cierre-035.md) | ✅ | ✅ | Valor no canónico; normalizado a `CERRADA`. |
| 036-consistencia-limpieza | EN PLANIFICACIÓN | CERRADA | ✅ (docs/cierre-036.md) | ✅ | ✅ | Valor no canónico; normalizado a `CERRADA`. |
| 037-seguridad-limpieza | CERRADA | CERRADA | ✅ (docs/cierre-037.md) | ✅ | ✅ | Cierre en `docs/` (aceptado históricamente). |
| 038-auditoria-operadores-comite | EN DESARROLLO | CERRADA | ✅ (docs/cierre-038.md) | ✅ | ✅ | Cierre en `docs/` (aceptado históricamente). |
| 039-middleware-perimetral-real | IMPLEMENTADO | CERRADA | ✅ (docs/cierre-039.md) | ✅ | ✅ | Cierre en `docs/` (aceptado históricamente). |
| 040-aislamiento-comite-bandeja | IMPLEMENTADO | CERRADA | ✅ (docs/cierre-040.md) | ✅ | ✅ | Cierre en `docs/` (aceptado históricamente). |
| 041-cierre-blindaje-saneamiento | IMPLEMENTADO | CERRADA | ✅ (docs/cierre-041.md) | ✅ | ✅ | Cierre en `docs/` (aceptado históricamente). |
| 042-operador-corrije-clasificacion | PLANEADO (espera aprobación) | CERRADA | ✅ (docs/cierre-042.md) | ✅ | ✅ | Estado con nota; normalizado a `CERRADA`. |
| 043-ux-comite-nav-padre | IMPLEMENTADO | CERRADA | ✅ (docs/cierre-043.md) | ✅ | ✅ | Cierre en `docs/` (aceptado históricamente). |

*Nota: el spec 032 no existe en el repositorio.*

*Nota: el spec 032 no existe en el repositorio.*

---

## Debt Documented

### Deuda en specs 022-031 (faltan `tasks.md` y `checklists/requirements.md`)

| Spec | Estado | Deuda | Acción |
|------|--------|-------|--------|
| 022-expediente-transiciones | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 023-estados-usuario-sla | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 024-comite-validacion | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 025-anonimizacion-reforzada | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 026-pipeline-spam-prioridad | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 027-motor-encolamiento | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 028-redisenio-home | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 029-redisenio-consulta-panel-usuario | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 030-circulo-confianza-multiples-identificadores | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |
| 031-mejoras-ui-agrupacion-categorias | CERRADA | Sin `tasks.md` ni `requirements.md` | No se retrofita por estar cerrado; deuda documentada. |

### Deuda de ubicación de `cierre.md` en specs 033-043

| Spec | Estado | Deuda | Acción |
|------|--------|-------|--------|
| 033-043 | CERRADA | `cierre.md` ubicado en `docs/cierre-NNN.md` en lugar de `specs/NNN/cierre.md` | Se acepta como histórico; la convención fijada recomienda `specs/NNN/cierre.md` para specs futuros. |

---

---

## Convention to Fix

### Valores canónicos de `Status`

Todo spec DEBE usar uno de los siguientes valores en su encabezado:

1. `PLANEADO` — especificación aprobada, aún no en desarrollo.
2. `DESARROLLO` — en implementación activa.
3. `IMPLEMENTADO` — código implementado, pendiente de pruebas formales.
4. `PENDIENTE DE PRUEBA` — en ejecución de pruebas.
5. `FINALIZADO` — pruebas aprobadas, listo para cierre administrativo.
6. `CERRADA` — cierre documentado, sin trabajo pendiente.

### Convención de cierre única

Antes de cambiar el `Status` de un spec a `CERRADA`, el spec DEBE cumplir:

- Todos los artefactos obligatorios del Spec-Kit: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, `checklists/requirements.md`.
- `cierre.md` con evidencia de cierre (git log, archivos tocados, resultados de pruebas/deploy).
- Sección `Implementación` completada en `spec.md`.
- Un commit por User Story y uno de documentación, con evidencia.
- Deploy limpio con `./scripts/dev-restart.sh` (cuando aplique cambios de código).
- Validación con el `quickstart.md` (cuando aplique cambios funcionales).

### Flujo Spec-Kit formalizado

El flujo completo de trabajo de un spec es:

`specify → clarify → analyze → plan → tasks → implement → validate → close`

- **clarify**: resolver dudas, ajustar alcance y aceptar cambios menores antes de planificar.
- **analyze**: evaluar alternativas técnicas, riesgos y cumplimiento de la constitución antes de escribir tareas.

### Aplicación al saneamiento

- Los specs 022-031 se ajustan únicamente en el encabezado; no se les agrega `tasks.md` ni `requirements.md`.
- Los specs 033-043 se mantienen con sus artefactos actuales; se espera que cada uno cierre con `cierre.md` al finalizar.
- El spec 044 documenta el saneamiento y, al cerrar, debe cumplir la misma convención de cierre.

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. El snapshot y la convención quedan determinados por el programa de saneamiento.
