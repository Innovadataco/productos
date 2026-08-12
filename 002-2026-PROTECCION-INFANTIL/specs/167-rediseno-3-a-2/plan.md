# Implementation Plan: SPEC-167 — Rediseño 3→2: Inicio + Estadísticas, eliminar Tablero

**Branch**: `work/002-pi-167` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

---

## Summary

Consolidar el módulo Colegio en dos pantallas. El **Inicio** (`/dashboard/colegio`) absorbe el embudo "te esperan a ti" del Tablero y se consolida como radar operativo. **Estadísticas** (`/dashboard/colegio/estadisticas`) pasa a ser inteligencia del colegio: tendencia, desglose por curso, patrones, comparativa, reloj 24 h y conteo de profesores. El **Tablero** (`/dashboard/colegio/tablero`) se elimina, se redirige a Inicio y se retira del menú lateral.

No hay cambios de schema: se reutilizan `ColegioResumenRepository`, `calcularEstadisticasColegio`, `obtenerPatronesColegio`, `calcularComparativaCursos` y los métodos de `AlertaColegioRepository`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, Tailwind CSS 3.4, Recharts 3.10.1 |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Multi-tenant** | `colegioId` obligatorio en todas las lecturas (DAL E-1 / SPEC-134) |
| **Transaction boundary** | `withUnitOfWork` si se requieren operaciones que toquen varias entidades (no se esperan en este rediseño) |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | El rediseño solo muestra agregados de texto/números |
| §1.3 Presunción de inocencia | ✅ Pass | Lenguaje descriptivo/estadístico; sin veredictos |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §2.4 Modelo SaaS | ✅ Pass | Todo colegio-scoped |
| §3.1 TypeScript strict | ✅ Pass | Sin `any`; tipos de Prisma y DTOs |
| §3.5 Logs y auditoría | ✅ Pass | Se mantienen acciones de audit existentes |
| §4.1 Singletons | ✅ Pass | Reusa `prisma` singleton |
| §4.2 Rutas API individuales | ✅ Pass | Un `route.ts` por endpoint |
| I-49 Migraciones aditivas | ✅ Pass | No hay migración; reorganización UI/DTOs |

---

## Project Structure

### Documentation (this feature)

```text
specs/167-rediseno-3-a-2/
├── spec.md
├── plan.md
├── data-model.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── dashboard/colegio/
│   │   ├── page.tsx                         # MODIFICA: radar operativo + embudo
│   │   ├── estadisticas/
│   │   │   ├── page.tsx                     # MODIFICA: server fetch de inteligencia
│   │   │   └── ColegioEstadisticasPageClient.tsx  # REEMPLAZA: inteligencia del colegio
│   │   └── tablero/
│   │       ├── page.tsx                     # REEMPLAZA: redirect a /dashboard/colegio
│   │       └── TableroClient.tsx            # ELIMINA
│   └── api/colegio/estadisticas/
│       └── route.ts                         # MODIFICA: DTO ampliado
├── components/modules/colegio/
│   ├── home/
│   │   ├── EmbudoEstado.tsx                 # NUEVO (mueve lógica desde tablero/)
│   │   ├── HomeRectorPage.tsx               # MODIFICA: renderiza EmbudoEstado
│   │   └── (resto existente)
│   ├── estadisticas/
│   │   ├── RelojActividad.tsx               # NUEVO (mueve desde tablero/)
│   │   ├── RitmoMensual.tsx                 # NUEVO (mueve/fusiona desde tablero/)
│   │   ├── BarrasPorCurso.tsx               # NUEVO (mueve/fusiona desde tablero/)
│   │   ├── SeccionPatrones.tsx              # NUEVO: wrapper de patrones
│   │   ├── SeccionComparativa.tsx           # NUEVO: wrapper de comparativa
│   │   └── TablaDesgloseCursos.tsx          # NUEVO/ajusta: desglose por curso con profesores
│   └── tablero/                             # ELIMINA carpeta
│       ├── EmbudoEstado.tsx
│       ├── RelojActividad.tsx
│       ├── RitmoMensual.tsx
│       └── BarrasPorCurso.tsx
├── lib/
│   ├── dal/repositories/colegio-resumen.ts  # MODIFICA: homeRector incluye embudo
│   ├── colegio/estadisticas.ts              # MODIFICA: EstadisticasInteligenciaColegio
│   └── nav-items.ts                         # MODIFICA: quita Tablero
└── docs/architecture/                       # REGENERA: 03-pantallas.md, 04-rutas-api.md
```

