# Spec 086 — Navegación y páginas gobernadas por permisos

**Status**: `FINALIZADO` (pendiente validación funcional del CEO + ACTA-VALIDACION de ZEUS → `CERRADA`)
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-23
**Corrige**: Spec 019 (rechazada en validación funcional del CEO)

**Input**: Jelkin quitó a OPERADOR `bandeja_reportes` y `reportes_revision`, guardó, re-ingresó: el menú seguía mostrando las opciones. El backend está bien (403 en API); los defectos son D-1 (nav con roles quemados), D-2 (sin guard de página: el 403 se ve como avería), D-3 ("Revisión de spam" rota para OPERADOR), D-4 (el catálogo no corresponde a lo visible).

## User Scenarios & Testing

### US1 — Navegación derivada de permisos reales (Priority: P1)

**Como** usuario interno, **quiero** que el menú muestre solo los módulos que mi rol tiene activos, **para** no ver opciones que no puedo usar.

- **Given** OPERADOR sin `bandeja_reportes` activo, **When** entra al panel, **Then** "Bandeja de reportes" NO aparece en el menú (resuelto server-side en el layout, sin endpoint nuevo).
- **Given** el mismo cambio reactivado por el ADMIN, **When** el operador re-ingresa, **Then** el ítem vuelve sin pasos extra.
- **Given** cualquier nav del repo, **When** se inspecciona el código, **Then** ninguna filtra por `roles:[...]` quemado (todas filtran por clave de módulo).

### US2 — Guard de página con pantalla "Sin acceso" (Priority: P1)

**Como** usuario sin permiso que entra por URL directa, **quiero** ver "Sin acceso a este módulo" con enlace de vuelta, **para** entender que es un tema de permisos y no una avería.

- **Given** OPERADOR sin `bandeja_reportes`, **When** navega a `/dashboard/admin`, **Then** ve la pantalla "Sin acceso a este módulo" (no "No pudimos cargar…").
- **Given** cualquier página bajo `/dashboard/admin` o `/dashboard/colegio`, **When** el rol no tiene el módulo activo, **Then** misma pantalla, vía helper reutilizable (no código repetido por página).

### US3 — Catálogo alineado a lo visible (Priority: P1)

**Como** ADMIN, **quiero** que cada ítem del menú corresponda a un módulo con el mismo nombre, **para** que el interruptor que apago sea el de la pantalla que desaparece.

- **Given** el módulo "Bandeja de reportes", **When** se desactiva para OPERADOR, **Then** apaga la lista Y las acciones sobre reportes.
- **Given** "Revisión de spam" como módulo propio, **When** está activo para OPERADOR, **Then** `/dashboard/admin/spam` y `/api/admin/spam/**` funcionan (D-3 corregido).
- **Given** cualquier módulo del catálogo sin pantalla visible, **Then** está justificado en research.md o eliminado (con migración aditiva + backfill; nadie pierde permisos).

### US4 — Tabs del centro IA gobernadas por submódulos (Priority: P1)

**Como** ADMIN sin un submódulo de IA, **quiero** que las tabs del Centro de Control IA se filtren por submódulo, **para** no ver secciones que no puedo usar.

- **Given** ADMIN sin `ia_eval`, **When** abre `/dashboard/admin/ia`, **Then** la tab "Eval" no aparece; por querystring directo cae en el primer tab permitido.

### US5 — Aterrizaje sin permisos de bandeja (Priority: P1)

**Como** OPERADOR sin `bandeja_reportes`, **quiero** aterrizar en el primer módulo que sí tengo, **para** no caer en una pantalla rota tras el login.

- **Given** OPERADOR sin `bandeja_reportes` pero con `revision_spam`, **When** entra a `/dashboard/admin`, **Then** es redirigido a `/dashboard/admin/spam`.
- **Given** OPERADOR sin ningún módulo, **When** entra, **Then** ve "Sin módulos asignados, contacta al administrador" (nunca blanco ni error de carga).

### US6 — Test estructural anti-regresión (Priority: P2)

**Como** equipo, **quiero** un test que falle si un ítem de menú no tiene módulo en el catálogo (o referencia una clave inexistente), **para** que el desfase D-4 no vuelva.

## Requirements

- **FR-001**: `dashboard/admin/layout.tsx` (server) resuelve las claves de módulo activas del rol desde `PermisoModulo` y las pasa a `AdminNav`. Sin endpoint nuevo.
- **FR-002**: `AdminNav` filtra por `modulo: "<clave>"`; se elimina el campo `roles` de `allLinks`. `ColegioNav` y `ComiteSubNav` igual (cero `roles:[...]` en navegación).
- **FR-003**: Helper en `src/lib/permisos-modulos.ts` para guard de página (server): verifica token + módulo; las páginas renderizan `SinAccesoModulo` cuando no hay acceso.
- **FR-004**: Catálogo derivado de lo visible (mapeo en `research.md`): `revision_spam` módulo nuevo; `reportes_revision` se funde en `bandeja_reportes` (lista + acciones). Guards API actualizados acorde.
- **FR-005**: Migración aditiva con backfill: **nadie gana permisos** — la fusión usa semántica AND (ante la duda se restringe); las restricciones aplicadas se listan en `cierre.md`. `revision_spam` arranca solo con la copia de `anti_abuso` (denegado por defecto, sin inferencia desde el menú).
- **FR-006**: Test estructural menú ↔ catálogo + tests de nav filtrada, guard de página y pantalla "sin acceso".
- **FR-007**: Las tabs del Centro de Control IA se filtran por submódulo en servidor (Documentación visible con la raíz).
- **FR-008**: Aterrizaje: `/dashboard/admin` redirige al primer ítem permitido del rol; sin ninguno, pantalla "Sin módulos asignados".
- **FR-009**: NO se toca el modelo de datos de permisos ni el anti-lockout de la spec 019.

## Success Criteria

- **SC-001**: La prueba del CEO pasa (quickstart): quitar módulo → ítem desaparece del menú tras re-login; URL directa → "sin acceso"; reactivar → vuelve; spam funciona activo.
- **SC-002**: Cero `roles:[...]` en archivos de navegación (verificable por grep).
- **SC-003**: Gate completo + app desplegada en `:5005`.

## Fuera de alcance

Modelo de datos de permisos, anti-lockout, endpoints de la 019, pipeline de clasificación.


## Implementación

**Fecha**: 2026-07-23 · **Cierre completo**: [`cierre.md`](./cierre.md)

- D-1: navs por módulo (nav-items.ts + layouts server); D-2: guard de página + "Sin acceso"; D-3: `revision_spam` propio; D-4: fusión AND `reportes_revision`→`bandeja_reportes` + test estructural.
- Correcciones ZEUS: AND en fusión, spam sin inferencia, tabs IA por submódulo, aterrizaje definido.
- Prueba del CEO pasada en vivo (menú, sin acceso, aterrizaje, spam, reactivación). Gate: 768/768, lint/tsc/build OK, dev-restart OK.
- Commit: `feat(permisos): navegación y páginas gobernadas por permisos (spec 086, corrige 019)`.
