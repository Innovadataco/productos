# Implementation Plan: Admin activar suscripción manual + captura pago manual

**Branch**: `work/002-PI-mega-cobros` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-148 · BRIEF-ACTIVACION-Y-COBROS §5/§6.1/§8/§10/§11

---

## Summary

Enriquecer `/dashboard/admin/pagos` con activación manual y autorización de solicitudes pendientes. Reutiliza panel SPEC-212, extiende DAL y emite eventos.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Next.js 16.2.10, Prisma 5.22.0, `date-fns-tz`, Tailwind CSS 3.4 |
| **UI** | Admin = paleta `ambar` (D-74) |
| **Testing** | Vitest + Playwright |
| **Constraints** | Sin `src/lib/ai/**`; migraciones aditivas; TZ Bogotá |

---

## Implementation Steps

### Phase 1 — Schema (compartida con SPEC-244)
1. Reutilizar migración de SPEC-244 (o crearla si 244 no la aplicó): extensión `Suscripcion` + enums `OrigenSuscripcion`/`MetodoPagoManual`.

### Phase 2 — Repositorios
2. Extender `suscripcion-repository.ts` con `listarSinSuscripcion()`, `autorizarSolicitud()`, `crearActivacionManual()`.
3. Extender `plan-repository.ts` con `obtenerPorId()`.
4. Extender `usuario-repository.ts` y `colegio-repository.ts` con filtros de listado.

### Phase 3 — Servicios
5. Crear `admin-activacion-manual.service.ts`.
6. Crear `admin-autorizar-solicitud.service.ts`.
7. Calcular `fechaFin` según `DuracionPlan` con `date-fns-tz`.

### Phase 4 — Endpoints
8. `POST /api/admin/pagos/activar-manual`.
9. `POST /api/admin/pagos/pendientes/[id]/autorizar`.

### Phase 5 — UI admin
10. Agregar tab "Sin suscripción" en `/dashboard/admin/pagos`.
11. Crear modal `ActivarSuscripcionManual`.
12. Enriquecer tab "Pendientes" con botón "Autorizar" y captura de pago.

### Phase 6 — Seed y eventos
13. Sembrar `suscripcion.solicitada` y `suscripcion.activada` en `prisma/seed.ts` con `upsert`.

### Phase 7 — Tests y gate
14. Tests de integración de endpoints.
15. Gate local: tsc, lint, arch:check, tokens:check, tests, build.

---

## Test Strategy

- Integración: guard admin, activación manual, autorización, idempotencia, fechas Bogotá, evento payload.
- E2E: admin autoriza solicitud pendiente y el cliente pasa a dashboard activo.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Colisión migración con SPEC-244 | Un solo SPEC aplica la migración; el otro la espera. |
| Doble autorización | Guard por estado + transacción. |
| Fecha de fin incorrecta | Tests con duraciones fijas y TZ Bogotá. |
