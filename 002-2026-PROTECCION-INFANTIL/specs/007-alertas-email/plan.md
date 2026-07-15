# Implementation Plan: Alertas por Email

**Branch**: `feature/007-alertas-email` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-alertas-email/spec.md`

## Summary

Extender `src/lib/email.ts` con dos funciones de alerta administrativa, integrarlas en el procesamiento de reportes y añadir parámetros de sistema para activar/desactivar cada alerta.

## Technical Context

**Language/Version**: TypeScript 5.8 / Next.js 16.2

**Primary Dependencies**: Resend (`resend`), Prisma (`@prisma/client`)

**Storage**: PostgreSQL 16 (`ParametroSistema`, `Usuario`)

**Testing**: Vitest (unit), Playwright (E2E)

**Target Platform**: Web application

## Project Structure

### Documentation

```text
specs/007-alertas-email/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/requirements.md
```

### Source Code

```text
src/
├── lib/email.ts                    # Nuevas funciones de alerta
└── app/api/reportes/procesar/route.ts  # Llamadas a alertas

prisma/seed.ts                      # Parámetros por defecto
```

## Constitution Check

- No se introducen nuevas dependencias.
- No se modifica el schema de Prisma.
- Se reutiliza la infraestructura de email existente.
