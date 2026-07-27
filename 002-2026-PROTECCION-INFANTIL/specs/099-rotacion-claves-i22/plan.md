# Implementation Plan: Spec 099 — Rotación de claves filtradas + regla no-secretos (I-22)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

> Backfill documental (cola 002-PI-025, B2): plan reconstruido a partir del spec.md y el
> cierre.md. Documenta lo hecho.

## Summary

Rotación urgente de `ENCRYPTION_KEY` y `PARAM_ENCRYPTION_KEY` de producción, expuestas en
el cierre de la SPEC-097 (commit `b9295f29`) y en el chat. Valores nuevos generados en el
propio VPS (nunca por chat/git), entrega al CEO por canal seguro (archivo local 600 fuera
de git), BD de prod re-sembrada limpia (solo datos de prueba), scrub del cierre con puntero
al INVENTARIO-DE-SECRETOS, decisión de NO reescribir el historial (rama compartida: la
rotación mata las claves) y regla dura permanente en AGENTS.md.

## Diseño (lo que se hizo)

1. **FR-001 (rotación)**: valores nuevos (`openssl rand -base64 32`) generados EN el VPS y
   escritos directamente en `.env.production` (formato válido del parser: base64-32B o
   32 chars UTF-8, NO hex). Copia al CEO por canal seguro: archivo local con permisos 600
   fuera de git (`~/Documents/SECRETOS-CEO/`), temporal del VPS eliminado. Los valores nunca
   aparecieron en el chat ni en git.
2. **FR-002 (BD limpia)**: `docker compose down -v` (volumen `pi_postgres_data` eliminado —
   solo datos de prueba) + `up` + `migrate deploy` (50 migraciones) + `db seed`. Lo cifrado
   con las claves viejas dejó de existir.
3. **FR-003 (scrub)**: `specs/097-.../cierre.md` sin valores; puntero al inventario + nota
   de rotación. Verificación `git grep` = 0 coincidencias en el árbol.
4. **FR-004 (historial) — decisión**: NO reescribir. Los valores viven solo en el blob de
   `b9295f29`; reescribir exige force-push de rama compartida (rompe a otros frentes) y las
   claves ya están muertas. Registrado en el inventario (v1.2) para decisión al liberar a
   `main`.
5. **FR-005 (regla dura)**: `AGENTS.md` §Seguridad — nunca valores de secretos en commits,
   cierres, specs, docs ni chat; siempre puntero al inventario; valores solo en `.env`
   (fuera de git) + gestor del CEO. Misma nota en INVENTARIO-DE-SECRETOS (v1.2).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Claves nuevas por el chat/git | Generación en el VPS + transferencia por scp a archivo 600; nunca impresas |
| Datos cifrados ilegibles tras rotar | BD de prod solo tenía datos de prueba → re-seed limpio autorizado |
| Formato de clave inválido (el parser no acepta hex) | `openssl rand -base64 32` (válido por diseño del parser) |

## Pruebas

- E2E con claves nuevas: reporte `RPT-E0HH36` cifrado al insertar, descifrado y clasificado
  en prod (33 s vía Ollama Mac). Healthcheck OK. Gate en la Mac (lint+test+tsc+build).
