# Implementation Plan: SPEC-146 — Wizard unificado

**Branch**: `work/002-pi-058` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/146-wizard-curso-unificado/spec.md`

## Summary

Wizard de una pantalla (mockup §5.3/§5.4) que crea curso + estudiantes +
identificadores con un guardado atómico (`POST /api/colegio/cursos/unificado` con
`withUnitOfWork`), dry-run de Excel sin persistir (`/validar`), primitivo
`Accordion` nuevo con test de accesibilidad, y redirects de `cursos/nuevo` y
`cursos/carga` (nav → "Subir lista"). Los endpoints API existentes no se tocan
(los consume `cursos/[id]` hasta SPEC-147).

## Technical Context

**Language/Version**: TypeScript 5 (strict) · Node.js >= 22
**Primary Dependencies**: Next.js 16.2.10 · Prisma 5.22.0 · Zod · Tailwind tokens
(SPEC-157) · Vitest + Testing Library
**Storage**: PostgreSQL — sin cambio de schema (usa Estudiante/AcudienteEstudiante/
Profesor/Curso/IdentificadorEstudiante existentes)
**Testing**: Vitest (integración, `.env.test`) — handlers con Request nativo; A/B
tenant en cada verbo nuevo
**Target Platform**: Web mobile-first (iPad del rector)
**Performance Goals**: dry-run < ~2 s con 500 filas (pipeline existente) · guardado
atómico en 1 transacción
**Constraints**: cero color crudo (tokens) · terminología §3 · cero tests
debilitados · atomicidad total · no tocar `src/lib/ai/**` ni endpoints viejos
**Scale/Scope**: 2 endpoints nuevos + 1 primitivo ui + 1 página wizard + 2
redirects + ~8 archivos de test

## Constitution Check

- **§2.3 Multi-tenant**: todo con `colegioId` de sesión; profesor same-tenant
  validado (SPEC-145); test A/B (SC-003). ✓
- **§3.1/§3.2/§3.6 Tipado y Zod**: payload con schemas Zod; filtros Prisma tipados. ✓
- **§3.5 Auditoría**: acciones históricas `COLEGIO_*`, metadatos solamente. ✓
- **§7.2/§7.3 UI**: primitivos del sistema; Accordion nuevo con test a11y (§9 del
  brief). ✓
- **Candados brief §6/§7.4**: escritura multi-entidad = `withUnitOfWork` (FR-002);
  tenant-first E-1; no tocar motor IA; I-29. ✓

Sin violaciones.

## Project Structure

```text
src/
├── app/
│   ├── api/colegio/cursos/unificado/
│   │   ├── route.ts                    # POST (guardado atómico) + route.test.ts
│   │   └── validar/route.ts            # POST multipart (dry-run) + route.test.ts
│   └── dashboard/colegio/cursos/
│       ├── unificado/page.tsx          # wizard (server guarda + client)
│       ├── nuevo/page.tsx              # redirect → unificado
│       └── carga/page.tsx              # redirect → unificado?modo=excel
├── components/
│   ├── ui/
│   │   ├── Accordion.tsx               # NUEVO + Accordion.test.tsx (a11y)
│   └── modules/colegio/unificado/
│       ├── WizardUnificado.tsx         # client principal
│       ├── SeccionCurso.tsx            # datos + profesor (selector + "+ Nuevo")
│       ├── TablaEstudiantes.tsx        # editable inline (nombre/apellidos/doc/acudiente)
│       ├── ImportExcel.tsx             # dropzone + dry-run + vista previa §5.4
│       └── SeccionIdentificadores.tsx  # por estudiante, opcional
├── lib/
│   ├── schemas/index.ts                # + payloadUnificadoSchema
│   └── colegio/carga/                  # reuso de parser/validator (sin tocar)
└── lib/nav-items.ts                    # "Carga masiva" → "Subir lista" → wizard
```

**Structure Decision**: componentes del wizard bajo `modules/colegio/unificado/`;
el primitivo en `ui/` como los demás.

## Fases

1. **Datos**: schemas Zod del payload + endpoint unificado (atómico) + validar
   (dry-run) + tests A/B.
2. **UI**: Accordion + wizard + redirects + nav.
3. **Cierre de lote**: checks de día + tokens:check + arch:check.

## Complexity Tracking

Sin violaciones de constitución que justificar.
