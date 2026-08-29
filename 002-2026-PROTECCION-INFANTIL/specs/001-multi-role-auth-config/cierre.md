# Cierre — Spec 001: Autenticación Multi-Rol y Parámetros de Configuración

> **Cierre retrospectivo** (auditoría Spec Kit 2026-07-27, §3.2a): esta spec quedó CERRADA
> sin documento de cierre. Se reconstruye desde su spec.md y el estado verificable del
> código actual. No existen métricas de la época; no se inventan.

**Fecha original de la spec**: 2026-07-11 · **Status**: CERRADA

## Alcance entregado (verificable en el código actual)

- **Autenticación multi-rol** (FR-001 a FR-004): registro/login con email y contraseña,
  sesión JWT en cookie httpOnly (24 h), logout, bloqueo temporal por intentos fallidos y
  respuesta uniforme ante credenciales inválidas. Roles iniciales ADMIN, SCHOOL_ADMIN y
  PARENT (después se sumaron OPERADOR y COMITE_VALIDACION en specs posteriores).
  Fuente de verdad vigente: `src/lib/auth.ts` y `src/app/api/auth/**`.
- **Parámetros de configuración** (FR-005 a FR-012): CRUD de parámetros solo para ADMIN
  (`ParametroSistema`), lectura pública de los marcados como públicos, validación por tipo
  (numérico, texto, booleano, lista), rangos mínimos/máximos (p.ej. umbral de visibilidad
  ≥ 1), parámetros secretos cifrados en reposo (`esSecreto` + AES-256-GCM en
  `src/lib/param-encryption.ts`) y registro de auditoría por cambio (quién, cuándo, valor
  anterior y nuevo).
- **Multi-colegio** (FR-012): SCHOOL_ADMIN limitado a su tenant (`Tenant`).

## Evidencia disponible hoy

- Suite de tests vigente sobre auth y parámetros (`src/app/api/auth/**/route.test.ts`,
  parámetros y proxy) dentro de los ~930 tests del gate actual.
- Las funcionalidades siguen en producción y fueron endurecidas por specs posteriores
  (005, 019, 100, 105, 106), que sí tienen cierre propio.

## Nota de honestidad documental

No se recuperaron evidencias de la verificación original (capturas, métricas o quickstart
ejecutado en su fecha). El cierre se limita a contrastar el alcance contra el código vigente.
