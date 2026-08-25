# Implementation Plan: Vista `/suscripcion` enriquecida + PlanesSelector + ConfirmarPagoManual + freemium

**Branch**: `work/002-PI-mega-cobros` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-147 · BRIEF-ACTIVACION-Y-COBROS §3/§4/§5.1/§5.2/§6.1/§6.3/§8/§11

---

## Summary

Enriquecer la suscripción de padre/colegio con selector de planes, confirmación de pago manual y activación freemium autónoma. Todo aditivo, reutilizando componentes de SPEC-211 y coordinando migraciones con SPEC-245.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, `date-fns-tz`, Tailwind CSS 3.4 |
| **Storage** | PostgreSQL 16+ |
| **Testing** | Vitest + jsdom + Playwright E2E |
| **Constraints** | Sin tocar `src/lib/ai/**`; sin módulos verticales; migraciones aditivas; TZ Bogotá; colores por rol |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | Sin multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §3.1 TS strict | ✅ Pass | Sin `any` |
| §3.4 Códigos HTTP | ✅ Pass | 400/401/403/404/409/429/500 |
| §3.5 Logs/auditoría | ✅ Pass | AuditLog + eventos |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por endpoint |

---

## Implementation Steps

### Phase 1 — Schema (coordinado con SPEC-245)
1. Extender `Suscripcion` con campos `origen`, `autorizadoPorAdminId`, `autorizadoEn`, `metodoPagoManual`, `referenciaPagoManual`, `montoRealPagado`, `fechaPagoReal`.
2. Crear enums `OrigenSuscripcion` y `MetodoPagoManual`.
3. Generar migración aditiva única (timestamp coordinado con SPEC-245 para no colisionar).

### Phase 2 — Repositorios y servicios
4. Extender `suscripcion-repository.ts` con `crearSolicitud()` y `crearFreemium()`.
5. Extender `plan-repository.ts` con `listarActivosPorRol()`.
6. Crear servicio `suscripcion-solicitud.service.ts` para cálculo de totales e IVA.
7. Crear servicio `freemium-activacion.service.ts` con rate-limit por IP y guard `usosMaximosPorCliente=1`.

### Phase 3 — Endpoints
8. `POST /api/padre/suscripcion/solicitar-plan` y `POST /api/colegio/suscripcion/solicitar-plan`.
9. `POST /api/padre/suscripcion/activar-freemium`.

### Phase 4 — UI
10. Crear `PlanesSelector` (padre=cielo, colegio=pino).
11. Crear `ConfirmarPagoManual` con desglose subtotal/descuento/IVA/total y checkbox.
12. Crear `EsperandoAutorizacion` (slot para refresh silencioso en SPEC-247).
13. Enriquecer `/dashboard/padre/suscripcion/page.tsx` y `/dashboard/colegio/suscripcion/page.tsx` reutilizando componentes SPEC-211.

### Phase 5 — Seed y eventos
14. Sembrar plantillas/reglas de `suscripcion.solicitada` y `suscripcion.activada` si no existen (coordinar con SPEC-245).

### Phase 6 — Tests y gate
15. Tests unitarios de cálculo de totales.
16. Tests de integración de endpoints (guard, idempotencia, freemium).
17. Gate local: tsc, lint, arch:check, tokens:check, tests, build.

---

## Test Strategy

- Unitarios: cálculo IVA, formateo COP, validación Zod.
- Integración: creación de solicitud, idempotencia, freemium único, rate-limit.
- E2E: flujo completo padre selecciona plan → confirma → espera autorización.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Colisión migración con SPEC-245 | Coordinar timestamp; un solo commit aplica enum/campos, el otro reusa. |
| Rate-limit por IP sin cache compartida | Usar mecanismo estándar de la app (`checkRateLimit`) sobre PostgreSQL. |
| Doble solicitud | Guard en repositorio: rechazar si ya existe PENDIENTE_AUTORIZACION/ACTIVA/EN_GRACIA. |
