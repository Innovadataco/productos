# Research — 019-permisos-modulos

> Fase 0 (documentada post-implementación para completar el set Spec-Kit). Resuelve las decisiones
> técnicas del gestor de permisos de módulos por rol. Formato: Decisión / Racional / Alternativas.
> Verificado contra el código vigente (`src/lib/permisos-modulos.ts`, migración
> `20260723090000_add_permisos_modulos`, 83 rutas con `assertModulo`).

## R1. Permisos por ROL como fila `(rol, moduloId, activo)`, sin capa por usuario

- **Decisión:** una fila por combinación rol+módulo (`@@unique([rol, moduloId])`); sin `usuarioId` ni overrides individuales.
- **Racional:** mandato de ZEUS (YAGNI): la operación real gestiona equipos por rol, no personas. Menos filas, menos UI, menos superficie de error.
- **Alternativas:** (a) por usuario con herencia de rol — descartada: complejidad sin caso de uso actual; (b) híbrido rol+override — descartada: fuera de alcance explícito.

## R2. `rol` como String (no enum) para absorber roles futuros

- **Decisión:** `PermisoModulo.rol TEXT`; `rolesConocidos()` = valores del enum `RolUsuario` ∪ `DISTINCT rol` en la tabla. El PATCH valida contra ese conjunto (typo → 400).
- **Racional:** el SaaS sumará entidades (fiscalía, ICBF, policía) como roles nuevos; con String entran insertando filas, sin migración de enum ni refactor. La validación al escribir evita filas fantasma (observación 1 de ZEUS en la aprobación).
- **Alternativas:** (a) enum Prisma — descartada: cada rol nuevo exigiría migración + deploy; (b) CRUD de roles — descartado por ZEUS (sin roles dinámicos).

## R3. Jerarquía de UN nivel con AND padre/hijo

- **Decisión:** `ModuloPermisible.padreId` nullable (self-FK, `onDelete: Restrict`); `puedeAccederAModulo` exige padre activo Y submódulo activo.
- **Racional:** cubre "módulo activo con solo algunos submódulos" (ej. colegios: gestión sí, auditoría no) sin árboles de N niveles. Un nivel mantiene la consulta en 2 lecturas y la UI simple.
- **Alternativas:** (a) jerarquía N-niveles — descartada: sin caso de uso; (b) submódulos independientes (sin AND) — descartada: apagar el padre no apagaría nada, contra-intuitivo.

## R4. Anti-lockout por parámetro, no por código

- **Decisión:** `seguridad.permisos_roles_protegidos` (STRING_ARRAY, default `["ADMIN"]`); el PATCH simula el estado final y exige ≥1 rol protegido activo por módulo `esCritico` (si no → 409).
- **Racional:** mandato ZEUS: nada hardcodeado. Los roles protegidos son configuración operativa (cambia con el despliegue), no lógica.
- **Alternativas:** (a) `Usuario.esOwner` — descartada: acopla a una persona y requiere migración sobre `Usuario`; (b) rol ADMIN fijo en código — descartada: viola el mandato.

## R5. Guard como capa adicional a `verifyAuth`, adopción incremental por API

- **Decisión:** `assertModulo(user, clave)` se llama DESPUÉS del `verifyAuth` existente en 83 `route.ts`; las rutas públicas y el endpoint de worker (`apelaciones/vencer`) quedan fuera por diseño; las páginas (layouts) sin guard en esta entrega.
- **Racional:** cero riesgo de big-bang: el acceso implícito por rol no cambia hasta que cada módulo adopta el guard; el backfill reproduce el acceso actual para que la activación no rompa a nadie.
- **Alternativas:** (a) reemplazar `verifyAuth` por el guard — descartada: acoplamiento y regresión masiva; (b) middleware de edge — descartada: sin Prisma en edge (decisión ya tomada en el diseño original).

## R6. Catálogo como dato compartido (`src/lib/permisos-catalogo.ts`)

- **Decisión:** el catálogo de 21 módulos vive en un módulo TS compartido por `prisma/seed.ts` y `src/lib/test-utils.ts` (`otorgarTodosLosPermisos`).
- **Racional:** única fuente: el seed crea el catálogo en entornos reales y el reset de tests recrea el mismo universo con todos los permisos activos (los ~750 tests previos asumen acceso implícito).
- **Alternativas:** (a) catálogo duplicado en seed y tests — descartada: deriva garantizada; (b) leerlo de BD en los tests — inviable tras `resetDatabase`.

## R7. Grant total en el setup de tests

- **Decisión:** `resetDatabase()` termina llamando `otorgarTodosLosPermisos()` (catálogo + todas las combinaciones rol×módulo activas).
- **Racional:** los guards son una capa nueva sobre ~750 tests que autentican por rol sin saber de permisos; otorgar todo por defecto preserva su semántica. Los tests de permisos crean sus propios módulos/claves y no colisionan.
- **Alternativas:** (a) actualizar los ~750 tests uno a uno — descartada: ruido masivo sin valor; (b) fail-open si no hay catálogo — descartada: viola "denegar por defecto" en producción.
