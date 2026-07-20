# Quickstart: Tests de rol + documentación de arquitectura

**Feature**: specs/047-tests-rol-arquitectura/spec.md
**Date**: 2026-07-20

---

## Prerrequisitos

- Repo en `/Users/idc/productos/INNOVADATACO/002-2026-PROTECCION-INFANTIL`.
- Rama `feature/001-scaffolding` actualizada.
- PostgreSQL corriendo (Docker Compose) en puerto `5433`.
- Dependencias instaladas: `npm install`.

## 1. Verificar artefactos del Spec-Kit

```bash
ls specs/047-tests-rol-arquitectura/
# Debe listar: spec.md plan.md research.md data-model.md quickstart.md tasks.md checklists/requirements.md
```

## 2. Ejecutar tests de visibilidad por rol

```bash
npm run test -- src/lib/role-visibility.test.ts
```

**Resultado esperado**: todos los tests de `ComiteSubNav`, `AdminNav`, `proxy` y permisos pasan.

## 3. Verificar documentación de arquitectura

```bash
ls docs/ARCHITECTURE.md
# Debe existir

grep -q "## Capas de la aplicación" docs/ARCHITECTURE.md && echo "OK: sección de capas"
grep -q "## Flujo de datos" docs/ARCHITECTURE.md && echo "OK: sección de flujo de datos"
grep -q "## Convenciones" docs/ARCHITECTURE.md && echo "OK: sección de convenciones"
grep -q "## Seguridad y despliegue" docs/ARCHITECTURE.md && echo "OK: sección de seguridad"
```

## 4. Verificar JSDoc en módulos clave

```bash
grep -q "/\*\*" src/lib/reporte-lifecycle.ts && echo "OK: JSDoc en reporte-lifecycle"
grep -q "/\*\*" src/lib/circulo-confianza.ts && echo "OK: JSDoc en circulo-confianza"
grep -q "/\*\*" src/lib/proxy.ts && echo "OK: JSDoc en proxy"
grep -q "/\*\*" src/lib/ai/classifier.ts && echo "OK: JSDoc en classifier"
grep -q "/\*\*" src/lib/param-encryption.ts && echo "OK: JSDoc en param-encryption"
```

## 5. Validación de calidad

```bash
npx tsc --noEmit
npm run lint
npm run test
```

**Resultado esperado**: sin errores de TypeScript, sin errores de lint y todos los tests pasan.

## 6. Deploy limpio

```bash
./scripts/dev-restart.sh
```

**Resultado esperado**: build OK, healthcheck OK, un solo worker corriendo.

## 7. Verificar que no se tocaron SPEC-050 ni SPEC-060

```bash
git diff --name-only | grep -E "specs/050|specs/060" || echo "OK: no se tocaron SPEC-050 ni SPEC-060"
```

## Notas

- Si algún test de proxy falla por cambios en `next/server`, revisar el mock en `role-visibility.test.ts`.
- El JSDoc no debe introducir nuevos warnings de ESLint; ejecutar `npm run lint` es obligatorio.
