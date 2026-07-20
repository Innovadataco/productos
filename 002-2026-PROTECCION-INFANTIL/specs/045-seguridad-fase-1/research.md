# Research: Seguridad Fase 1 — Saneamiento de Auth

**Date**: 2026-07-20
**Feature**: specs/045-seguridad-fase-1/spec.md

---

## Decisions

### D1: Reutilizar `checkRateLimit` existente

**Decision**: Usar el utilitario `src/lib/rate-limit.ts` con sus scopes configurables en lugar de crear un nuevo limitador.

**Rationale**: El proyecto ya tiene una implementación basada en PostgreSQL con ventanas fijas, limpieza periódica, fallback abierto ante fallos y soporte para identificadores personalizados. Reutilizarla minimiza cambios y deuda técnica.

**Components**:
- `checkRateLimit(request, scope)` para capa por IP.
- `checkRateLimit(request, scope, { identifier: email })` para capa por email.
- Scopes nuevos: `recuperar_solicitar` y `verificacion_solicitar`.

### D2: No alterar lógica de negocio ni mensajes de éxito

**Decision**: El rate limit y la validación Zod se insertan al inicio de cada handler, sin modificar el resto del flujo.

**Rationale**: Mantener el comportamiento observable para el usuario final y evitar regresiones en los flujos de registro, recuperación y verificación. Los mensajes de éxito y las respuestas uniformes se preservan.

### D3: Zod como librería de validación

**Decision**: Usar Zod 4.4.3 para los tres endpoints públicos indicados, centralizando esquemas en `src/lib/validators.ts`.

**Rationale**: La constitución (§6.2) establece la migración a Zod como meta. Centralizar los esquemas permite reutilización futura y testing unitario aislado. Zod ya está en `package.json`.

**Components**:
- `authRegisterSchema`
- `recuperarSolicitarSchema`
- `restablecerPasswordSchema`

### D4: Rate limit por IP + identificador

**Decision**: Aplicar rate limit primero por IP y luego por email (identificador).

**Rationale**: Mitiga tanto ataques masivos desde una IP (ej. botnet) como abuso de un email específico desde múltiples IPs. La respuesta uniforme evita enumeración de cuentas.

### D5: Plan de borrado seguro sin implementación

**Decision**: Documentar el plan completo del derecho al olvido en `plan.md` sin crear migraciones, modelos, endpoints ni UI.

**Rationale**: El alcance del Spec 045 es saneamiento de autenticación. El borrado seguro impacta múltiples módulos y requiere análisis legal y de UX antes de tocar datos. Se entrega el diseño para que un spec posterior lo ejecute.

---

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Nuevo limitador en Redis | Prohibido por constitución (sin Redis) y duplicaría funcionalidad existente |
| Rate limit solo por IP | No mitiga abuso de un email desde múltiples IPs |
| Rate limit solo por email | No mitiga ataques masivos desde una sola IP |
| Validación manual en lugar de Zod | Contradice la meta de la constitución §6.2 |
| Implementar borrado seguro en esta fase | Excede el alcance y requiere cambios de schema y aprobación legal |
| Incluir `verificar/validar` y `verificar/completar` en US2 | Mantienen validación manual adecuada; se deja para estandarización posterior |

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. Scope is limited to rate limit + Zod + plan de borrado seguro, without touching SPEC-050 or SPEC-060.
