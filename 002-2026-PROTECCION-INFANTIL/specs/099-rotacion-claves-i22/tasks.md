# Tasks — Spec 099: Rotación de claves filtradas + regla no-secretos (I-22)

> Backfill documental (cola 002-PI-025, B2): tareas ejecutadas, reconstruidas del cierre.md.
> Todas completadas (2026-07-27).

- [x] T001 FR-001: generar `ENCRYPTION_KEY` y `PARAM_ENCRYPTION_KEY` nuevas EN el VPS (`openssl rand -base64 32`) y escribirlas en `.env.production` sin pasar por chat/git.
- [x] T002 FR-001: entrega al CEO por canal seguro (archivo local 600 fuera de git en la Mac; temporal del VPS eliminado).
- [x] T003 FR-002: re-sembrar la BD de prod limpia (`down -v` + `migrate deploy` + `db seed`); verificar healthcheck.
- [x] T004 FR-002/verificación: E2E con claves nuevas — reporte de prueba cifrado al insertar, descifrado y clasificado (`RPT-E0HH36`).
- [x] T005 FR-003: scrub de `specs/097-despliegue-hibrido-produccion/cierre.md` (puntero al INVENTARIO-DE-SECRETOS + nota de rotación) + verificación `git grep` (0 coincidencias).
- [x] T006 FR-004: decisión documentada de NO reescribir el historial (rama compartida; claves muertas) + registro en inventario v1.2.
- [x] T007 FR-005: regla dura no-secretos en `AGENTS.md` §Seguridad + nota de rotación en INVENTARIO-DE-SECRETOS (repo de gestión).
- [x] T008 Gate (lint+test+tsc+build) + `cierre.md` + commits (`58b2237b` scrub+regla, `fa8d0324` docs 099) + push.
