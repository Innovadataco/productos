# Checklist de validación — 009 Configuración: Empresas y Usuarios

**Estado**: ✅ COMPLETO · **Fecha**: 2026-07-23 · **Radicado cierre**: 003-SICOV-007

## Migración y datos (B1)
- [X] Migración `--create-only` revisada A MANO; `@@unique` retirado; DOS índices únicos PARCIALES creados (`ux_usmod_completo WHERE submodulo IS NULL`, `ux_usmod_submodulo WHERE submodulo IS NOT NULL`) — verificados en `pg_indexes`.
- [X] Columna aditiva `usm_submodulo_id` (nullable) + FK ON DELETE CASCADE. Aplicada a dev y test.
- [X] Seed de `configuracion` + submódulos resueltos POR NOMBRE (nunca id serial); secuencia realineada.

## Cascada y guard (B2 / D-015 / D-017)
- [X] Exclusión completo↔submódulo materializada server-side (delete-por-módulo → fila NULL o N submódulos, nunca ambas).
- [X] Subconjunto validado contra el OTORGANTE (personal `UsuarioModulo` o, si no tiene, módulos del ROL como completos).
- [X] rol 3 nunca recibe el módulo `usuarios`; rol 2 solo ve/edita usuarios de su NIT (404 ajeno).
- [X] Guard `requiereModulo(u, "mantenimientos", "preventivos"|"correctivos")` aplicado a rutas + carga masiva.
- [X] **Verificado EN VIVO**: operador solo-preventivos → 403 en correctivos, 201 en preventivos (`scripts/verificar-cascada.sh` 12/0).

## Seguridad y secretos (§1.3 / G1 / G2 / G3)
- [X] G1: test anti-Super — cero peticiones a `*.supertransporte.gov.co` en los flujos de alta (FR-008/D-044).
- [X] G2: token de empresa único server-side (no índice; `tpv_token` es nullable) → 409; token validado como UUID (`@db.Uuid`) → 400 si inválido, autogenerado si ausente.
- [X] G3: NIT único por `usn_identificacion @unique` → 409.
- [X] `RESEND_API_KEY`/`CORREO_REMITENTE` solo en `.env.example`; la clave temporal nunca se loguea.

## Correo (D-048)
- [X] Interfaz única `getCorreo()`; stub sin key, Resend (fetch) con key; `recuperar` refactorizado.
- [X] Envío SIEMPRE fuera de la transacción de alta; fallo de Resend no revierte datos.

## Regla de Oro (§1.5) y calidad
- [X] Script de reinicio limpio (`npm run reiniciar`) — mata por PID+cwd, `prisma generate`, healthcheck 200.
- [X] Set Spec-Kit: spec, plan, research, data-model, quickstart, checklists, tasks. 
- [X] `npm test` 175/175 · `tsc --noEmit` · `lint` · `build` verdes.
