# Implementation Plan: SPEC-315 · Fix reset password flag

**Branch**: `work/pi-SPEC-315-fix-reset-password-flag` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

## Summary

Añadir `debeCambiarPassword: false` al `actualizar` del método `restablecerPassword` en `autenticacion.ts`, replicando el patrón ya presente en `cambiarPassword` (:157). Cierra la asimetría que dejaba a usuarios en loop percibido tras un reset por email. 1 línea de código + comentario + tests.

## Technical Context

**Language/Version**: TypeScript 5 strict, Node ≥ 22, Prisma 5.22.0.
**Storage**: PostgreSQL — modelo `Usuario` existente, campo `debeCambiarPassword` ya presente. Cero migración.
**Testing**: Vitest integración con `resetDatabase()` + fábricas. Nuevo `autenticacion.test.ts` (no existe hoy).
**Constraints**: solo se toca `restablecerPassword`; el resto de callsites de `debeCambiarPassword` intactos (candado 22 v5). Cero cambio a rutas, guards, formularios, schema.
**Scale/Scope**: 1 archivo de código + 1 test + spec-kit.

## Constitution Check

| Sección | Veredicto |
|---|---|
| §1 Producto | ✅ PASS trivial (no toca contenido/IA/consulta) |
| §2 Stack | ✅ PASS (reutiliza Prisma + Vitest) |
| §3 Calidad TS | ✅ PASS (1 línea tipada, sin `any`) |
| §4 Arquitectura/persistencia | ✅ PASS (DAL service existente, cero migración) |
| §5 Testing | ✅ PASS (test integración con caso principal + regresiones) |
| §6 Seguridad | ✅ PASS con nota — el fix mejora la seguridad UX (el usuario ya eligió su clave definitiva; no lo fuerza a un cambio redundante). No debilita el reset administrativo. |
| §7 UI | N/A (sin UI) |
| §8 Proceso | ✅ PASS (lint + test + build antes de PR; `npm run test` completo por aprendizaje SPEC-314) |

Sin violaciones.

## Project Structure

```text
002-2026-PROTECCION-INFANTIL/
├── src/lib/dal/services/
│   ├── autenticacion.ts             # MODIFICADO — +1 línea en restablecerPassword
│   └── autenticacion.test.ts        # NUEVO — test integración del fix + regresiones
└── specs/315-fix-reset-password-flag/  # docs de esta spec
```

**Rutas prohibidas**: `src/lib/ai/**`, `prisma/**`, `deploy-prod.sh`, `.github/workflows/**`, todos los callsites que escriben `true`, `cambiar-password/page.tsx`, `proxy.ts`, guards.

**Structure Decision**: fix mínimo en el DAL service existente. Test nuevo porque no había cobertura de `restablecerPassword` (deuda preexistente que este fix cierra parcialmente).

## Complexity Tracking

Sin violaciones. Tabla vacía.
