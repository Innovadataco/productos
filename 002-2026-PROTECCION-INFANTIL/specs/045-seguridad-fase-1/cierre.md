# Cierre — Spec 045: Seguridad Fase 1 — Saneamiento de Auth

**Fecha**: 2026-07-20
**Rama**: `feature/001-scaffolding`
**Spec**: `specs/045-seguridad-fase-1/`

## Resumen

Se completó la Fase 1 del PROGRAMA DE SANEAMIENTO, endureciendo los endpoints de autenticación pública con rate limiting y validación Zod, y entregando el plan de diseño para el borrado seguro / derecho al olvido sin implementar código.

- **US1 (P1)**: rate limit en `POST /api/auth/recuperar/solicitar` y `POST /api/auth/verificar/solicitar` usando `checkRateLimit` existente, por IP y por email, con respuesta uniforme.
- **US2 (P1)**: validación Zod en `POST /api/auth/register`, `POST /api/auth/recuperar/solicitar` y `POST /api/auth/recuperar/restablecer`.
- **US3 (P1)**: plan-only — documentación completa de borrado seguro / derecho al olvido en `plan.md`, sin código ni migraciones.

## Commits

- `1788861` — `feat(045): rate limit en auth recuperar y verificar por IP e email`
- `2303deb` — `feat(045): validación Zod en endpoints públicos de auth`
- `937e946` — `docs(045): plan de borrado seguro / derecho al olvido y artefactos Spec-Kit`

## Archivos tocados

### Código (US1 y US2)

- `src/lib/rate-limit.ts` — scopes `recuperar_solicitar` y `verificacion_solicitar`.
- `src/lib/validators.ts` — esquemas `authRegisterSchema`, `recuperarSolicitarSchema`, `restablecerPasswordSchema`.
- `src/lib/validators.test.ts` — tests unitarios de esquemas.
- `src/lib/reporte-test-utils.ts` — parámetros de rate limit para tests.
- `src/app/api/auth/recuperar/solicitar/route.ts` — rate limit + Zod.
- `src/app/api/auth/verificar/solicitar/route.ts` — rate limit.
- `src/app/api/auth/register/route.ts` — Zod.
- `src/app/api/auth/recuperar/restablecer/route.ts` — Zod.
- `src/app/api/auth/recuperar/solicitar/route.test.ts` — tests de integración.
- `src/app/api/auth/verificar/solicitar/route.test.ts` — tests de integración.
- `src/app/api/auth/register/route.test.ts` — tests de integración.
- `src/app/api/auth/recuperar/restablecer/route.test.ts` — tests de integración.

### Documentación (US3)

- `specs/045-seguridad-fase-1/spec.md`
- `specs/045-seguridad-fase-1/plan.md`
- `specs/045-seguridad-fase-1/research.md`
- `specs/045-seguridad-fase-1/data-model.md`
- `specs/045-seguridad-fase-1/quickstart.md`
- `specs/045-seguridad-fase-1/checklists/requirements.md`
- `specs/045-seguridad-fase-1/tasks.md`
- `specs/045-seguridad-fase-1/contracts/auth.md`

## Validación

### TypeScript

```bash
npx tsc --noEmit
```

**Resultado**: 0 errores.

### Lint

```bash
npm run lint
```

**Resultado**: 0 errores, 1 advertencia preexistente en `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx` (no introducida por este cambio).

### Tests

```bash
npm run test
```

**Resultado**: 89 archivos, 479 tests, 0 fallos.

Nuevos tests aportados por este spec: 40 (5 route tests + 18 validators + 17 route tests restantes).

### Build

```bash
npm run build
```

**Resultado**: compilación exitosa, 89 rutas generadas.

### Deploy limpio

```bash
./scripts/dev-restart.sh
```

**Resultado**: healthcheck `{"status":"ok","workerAlive":true,"dbOk":true,...}` en `http://localhost:5005`.

### Quickstart

Se ejecutaron manualmente los escenarios de validación que no dependen de tener rate limit habilitado en runtime (el entorno de desarrollo tiene `DISABLE_RATE_LIMIT=true`):

- `POST /api/auth/recuperar/solicitar` con email inválido → `400 VALIDATION_ERROR`.
- `POST /api/auth/recuperar/restablecer` con token vacío → `400 VALIDATION_ERROR`.
- `POST /api/auth/recuperar/solicitar` con email no registrado → `200` con mensaje uniforme.
- `POST /api/auth/verificar/solicitar` con email inválido → `400 VALIDATION_ERROR`.

El comportamiento de rate limit fue verificado en la suite de tests forzando `DISABLE_RATE_LIMIT=false` en los casos correspondientes.

## Notas sobre el entorno

- El archivo `.env` (y `.env.test`) define `DISABLE_RATE_LIMIT=true`. Esto desactiva el rate limit en el entorno de desarrollo desplegado. Los tests lo habilitan transitoriamente para validar la funcionalidad.
- No se modificaron `.env` ni `.env.test` porque no formaba parte del alcance y son archivos sensibles.
- No se ejecutaron migraciones porque el cambio es puramente de código: la tabla `RateLimit` ya existía y los scopes nuevos son solo defaults/parametrizables.

## Deuda técnica

- Los endpoints `POST /api/auth/verificar/validar` y `POST /api/auth/verificar/completar` aún usan validación manual. Se deja para una fase posterior de estandarización generalizada a Zod.
- El plan de borrado seguro es un ítem de pre-producción registrado en `docs/PRE-PRODUCCION.md`. Requiere un spec dedicado con migraciones aditivas, flujo de aprobación por ADMIN, anonimización vs. eliminación y generación de certificado.
- Considerar extraer un helper de respuesta uniforme para rate limit si más endpoints lo adoptan.
- El endpoint `POST /api/auth/register` usa `verifyAuth("ADMIN")` pero la lógica interna deja un `else` de `SCHOOL_ADMIN` muerto. Esto es un bug preexistente fuera del alcance de este spec.

## Estado

**Status**: CERRADA.

Fase 1 del PROGRAMA DE SANEAMIENTO completada. Listo para continuar con el siguiente spec (sin tocar SPEC-050 ni SPEC-060).
