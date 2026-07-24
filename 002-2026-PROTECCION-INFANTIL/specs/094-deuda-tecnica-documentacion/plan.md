# Implementation Plan: Spec 094 — Deuda técnica y documentación

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Barrido verificado de deuda (parámetros muertos + JWT quemado), registro en `docs/deuda-tecnica.md` con las actualizaciones de apelaciones (fuera de alcance, NECESITA DECISIÓN), documentación del pipeline al día (MODELO.md v1.2 + IaDocsPanel), README regenerado y chip singular. Sin tocar código de aplicación salvo el chip.

## Pasos

1. Barrido params sembrados vs leídos (grep verificado) → hallazgos D-094-1..4.
2. `docs/deuda-tecnica.md`: sección NECESITA DECISIÓN (D-APE-1 apelaciones, D-SEV-1 gravedad), tabla de barrido (7 deudas), N5/A3 actualizados.
3. `docs/MODELO.md` → v1.2.0 post-092 + `IaDocsPanel` mismo flujo.
4. Chip singular/plural en `LandingHero` + ajuste del test existente.
5. Regenerar `specs/README.md` desde carpetas + `specs-discipline.test.ts` verde.
6. Gate completo + commit/push (staging explícito 002).

## Fuera de alcance (explícito)

Apelaciones (solo documentar), terna/umbral del motor, specs 017/053, infraestructura de producción, modelo por defecto, ADR_006.
