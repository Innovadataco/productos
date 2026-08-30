# Implementation Plan: Hotfix — link-bi redirect usa host público real

**Branch**: `work/pi-SPEC-313-hotfix-link-bi-host` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

## Summary

`route.ts` (endpoint `/api/auth/link-bi`) usa `request.url` como base del redirect a `/login` cuando no hay sesión válida; dentro de Docker eso resuelve al bind interno (`0.0.0.0:3000`), no al host público. Fix: construir la base con `x-forwarded-host`/`x-forwarded-proto` → fallback `PI_BASE_URL` → fallback hardcode `https://pi.innovadataco.com`.

## Technical Context

**Language/Version**: TypeScript 5, Next.js App Router (mismo endpoint de SPEC-310)
**Constraints**: Cero cambio al segundo redirect (BI) ni al contrato JWT · cero librería nueva · solo `route.ts` + `.env.example` + tests

## Constitution Check

Fix de infraestructura de auth, no toca principios de producto ni técnicos del constitution.md. Gate: PASA.

## Decisión de diseño (única)

Prioridad de resolución de host: `x-forwarded-host`+`x-forwarded-proto` (caso real: proxy Cloudflare/Traefik en prod) → `PI_BASE_URL` env (caso tests/dev sin proxy) → hardcode `https://pi.innovadataco.com` (última garantía, nunca `0.0.0.0`). Exactamente el diseño ya autorizado por CEO IDC en el instructivo — sin alternativas evaluadas dado el alcance de hotfix express.

## Project Structure

```text
src/app/api/auth/link-bi/route.ts       # MODIFICADO — helper de base URL para el redirect a /login
src/app/api/auth/link-bi/route.test.ts  # MODIFICADO — 3 casos nuevos + assert defensivo "nunca 0.0.0.0"
.env.example                             # MODIFICADO — + PI_BASE_URL
specs/313-hotfix-link-bi-host/           # spec.md · plan.md · tasks.md · checklists/
```
