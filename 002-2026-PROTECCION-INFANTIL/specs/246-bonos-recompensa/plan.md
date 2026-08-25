# Implementation Plan: Bonos recompensa transferibles + MisCuponesCard

**Branch**: `work/002-PI-mega-cobros` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-149 · BRIEF-ACTIVACION-Y-COBROS §3/§6.1/§6.3/§8/§10/§11

---

## Summary

Extender `BonoPromocional` para cupones de recompensa generados automáticamente tras el primer pago de un padre. Incluye componente `MisCuponesCard` y aplicación transferible en checkout.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Next.js 16.2.10, Prisma 5.22.0, `date-fns-tz`, Tailwind |
| **UI** | Padre = `cielo`; estados `rubi`/neutro |
| **Testing** | Vitest + Playwright |
| **Constraints** | Sin módulo Cupones nuevo; sin rutas paralelas; migraciones aditivas |

---

## Implementation Steps

### Phase 1 — Schema
1. Extender `BonoPromocional` con `origen`, `beneficiarioUsuarioId`, `transferible`.
2. Crear enum `OrigenBono`.
3. Migración aditiva.

### Phase 2 — Repositorios y servicios
4. Extender `bono-promocional-repository.ts`.
5. Crear `entregar-cupones-recompensa.service.ts`.
6. Generar códigos `CUP-XXXXXX` con retry de unicidad.

### Phase 3 — Trigger
7. Registrar listener/callback en el flujo de autorización de SPEC-245: si `plan.esFreemium=false`, rol PARENT, primera entrega.

### Phase 4 — UI
8. Crear `MisCuponesCard`.
9. Integrar en `/dashboard/padre/suscripcion`.
10. Agregar filtro `origen` en admin `/dashboard/admin/bonos` (solo lectura).

### Phase 5 — Aplicación
11. Verificar/ajustar `AplicarBonoCard` / servicio de aplicación para soportar `transferible`.

### Phase 6 — Seed/eventos
12. Sembrar parámetros `pagos.recompensa.*`.
13. Sembrar regla/plantilla `bono.entregado_recompensa`.

### Phase 7 — Tests y gate
14. Tests: unicidad, idempotencia, freemium no dispara, transferible.
15. Gate local.

---

## Test Strategy

- Unitarios: generación de códigos, cálculo vigencia.
- Integración: entrega, idempotencia, aplicación transferible.
- E2E: padre recibe cupones y los ve en `MisCuponesCard`.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Colisión de códigos | Retry + unique constraint. |
| Disparo duplicado | Guard "ya recibió recompensa" en servicio. |
| Aplicación no soporta transferible | Ajustar servicio de aplicación con check de `transferible`. |
