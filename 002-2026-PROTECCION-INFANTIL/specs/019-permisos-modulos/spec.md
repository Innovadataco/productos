# Spec 019 — Gestor de permisos de módulos por ROL

> Estado: **FINALIZADO** (pendiente ACTA)
> Diseño: [`diseno.md`](diseno.md) · Plan: [`plan.md`](plan.md).
> Re-especificada: 2026-07-23 con 5 cambios obligatorios de ZEUS.

## Alcance

Permitir que el ADMIN active/desactive **módulos y submódulos** del panel interno por **ROL** (`ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`). No hay permisos por usuario individual (capa eliminada, YAGNI). No gestiona permisos por acción ni afecta a usuarios finales (`PARENT`) ni flujos públicos.

## Cambios obligatorios (ZEUS, 2026-07-23)

1. **Permisos por ROL, no por usuario**: `PermisoModulo(rol, moduloId, activo)`. Overrides individuales fuera de alcance.
2. **Incluir `COMITE_VALIDACION`** en el conjunto de roles gestionados.
3. **Submódulos**: `ModuloPermisible` con jerarquía padre/hijo (`padreId` nullable); se puede activar un módulo y solo algunos de sus submódulos.
4. **Anti-lockout configurable**: ningún valor hardcodeado; roles protegidos definidos por parámetro del sistema.
5. **Sin motor genérico ni roles dinámicos**: el modelo por rol debe ABSORBER roles nuevos (futuras entidades: padres, fiscalía, ICBF, policía) sin refactor — y punto.

## Decisiones del owner (conservadas)

1. Denegar por defecto: si un módulo no está activo para un rol, ese rol no tiene acceso.
2. La validación está en backend por ruta (API y páginas); no basta con ocultar el menú.
3. Gestión desde `/dashboard/admin/configuracion`.
4. Todo cambio de permisos se registra en `AuditLog`.
5. Candado anti-lockout: no se puede dejar a la plataforma sin ningún rol protegido con acceso a un módulo crítico.

## Requisitos funcionales

- **FR-001**: `PermisoModulo(rol, moduloId, activo)` con `@@unique([rol, moduloId])`; `rol` se persiste como **String** (no enum), de modo que un rol nuevo se absorbe insertando filas, sin migración ni refactor (cambio 5).
- **FR-002**: `ModuloPermisible` soporta jerarquía de un nivel (padre/hijo vía `padreId` nullable). Acceso a un submódulo exige módulo padre activo **y** submódulo activo para el rol (AND jerárquico). Acceso a un módulo raíz exige solo su propio `activo`.
- **FR-003**: Denegar por defecto: sin fila o `activo=false` → 403 en API y redirect en páginas.
- **FR-004**: Roles gestionados en esta entrega: `ADMIN`, `SCHOOL_ADMIN`, `OPERADOR`, `COMITE_VALIDACION`. La UI lista roles desde los datos (filas de `PermisoModulo`), no desde una lista en código: un rol futuro aparece al crear sus filas.
- **FR-005**: Anti-lockout configurable: parámetro `seguridad.permisos_roles_protegidos` (STRING_ARRAY, default `["ADMIN"]`) define los roles protegidos. Para módulos marcados `esCritico` (dato del catálogo), el backend impide guardar un cambio que deje a TODOS los roles protegidos sin acceso. Sin `esOwner`, sin emails ni roles en código.
- **FR-006**: Backend por ruta: helper `requireModulo(request, clave)` para API (403) y guard en layouts de páginas (redirect). El middleware de edge queda fuera (sin Prisma).
- **FR-007**: UI en `/dashboard/admin/configuracion`: matriz rol × árbol de módulos con toggles; críticos marcados; guardado con validación anti-lockout.
- **FR-008**: `AuditLog` de cada guardado: acción `PERMISOS_MODULO_ACTUALIZADOS`, valor anterior/nuevo en JSON, `usuarioId` del admin que cambia.
- **FR-009**: Migración de datos idempotente: catálogo inicial (con submódulos) + backfill que reproduce el acceso implícito actual por rol (ADMIN todo; SCHOOL_ADMIN su módulo colegio; OPERADOR bandeja/revisión; COMITE_VALIDACION bandeja comité) para no romper a nadie al activar los guards.
- **FR-010**: NO motor genérico de entidades, NO CRUD de roles, NO overrides por usuario. Explícitamente fuera de alcance.

## Catálogo inicial (orientativo, con jerarquía)

- `centro_control_ia` (raíz, crítico) → submódulos: `ia_playground`, `ia_eval`, `ia_simulaciones`, `ia_configuracion`
- `operadores` (raíz, crítico)
- `comite` (raíz) → submódulos: `comite_bandeja`, `comite_auditoria`
- `colegios` (raíz) → submódulos: `colegios_gestion`, `colegios_auditoria`
- `configuracion_sistema` (raíz, crítico) → submódulo: `configuracion_permisos`
- `audit_logs` (raíz, crítico)
- `estadisticas`, `anti_abuso`, `apelaciones`, `dataset_entrenamiento` (raíces no críticas)

Módulos siempre accesibles (no configurables): login/logout, cambio de contraseña propio, página de "sin acceso".

## Criterios de éxito

- Un OPERADOR con `bandeja_reportes` activo y `reportes_revision` inactivo accede a la bandeja y recibe 403 en revisión (verificable por test).
- Desactivar `colegios_auditoria` para `SCHOOL_ADMIN` deja activo `colegios` (padre) → acceso a gestión sí, a auditoría no.
- Intentar desactivar `configuracion_permisos` para todos los roles protegidos → 409 (anti-lockout) con parámetro cambiado a `["ADMIN","SCHOOL_ADMIN"]` sigue bloqueando solo si ambos quedan fuera.
- Insertar filas para un rol inexistente hoy (p. ej. `FISCALIA`) lo hace funcional sin tocar código.
- Gate completo verde.

## Riesgos mitigados

- Lockout: anti-lockout configurable + backfill que reproduce acceso actual.
- Bypass por URL: guard en backend por ruta.
- Escalación: solo ADMIN edita permisos; audit log.
- Sobrediseño: sin usuarios individuales, sin entidades dinámicas, sin niveles de jerarquía > 1.

## R7

No aplica: no toca el pipeline de clasificación.


## Implementación

**Fecha**: 2026-07-23 · **Cierre completo**: [`cierre.md`](./cierre.md)

- Migración aditiva (2 tablas + valor de enum), catálogo de 21 módulos con jerarquía, backfill por rol, parámetro anti-lockout.
- Endpoints GET/PATCH `/api/admin/permisos-modulos` con validación de rol (typo → 400) y anti-lockout (409). UI: tab "Permisos por rol" en configuración.
- Enforcement: `assertModulo` en 83 route.ts (API). Sin guard en páginas (documentado en cierre) ni rutas públicas/worker (por diseño).
- Validación: 764/764 tests, gate verde, ciclo en vivo verificado (403 al denegar, 200 al reactivar, 409 anti-lockout, 400 typo).
- **Pendiente**: validación funcional de Jelkin (v1.2) antes de CERRADA.
