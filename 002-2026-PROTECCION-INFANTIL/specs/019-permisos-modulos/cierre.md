# Cierre — Spec 019: Gestor de permisos de módulos por ROL

**Fecha**: 2026-07-23
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/019-permisos-modulos/`
**Estado**: IMPLEMENTADO — pendiente validación funcional de Jelkin (v1.2) y ACTA-VALIDACION de ZEUS

## Cambios obligatorios incorporados

1. **Por ROL, no por usuario**: `PermisoModulo(rol, moduloId, activo)`, `rol` como String. Sin capa por usuario.
2. **COMITE_VALIDACION** incluido (backfill: `comite`, `comite_bandeja`, `comite_auditoria`).
3. **Submódulos**: `ModuloPermisible.padreId` nullable; acceso a hijo = padre AND hijo activos.
4. **Anti-lockout configurable**: parámetro `seguridad.permisos_roles_protegidos` (STRING_ARRAY, default `["ADMIN"]`); PATCH → 409 si deja a todos los roles protegidos sin un módulo crítico.
5. **Sin motor genérico**: roles derivados de datos (`rolesConocidos` = enum `RolUsuario` ∪ DISTINCT rol en `PermisoModulo`); un rol futuro entra con filas. **Observación ZEUS 1**: el PATCH valida el rol contra ese conjunto — typo → 400 con lista de válidos, sin fila fantasma (test + validado en vivo).

## Implementación

- Migración aditiva `20260723090000_add_permisos_modulos`: 2 tablas + `AccionAudit + PERMISOS_MODULO_ACTUALIZADOS` (aplicada en dev y test; el valor también se añadió al enum del schema — detectado por un fallo de test al escribir auditoría).
- Catálogo compartido `src/lib/permisos-catalogo.ts` (21 módulos, jerarquía de 1 nivel) usado por seed y tests.
- Seed: catálogo + backfill por rol (ADMIN todo; SCHOOL_ADMIN colegios; OPERADOR bandeja/revisión; COMITE comité) + parámetro anti-lockout.
- `src/lib/permisos-modulos.ts`: `puedeAccederAModulo` (AND jerárquico), `requireModulo`, `assertModulo`, `rolesConocidos`, `obtenerRolesProtegidos`.
- `GET/PATCH /api/admin/permisos-modulos` (matriz + cambios con anti-lockout y `AuditLog`).
- UI: tab "Permisos por rol" en `/dashboard/admin/configuracion` (`ConfiguracionTabs` + `PermisosRolPanel`).
- **Enforcement (adopción incremental)**: `assertModulo` aplicado en **83 `route.ts`** — ver cobertura abajo.

## Cobertura del guard (honestidad sobre enforcement parcial — observación ZEUS 2)

**CON `requireModulo`/`assertModulo` (83 rutas API)**: ia_playground (sandbox), ia_configuracion (modelos, ollama), ia_eval (evals, experimentos), ia_simulaciones, operadores (7 rutas), comite (integrantes), comite_bandeja (solicitudes, pendientes, mias, [id]), colegios_gestion (admin/colegios + api/colegio: cursos, alumnos, carga, estadísticas, alertas, identificadores), colegios_auditoria (api/colegio/auditoria), configuracion_sistema (config/parametros incl. revelar), configuracion_permisos, audit_logs, estadisticas, anti_abuso (anti-abuso, spam), apelaciones, dataset_entrenamiento, bandeja_reportes (reportes/[id]/*), reportes_revision (reportes-revision, correcciones).

**SIN guard en esta entrega**:
- **Páginas (layouts/pages server-side)**: ningún guard de módulo a nivel de página. Mitigación: las páginas renderizan el shell pero sus datos vienen de APIs protegidas (el cliente recibe 403). Adopción de guards de página queda como trabajo futuro.
- **Rutas públicas por diseño**: `/api/config/parametros/publicos`, `/api/reportes` (reporte anónimo), `/api/consulta`, `/api/estadisticas-publicas`, `/api/seguimiento`, `/api/auth/**`, `/api/health/**`, `/api/paises`, `/api/ciudades`, `/api/plataformas`, `/api/me`, `/api/alertas` (usuario final), `/api/circulo-confianza`, `/api/apelaciones` (públicas).
- **`/api/admin/apelaciones/vencer`**: endpoint de worker (`X-Worker-Secret`, sin usuario/rol).
- Jerarquía no aplicable: ningún módulo del catálogo quedó sin asignar.

## Validación

- Tests nuevos: helpers 5/5, endpoint 6/6 (incluye typo de rol → 400 sin fila fantasma, anti-lockout con 1 y 2 roles protegidos, absorción de rol nuevo).
- Setup de tests: `resetDatabase` otorga todos los permisos tras limpiar (los tests previos asumen acceso implícito); suite completa **764/764**.
- Gate: lint 0 errores (1 warning heredado) · `tsc --noEmit` OK · `rm -rf .next && npm run build` OK · `dev-restart.sh` healthcheck OK.
- **En vivo** (quickstart §B): typo `ADMN` → 400 con lista de válidos; desactivar `estadisticas` para ADMIN → `GET /api/admin/estadisticas` = **403**; reactivar → 200; desactivar módulo crítico `audit_logs` para ADMIN → **409** anti-lockout.

## Pendiente para cierre

- **Validación funcional de Jelkin (v1.2)**: app desplegada y accesible en `:5005` (`-H 0.0.0.0`) con la spec aplicada; flujo sugerido en `quickstart.md`.
- ACTA-VALIDACION de ZEUS tras la prueba de Jelkin.

## Deuda técnica

- Guards de página (layouts server-side) pendientes — la protección actual es a nivel API.
- La UI de permisos no ofrece gestionar el parámetro de roles protegidos (se edita en el tab Parámetros).

## Commit

- `feat(permisos): gestor de permisos de módulos por rol (spec 019)`
