# Checklist de requisitos — Spec 086

**Spec**: `specs/086-navegacion-gobernada-permisos/spec.md` · **Verificado**: 2026-07-23

## Correcciones de ZEUS al mapeo

- [x] Corrección 1: fusión con semántica AND (nadie gana permisos); restringidos listados en cierre.md (ninguno en dev).
- [x] Corrección 2: `revision_spam` denegado por defecto; backfill solo desde `anti_abuso`.
- [x] Corrección 3: tabs del Centro IA filtradas por submódulo (no diferidas).
- [x] Vacío 4: aterrizaje definido (redirect al primer módulo permitido / "Sin módulos asignados") + escenario en quickstart.

## Requisitos

- [x] FR-001: layout server resuelve módulos permitidos; sin endpoint nuevo.
- [x] FR-002: cero `roles:[...]` en navegación (AdminNav, ColegioNav, ComiteSubNav por `modulo`).
- [x] FR-003: helper de guard de página + pantalla "Sin acceso a este módulo".
- [x] FR-004: catálogo alineado a lo visible (`revision_spam` nuevo; fusión bandeja).
- [x] FR-005: nadie gana permisos; pérdidas reportadas (AND; restringidos listados).
- [x] FR-006: test estructural + tests de nav y guard.
- [x] FR-007: tabs IA por submódulo.
- [x] FR-008: aterrizaje implementado.
- [x] FR-009: modelo de permisos y anti-lockout de la 019 intactos.

## Prueba del CEO (quickstart)

- [x] Ítem desaparece del menú al desactivar / vuelve al reactivar.
- [x] URL directa → "sin acceso", no error de carga.
- [x] Spam funciona cuando está activa.
- [x] Aterrizaje sin módulos: pantalla explícita.

## Cierre

- [x] Gate completo + app en `:5005`.
- [ ] Validación funcional del CEO — PENDIENTE.
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.
