# Implementation Plan: SPEC-143 — Home operativo del rector

**Branch**: `work/002-pi-058-spec-143` (PR a `feature/001-scaffolding`) | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/143-home-rector/spec.md`

## Summary

Reemplazar `/dashboard/colegio` (hoy: consulta pública + estadísticas PÚBLICAS) por
la home operativa del rector del brief §5.1/§5.2: declaración de estado con
semáforo, franja de vigilancia, KPIs del colegio, anillos de protección, tendencia
temporal (Recharts), cursos que merecen mirada, acciones rápidas y canales
oficiales — todo desde UNA llamada a `ColegioResumenRepository.homeRector(colegioId)`
y montado 100% sobre el sistema de diseño de SPEC-157. Primera pantalla real del
sistema: tokens, Instrument, `Anillo`, `PanelVidrio`, `LuzAmbiental`, `Declaracion`.

## Technical Context

**Language/Version**: TypeScript 5 (strict) · Node.js >= 22
**Primary Dependencies**: Next.js 16.2.10 (App Router, Server Components) · Prisma
5.22.0 · Tailwind 3.4 (tokens SPEC-157) · **recharts + lucide-react (nuevas)** ·
Vitest + Testing Library
**Storage**: PostgreSQL — sin cambio de schema; fuente de actividad: `AlertaColegio`
**Testing**: Vitest (integración secuencial, `.env.test`) para repo + componentes
**Target Platform**: Web mobile-first (iPad/celular del rector), temas claro/oscuro
**Project Type**: Web application
**Performance Goals**: Lighthouse mobile ≥ 90 (Perf + A11y) en la home · UNA llamada
al repo por carga · toggle de tendencia sin refetch
**Constraints**: cero color crudo (ratchet ≤ 1166) · cero N+1 · I-29 (sin scores) ·
terminología §3 · reduced-motion apaga todo · no tocar `src/lib/ai/**` ni layout/nav
**Scale/Scope**: 1 page reemplazada · 1 repo DAL nuevo · ~5 componentes de módulo
nuevos · 2 dependencias nuevas · ~6 archivos de test

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **§1.2 Solo texto / §1.3 presunción de inocencia**: la home muestra conteos
  agregados del propio colegio; cero textos de reportes, cero veredictos, lenguaje
  descriptivo ("N reportes recibidos"). ✓
- **§1.1 Canales oficiales**: `CanalesOficiales` presente en la home (FR-009). ✓
- **§2.3 Multi-tenant**: `colegioId` de sesión en cada query; test A/B (SC-001). ✓
- **§3.1/§3.2 Tipado**: DTO `HomeRector` tipado; `Prisma.AlertaColegioWhereInput`. ✓
- **§3.3/§7.3 UI**: Tailwind+tokens; primitivos `ui/` reusados (D-46). ✓
- **§5 Testing**: repo + componentes con tests nuevos; cero tests tocados. ✓
- **Candados brief §6/§9**: cero N+1 (FR-002), WCAG AA (FR-011), Lighthouse ≥ 90
  (SC-005), reduced-motion (FR-012), terminología (FR-011). ✓
- **I-29**: ningún score (FR-013). ✓

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/143-home-rector/
├── spec.md              # User Stories, FRs, D1-D3
├── plan.md              # Este archivo
├── research.md          # Fuentes de datos por bloque, regla semáforo, deps
├── data-model.md        # DTO HomeRector (sin cambio de schema)
├── quickstart.md        # Verificación manual
├── checklists/
│   └── requirements.md
└── tasks.md             # Stub — /speckit.tasks tras aprobación
```

### Source Code (repository root)

```text
src/
├── app/dashboard/colegio/page.tsx           # REEMPLAZADA (server component,
│                                            #  una llamada a homeRector)
├── components/modules/colegio/home/
│   ├── HomeRectorPage.tsx                   # composición de secciones (server)
│   ├── HeroEstado.tsx                       # Declaracion + LuzAmbiental + punto pulso
│   ├── FranjaVigilancia.tsx                 # última señal + semana + delta
│   ├── AnillosProteccion.tsx                # Anillo grande + leyenda en personas
│   ├── TendenciaReportes.tsx                # "use client" — Recharts + toggle
│   ├── CursosQueMerecenMirada.tsx           # top 3 + titular + enlace
│   ├── AccionesRapidas.tsx                  # CTAs a rutas existentes
│   └── EmptyStateColegio.tsx                # §5.2 (0 cursos)
├── lib/
│   ├── dal/repositories/
│   │   ├── colegio-resumen.ts               # NUEVO — homeRector(colegioId)
│   │   ├── colegio-resumen.test.ts          # A/B, cobertura, periodos, N+1
│   │   ├── estudiante.ts                    # + contarActivos (variante, sin
│   │   │                                    #  cambiar semántica existente)
│   │   ├── curso.ts                         # + contarActivos + titular en select
│   │   ├── profesor.ts                      # + contar
│   │   └── alerta-colegio.ts                # + conteos por periodo, series,
│   │                                        #  última señal, top por curso 30d
│   └── colegio/
│       ├── semaforo.ts                      # regla D1 (pura, testeable)
│       ├── semaforo.test.ts
│       └── fechas-humano.ts                 # "lunes 3 de agosto", "hace 12 min"
docs/architecture/06-stack.md                # REGENERADO (recharts, lucide-react)
package.json                                 # + recharts, lucide-react (fijadas)
```

**Structure Decision**: componentes de la home bajo
`src/components/modules/colegio/home/` (patrón `modules/colegio/` existente);
`TendenciaReportes` es el único client component (toggle); el resto server.

## Fase 0 — Research (ver research.md)

1. Fuente de cada bloque del mockup → query existente a extender o nueva (sin
   duplicar `calcularEstadisticasColegio`: se REUSAN los conteos del repo de
   alertas extendidos con fecha).
2. Regla del semáforo como función pura (D1).
3. Recharts en server components: el chart va en client component con datos por
   props (patrón recomendado por Next); series precalculadas en el repo.
4. `CanalesOficiales` se reusa tal cual (sus crudos ya están en el piso 1166).

## Fase 1 — Diseño

- DTO `HomeRector` en `data-model.md`.
- Contrato visual: mockups §5.1/§5.2 del brief (obligatorios) + §4.3/§4.5/§4.6.
- Verificación en `quickstart.md`.

## Fase 2 — Tasks

`/speckit.tasks` tras la aprobación de ZEUS (compuerta §4). Stub en `tasks.md`.

## Complexity Tracking

Sin violaciones de constitución que justificar.
