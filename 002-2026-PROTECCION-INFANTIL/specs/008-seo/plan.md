# Implementation Plan: SEO y Metadatos

**Branch**: `feature/008-seo` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-seo/spec.md`

## Summary

Configurar metadatos estáticos y dinámicos por página, canonical URLs, OpenGraph, `robots.txt` y `sitemap.xml` usando las APIs de Next.js 16.

## Technical Context

**Language/Version**: TypeScript 5.8 / Next.js 16.2

**Primary Dependencies**: Next.js metadata API

**Storage**: N/A

**Testing**: Playwright (E2E para meta tags), Lighthouse opcional

**Target Platform**: Web application

## Project Structure

### Documentation

```text
specs/008-seo/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/requirements.md
```

### Source Code

```text
src/
├── app/
│   ├── layout.tsx          # viewport + metadata base
│   ├── page.tsx            # metadata landing
│   ├── reportar/page.tsx   # metadata reportar
│   ├── seguimiento/page.tsx# metadata seguimiento
│   ├── terminos/page.tsx   # metadata términos
│   ├── privacidad/page.tsx # metadata privacidad
│   ├── offline/page.tsx    # metadata offline
│   ├── robots.ts           # robots.txt
│   └── sitemap.ts          # sitemap.xml
```

## Constitution Check

- No se añaden dependencias externas.
- No se modifica schema de base de datos.
- Solo se tocan archivos de metadata y páginas estáticas.
