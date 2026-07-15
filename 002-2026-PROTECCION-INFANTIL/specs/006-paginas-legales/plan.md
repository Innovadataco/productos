# Implementation Plan: Páginas Legales y Footer

**Branch**: `feature/006-paginas-legales` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-paginas-legales/spec.md`

## Summary

Crear páginas estáticas de términos y privacidad, implementar un footer reutilizable y añadirlo a las páginas públicas.

## Technical Context

**Language/Version**: TypeScript 5.8 / Next.js 16.2 / React 19

**Primary Dependencies**: Next.js App Router, Tailwind CSS

**Storage**: N/A

**Testing**: Playwright (E2E)

**Target Platform**: Web application

## Project Structure

### Documentation

```text
specs/006-paginas-legales/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/requirements.md
```

### Source Code

```text
src/
├── app/
│   ├── terminos/page.tsx
│   └── privacidad/page.tsx
└── components/modules/
    └── LandingFooter.tsx
```

## Constitution Check

- No se añaden dependencias.
- No se modifica el schema de base de datos.
- Solo contenido estático y un componente UI.
