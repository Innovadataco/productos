# Cierre: Spec 048 — Validación uniforme (zod)

**Spec**: `specs/048-validacion-uniforme/spec.md`  
**Branch**: `feature/001-scaffolding`  
**Fecha de cierre**: 2026-07-20  
**Status**: CERRADA

---

## Resumen

Se estandarizó la validación de entradas en las rutas de mutación admin sin esquema usando zod. Se creó un módulo central de esquemas (`src/lib/schemas`) y un helper `withValidation` (`src/lib/validation`). No se modificó la lógica de negocio de los handlers; solo se añadió/sustituyó la validación de entrada. Se corrigió el manejo de errores en tres rutas de operadores para respetar el `statusCode` de `AppError`.

---

## Archivos tocados

### Nuevos
- `src/lib/schemas/index.ts`
- `src/lib/schemas/index.test.ts`
- `src/lib/validation.ts`
- `src/lib/validation.test.ts`
- `specs/048-validacion-uniforme/spec.md`
- `specs/048-validacion-uniforme/plan.md`
- `specs/048-validacion-uniforme/research.md`
- `specs/048-validacion-uniforme/data-model.md`
- `specs/048-validacion-uniforme/quickstart.md`
- `specs/048-validacion-uniforme/tasks.md`
- `specs/048-validacion-uniforme/checklists/requirements.md`
- `specs/048-validacion-uniforme/contracts/admin-mutation-validation.md`
- `specs/048-validacion-uniforme/cierre.md` (este archivo)

### Modificados
- `src/app/api/admin/ia/evals/route.ts`
- `src/app/api/admin/ia/evals/casos/[id]/desactivar/route.ts`
- `src/app/api/admin/ia/experimentos/[id]/preparar-activacion/route.ts`
- `src/app/api/admin/ia/ollama/probar/route.ts`
- `src/app/api/admin/ia/sandbox/route.ts`
- `src/app/api/admin/operadores/[id]/reactivar/route.ts`
- `src/app/api/admin/operadores/[id]/reenviar-email/route.ts`
- `src/app/api/admin/operadores/[id]/regenerar-password/route.ts`
- `src/app/api/config/parametros/[clave]/route.ts`
- `src/app/api/admin/apelaciones/vencer/route.ts`

---

## Commits

```text
d88d6f7 feat(048): validación uniforme con zod en rutas admin de mutación
a8e39fb docs(048): artefactos Spec-Kit y contratos de validación uniforme
```

---

## Validación

### TypeScript
```bash
npx tsc --noEmit
```
Resultado: OK.

### Lint
```bash
npm run lint
```
Resultado: OK (0 errores, 1 warning preexistente en `src/app/dashboard/admin/comite/gestion/GestionPageClient.tsx`).

### Tests unitarios
```bash
npm run test -- src/lib/validation.test.ts src/lib/schemas/index.test.ts
```
Resultado: 35 tests pasan (11 validation + 24 schemas).

### Suite completa
```bash
npm run test
```
Resultado: 531 tests en 92 archivos, todos pasan.

### Deploy limpio
```bash
./scripts/dev-restart.sh
```
Resultado: build OK, healthcheck OK, worker OK, un solo worker.

### Quickstart
Se validaron las rutas afectadas con `curl` enviando entradas inválidas. Todas respondieron `400` con `VALIDATION_ERROR`:
- `POST /api/admin/ia/evals` con body inesperado → 400
- `POST /api/admin/ia/ollama/probar` con url numérica → 400
- `POST /api/admin/ia/sandbox` con texto vacío → 400
- `PATCH /api/config/parametros/visibility.report_threshold` con valor vacío → 400
- `POST /api/admin/operadores/<invalid-id>/reactivar` → 400
- `POST /api/admin/apelaciones/vencer` con body inesperado y worker secret → 400

---

## Deuda técnica

- Quedan rutas de mutación fuera del alcance (autenticación, reportes, alertas) que aún no usan zod. El patrón en `src/lib/schemas` y `quickstart.md` queda documentado para futuros specs de saneamiento.
- `ValidationError` requiere `Object.setPrototypeOf(this, ValidationError.prototype)` porque `AppError` redefine el prototype. Si se refactoriza `AppError` para no necesitarlo, este workaround puede eliminarse.
- Se corrigió el manejo de errores en `admin/operadores/[id]/{reactivar,reenviar-email,regenerar-password}` para respetar `AppError.statusCode`. Otras rutas con catch similar podrían beneficiarse de un futuro saneamiento de errores.

---

## Notas

- No se ejecutaron migraciones ni se tocó el modelo de datos.
- No se modificaron SPEC-050 ni SPEC-060.
- El despliegue mantiene un solo worker, como exige AGENTS.md.
