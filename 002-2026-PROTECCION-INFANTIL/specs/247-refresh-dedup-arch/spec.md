# Feature Specification: Refresh silencioso + dedup reglas notif + deprecar campos legacy + regenerar arch

**Feature Branch**: `work/002-PI-mega-cobros` (SPEC-247 dentro del mega-lote 2)  
**SPEC**: 247  
**Created**: 2026-08-25  
**Status**: PLANEADO  
**Input**: INSTRUCTIVO-002-PI-150 · BRIEF-ACTIVACION-Y-COBROS §5/§6.1/§8/§10/§11 Lote 2 #8 · D-51/D-69/D-72/D-74

Impacto en arquitectura: agrega `BannerBienvenida` y polling ligero en `EsperandoAutorizacion` para refrescar sesión sin logout tras autorización; agrega `@@unique([evento, canal, plantillaClave])` en `NotificacionRegla` y dedup idempotente en `prisma/seed.ts`; marca `Usuario.inicioServicio` y `Usuario.finServicio` como `/// @deprecated` (sin borrar); regenera `docs/architecture/` para reflejar el estado consolidado del brief. Régimen D-51 autónomo: limpieza pura de bajo riesgo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cliente ve activación sin re-loguear (Priority: P1)

Un padre en `EsperandoAutorizacion` ve que su suscripción fue autorizada. La página detecta la transición y refresca la sesión silenciosamente, mostrando un `BannerBienvenida` de bienvenida y redirigiendo al dashboard activo.

**Why this priority**: Experiencia SaaS moderna; evita logout forzado y confusión.

**Independent Test**: Simular transición `PENDIENTE_AUTORIZACION → ACTIVA`; `router.refresh()` se dispara y aparece `BannerBienvenida`.

**Acceptance Scenarios**:

1. **Given** un padre en `EsperandoAutorizacion`, **When** la suscripción pasa a `ACTIVA`, **Then** se dispara `router.refresh()` y se renderiza `BannerBienvenida`.
2. **Given** un padre que cierra el banner, **Then** el banner desaparece.
3. **Given** un padre aún pendiente, **Then** no aparece el banner.

### User Story 2 — Seed sin duplicados de reglas notif (Priority: P1)

El `prisma/seed.ts` debe dejar `notificacion_reglas` sin duplicados por `(evento, canal, plantillaClave)` después de múltiples ejecuciones.

**Why this priority**: Deuda I-108; evita notificaciones múltiples y ruido.

**Independent Test**: Ejecutar seed dos veces; verificar que `SELECT ... GROUP BY ... HAVING COUNT(*) > 1` retorne 0 filas.

**Acceptance Scenarios**:

1. **Given** un schema sin `@@unique` en `NotificacionRegla`, **When** se aplica la migración aditiva, **Then** existe la constraint única compuesta.
2. **Given** duplicados históricos, **When** corre el seed, **Then** se limpian manteniendo el más reciente y se sembran con `upsert`.
3. **Given** seed ejecutado N veces, **Then** no crea duplicados.

### User Story 3 — Campos legacy marcados como deprecated (Priority: P2)

Los campos `Usuario.inicioServicio` y `Usuario.finServicio` se marcan en `schema.prisma` como deprecated, documentando que la fuente de verdad es `Suscripcion.fechaInicio/fechaFin`.

**Why this priority**: Limpieza documental sin romper datos ni consumidores existentes.

**Independent Test**: El schema contiene los comentarios `/// @deprecated` sobre ambos campos.

**Acceptance Scenarios**:

1. **Given** el modelo `Usuario`, **When** se lee `schema.prisma`, **Then** `inicioServicio` y `finServicio` tienen comentario `/// @deprecated · usar Suscripcion.fechaInicio/fechaFin`.
2. **Given** una búsqueda en `src/`, **Then** ningún consumidor NUEVO del brief usa estos campos.

---

## Edge Cases

- **Polling**: intervalo razonable (ej. 10s) y se limpia al desmontar; no saturar servidor.
- **Session refresh**: `router.refresh()` revalida server-side; el middleware de vigencia (SPEC-242) desbloquea rutas.
- **Duplicados con timestamps iguales**: en limpieza previa, mantener el de `id` más alto o un criterio determinista.
- **Migración única**: agregar `@@unique` puede fallar si existen duplicados; limpiar en el mismo migration script antes del constraint.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear `BannerBienvenida` (D-72, color `pino`).
- **FR-002**: El sistema DEBE agregar polling/detector en `EsperandoAutorizacion` para disparar `router.refresh()` cuando la suscripción pase a `ACTIVA`.
- **FR-003**: El sistema DEBE agregar `@@unique([evento, canal, plantillaClave])` a `NotificacionRegla` mediante migración aditiva.
- **FR-004**: El sistema DEBE dedup `notificacion_reglas` en `prisma/seed.ts` (limpiar duplicados + `upsert`).
- **FR-005**: El sistema DEBE marcar `Usuario.inicioServicio` y `Usuario.finServicio` con `/// @deprecated · usar Suscripcion.fechaInicio/fechaFin`.
- **FR-006**: El sistema DEBE regenerar `docs/architecture/` y commitear el delta.
- **FR-007**: El sistema DEBE garantizar `arch:check` verde al final.

### Key Entities

- `EsperandoAutorizacion`: componente de SPEC-244.
- `NotificacionRegla`: constraint única y seed idempotente.
- `Usuario`: comentarios deprecated.
- `docs/architecture/`: regeneración final.

---

## Success Criteria *(mandatory)*

- **SC-001**: `EsperandoAutorizacion` detecta transición a `ACTIVA` y dispara `router.refresh()` + `BannerBienvenida`.
- **SC-002**: Seed ejecutado dos veces deja `notificacion_reglas` con 0 duplicados.
- **SC-003**: `@@unique` impide inserciones duplicadas manuales.
- **SC-004**: Campos legacy tienen comentarios `@deprecated` y ningún consumidor nuevo los usa.
- **SC-005**: `docs/architecture/` regenerado y `arch:check` verde.
- **SC-006**: CI verde 11/11.

---

## Assumptions

- SPEC-244 ya creó `EsperandoAutorizacion`.
- SPEC-245 ya emite `suscripcion.activada`.
- Los duplicados históricos pueden limpiarse manteniendo la regla más reciente.
- No se migran datos de `Usuario.inicioServicio/finServicio` a `Suscripcion`.
