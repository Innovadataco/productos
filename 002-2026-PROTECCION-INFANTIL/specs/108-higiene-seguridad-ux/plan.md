# Implementation Plan: SPEC-108 — Higiene de seguridad y UX

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

## Summary

Tres fixes con diagnóstico ya cerrado por ZEUS (cola 025, B4): acceso visible a
`/cambiar-password` desde todos los roles, eliminación del `scorePromedio` que la API
pública seguía exponiendo (D-10/§1.3/§1.5), y corrección del rate-limit para que el
fail-closed de la SPEC-103 sobreviva a una caída de Postgres en la lectura de parámetros.

## Diseño (implementado tal cual)

1. **I-33**: entrada "Cambiar contraseña" en el dropdown del `NavHeader` (todos los roles),
   en `ColegioNav` (junto a "Cerrar sesión") y en `AdminNav` (bloque inferior fijo con
   icono propio). La página `/cambiar-password` y el enforcement (SPEC-100) no se tocan.
2. **I-29**: fuera el campo de la respuesta, el `aggregate` de `IdentificadorReportado` que
   lo promediaba y el assert viejo; test nuevo exige ausencia (`toBeUndefined` +
   `JSON.stringify` sin `scorePromedio`).
3. **O-1**: `getScopeConfig(scope)` movido DENTRO del `try` de `checkRateLimit`; el `catch`
   deja de usar `config`/`resetAt` de la zona feliz y usa `getScopeDefaults(scope)`
   (sincrónico, sin BD) para headers, limit y Retry-After. `getSpamThreshold` sigue dentro
   del try (rama soft). Test nuevo: `parametroSistema.findUnique` rechaza → `seguimiento`
   responde `allowed:false`, `remaining:0`, `Retry-After`, sin lanzar.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Otros scopes cambian de comportamiento ante fallo | El catch sigue fail-open para no-FAIL_CLOSED con defaults sincrónicos; test existente lo cubre |
| Algo más lee scorePromedio | grep: la UI pública ya no lo consumía desde SPEC-101 |
