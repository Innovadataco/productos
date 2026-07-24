# Implementation Plan: Spec 093 — Coherencia del padre autenticado

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Aplicar al padre autenticado las decisiones ya hechas para el público: el círculo de confianza cuenta solo reportes aprobados, Mis reportes oculta SPAM/OTRO, se eliminan tipos muertos con score/riesgo y la navegación del área del padre deja de exponer el RPT en la URL.

## Diseño

- **US1**: `src/lib/circulo-confianza.ts` — 3 sitios Prisma (`obtenerVistaAgregada`, `determinarEstadoContacto`, detalle por identificador) pasan de `estado in ESTADOS_VISIBLES + eliminado:false` a `whereReporteAprobado()` (misma fuente única que consulta/scoring/dashboard).
- **US2**: `MisReporteDetalle` — lista de conductas filtrada (sin SPAM/OTRO); vacía → "No se identifica riesgo".
- **US3**: borrar el campo muerto `ranking: {score, nivelRiesgo}` de los 2 tipos (la forma nueva `{ totalReportes }` ya la usa `MisReportesList` desde la 091).
- **US4**: `MisReportesList` → sessionStorage para `/seguimiento`; guard `url-privacy.test.ts` con regla de área del padre (sin `/admin/`).
- **US5**: sin cambios — el dashboard ya usa `mapEstadoUsuario` (089); verificado en código.

## Tests

- Círculo: contacto con solo SPAM/OTRO → "sinReportes" (integración, si existe suite del círculo; si no, unitaria del predicado aplicado).
- Guard estructural del área del padre: 0 violaciones.
- Regresión: suite completa.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cambiar conteos del círculo rompe tests existentes | Correr suite del círculo y ajustar fixtures si asumen spam contando |
| Guard del área con falsos positivos (admin) | Exclusión explícita de `/admin/` en la regla |
