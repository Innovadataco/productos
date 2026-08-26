# Implementation Plan: Hotfix loop /consentimiento (I-111)

**Branch**: `work/002-PI-153` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-153 · SPEC-250

---

## Summary

Hotfix de 2 líneas en `src/lib/proxy.ts` para extender `SESION_ROUTES` con `/consentimiento` y `/api/consentimiento`, más tests de regresión y barrido D-37. Alcance mínimo, cero migraciones, cero cambios en `src/lib/ai/**`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, `next/server`, Vitest |
| **Testing** | Vitest + `NextRequest` mock; Playwright E2E ya cubre journeys |
| **Constraints** | Sin cambios destructivos; sin tocar `src/lib/ai/**`; sin middleware.ts |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Sin multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública |
| §2.1 Stack heredado | ✅ Pass | Reutiliza `proxy.ts` existente |
| §3.1 TypeScript strict | ✅ Pass | Sin `any` |
| §3.4 Códigos HTTP correctos | ✅ Pass | 200 vs 307/401 |
| §3.5 Logs y auditoría | ✅ Pass | Sin cambios |
| §4.2 Rutas API individuales | ✅ Pass | No agrega endpoints |

---

## Implementation Steps

### Phase 1: Fix
1. Editar `src/lib/proxy.ts`: añadir `"/consentimiento"` y `"/api/consentimiento"` a `SESION_ROUTES`.
2. Ejecutar barrido D-37: revisar `src/app/**/page.tsx` y `src/app/api/**/route.ts` recientes para confirmar que no hay otras rutas post-login huérfanas.

### Phase 2: Regresión
3. Añadir tests en `src/lib/proxy.test.ts`:
   - `SCHOOL_ADMIN`, `PARENT` y `COMITE_CONVIVENCIA` acceden a `/consentimiento` sin redirect.
   - `SCHOOL_ADMIN` y `PARENT` acceden a `/api/consentimiento/aceptar` sin redirect del proxy.
4. Ejecutar tests existentes para confirmar cero regresión.

### Phase 3: Verificación
5. `npx tsc --noEmit`
6. `npm run lint`
7. `npm run arch:check`
8. `npm run tokens:check`
9. `npm run test -- src/lib/proxy.test.ts`
10. `npm run build`

### Phase 4: Entrega
11. Commit + gate pre-push + push + PR.

---

## Test Strategy

- **Unitario**: `src/lib/proxy.test.ts` con mocks de `NextRequest` y tokens firmados en memoria.
- **E2E**: journeys existentes ya usan el proxy real; el nuevo caso asegura que no haya redirect.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Abrir demasiado del árbol `/api/consentimiento` | Se incluye solo el prefijo `/api/consentimiento`; la API valida sesión y datos. |
| Otra ruta post-login huérfana | Barrido D-37 antes de push. |
| Anónimo en `/consentimiento` | La página redirige server-side a `/login`; el proxy no la expone como pública. |
