# SPEC-001 · Scaffolding Next.js + Auth JWT compartido

> **Estado:** 🟢 REALIZADO · esperando auditoría Fábrica
> **Origen:** BI · INSTRUCTIVO-001 · BI · A-01

## §1 · Objetivo

Proyecto Next.js base del BI con auth JWT compartida con PI (jose), estructura src/ mínima, UI de PI copiada, 4 ratchets, CI bi.yml, verificación en vivo OK.

## §2 · Fuentes verificadas (candado 15)

- PI usa `Inter` + `DM_Mono` (no Instrument Sans — INSTRUCTIVO tenía error · confirmado por Fábrica)
- next@16.2.10 · jose@^6.0.10 · react@19.2.4 verificados en PI package.json
- Sin worktree separado: feature/bi-scaffolding ya checkeada en clone principal · sin paralelismo activo

## §3 · Candados activos

| Candado | Aplicación |
|---|---|
| 1 | LLM solo via src/lib/bi/motor.ts · ratchet 3 enforza |
| 11 | JWT valida rol ADMIN · solo ADMIN pasa en Fase 1 |
| 14 | curl /api/health + navegación verificados antes de REALIZADO |
| 15 | Versiones y fonts verificados en fuente PI |

## §4 · Decisiones

- D-01-BI: Inter+DM_Mono confirmado por Fábrica
- D-02-BI: sin worktree separado (sin paralelismo)
- D-03-BI: ThemeProvider stub mínimo (sin AuthContext ni ServiceWorkerRegister de PI)
- D-04-BI: PORT=3001 en .env.bi.example

## 📋 Control

| Campo | Valor |
|---|---|
| SPEC | SPEC-001 |
| F3C | 2026-08-28 COT |
| Autor | Desarrollo D-2 (Claude) |
| Estado | 🟢 REALIZADO |