---

## Fases

1. **Backend: ampliar DTOs y servicios**
   - Ampliar `ColegioResumenRepository.homeRector` con `embudo` reutilizando `AlertaColegioRepository.embudoPorReporte`.
   - Ampliar `calcularEstadisticasColegio` o crear `calcularInteligenciaColegio` que devuelva `EstadisticasInteligenciaColegio` con totales, porCurso, profesores, tendencia (semanal/mensual/anual), reloj24h, patrones y comparativa.
   - Actualizar `GET /api/colegio/estadisticas/route.ts` para devolver el DTO ampliado.
   - Tests de integración A/B, sin PII, sin N+1.

2. **Frontend: Inicio como radar operativo**
   - Crear `src/components/modules/colegio/home/EmbudoEstado.tsx` (mover/ajustar desde `tablero/EmbudoEstado.tsx`).
   - Modificar `HomeRectorPage.tsx` para mostrar el embudo debajo del héroe de semáforo.
   - Modificar `src/app/dashboard/colegio/page.tsx` si es necesario para pasar el embudo al cliente.

3. **Frontend: Estadísticas como inteligencia**
   - Reemplazar `ColegioEstadisticasPageClient.tsx` con la nueva pantalla de inteligencia.
   - Mover `RelojActividad`, `RitmoMensual` y `BarrasPorCurso` a `components/modules/colegio/estadisticas/`.
   - Crear `SeccionPatrones`, `SeccionComparativa` y `TablaDesgloseCursos`.
   - Rotular aparte el dashboard público global al final de la página o como enlace separado.

4. **Eliminar Tablero**
   - Reemplazar `src/app/dashboard/colegio/tablero/page.tsx` por redirect a `/dashboard/colegio`.
   - Eliminar `src/app/dashboard/colegio/tablero/TableroClient.tsx` y la carpeta `src/components/modules/colegio/tablero/`.
   - Quitar "Tablero" de `src/lib/nav-items.ts`.
   - Actualizar tests de navegación si fallan.

5. **Auditoría y arquitectura**
   - Regenerar artefactos de arquitectura (`npm run arch:check` en verde).
   - Verificar que acciones de audit existentes sigan disparándose (PDF, comparativa Excel).

6. **Integración**
   - Gate completo: `tsc --noEmit`, `lint`, `tokens:check`, `arch:check`, `test`, `build`.
   - Commit, push a `work/002-pi-167`, PR a `feature/001-scaffolding`.

---

## Decisions & Risks

| Decision | Rationale | Risk / Mitigation |
|----------|-----------|-------------------|
| Inicio absorbe el embudo; Estadísticas absorbe reloj 24 h, ritmo y barras | Respeta el brief §6: radar vs. inteligencia. | Mitigación: reutilizar componentes existentes; no reescribir lógica de agregación. |
| Redirigir `/dashboard/colegio/tablero` a `/dashboard/colegio` | El valor principal del tablero (embudo) vive en Inicio. | Riesgo: enlaces guardados. Mitigación: redirect 308 y actualización de menú. |
| Rotular aparte el dashboard público global en vez de eliminarlo | No perder el contexto nacional; cambio mínimo. | Riesgo: confusión. Mitigación: título explícito "Mapa de reportes a nivel país" y separación visual. |
| No modificar schema ni `Curso`/`Estudiante.cursoId` | Restricción del brief y SPEC-162. | Ninguno; todos los datos ya existen. |
| Reutilizar endpoints de patrones y comparativa existentes | Evita duplicar lógica de negocio y k-anonimato. | Riesgo: doble fetch en cliente. Mitigación: server fetch en `page.tsx` y pasar datos al cliente. |

---

## Acceptance Mapping

| FR | Tests principales |
|----|-------------------|
| FR-001 / FR-002 / FR-003 | `src/lib/dal/repositories/colegio-resumen.test.ts` (embudo en home, A/B, N+1), render de `HomeRectorPage` |
| FR-004 / FR-005 / FR-006 / FR-007 / FR-008 | `src/app/api/colegio/estadisticas/route.test.ts` (DTO ampliado), tests de componentes de estadísticas |
| FR-009 / FR-010 / FR-011 | Test de redirect de `/dashboard/colegio/tablero`, test de `nav-items.test.ts` |
| FR-012 / FR-013 / FR-014 | Test de no PII, test de no cambios en schema, grep de no tocar `src/lib/ai/**` |
| FR-015 / FR-016 | `a11y:audit`, `tokens:check`, `arch:check` |
