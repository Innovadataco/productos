# Implementation Plan: Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spec 073)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/073-ubicacion-departamentos/spec.md`

---

## Summary

Agregar el modelo `Departamento` entre `Pais` y `Ciudad` de forma aditiva, manteniendo `Ciudad.paisId` para compatibilidad. Cargar la división territorial real de Colombia (32 departamentos + Bogotá D.C.) y vincular las ciudades existentes. No se toca el modelo `Reporte`, ni los endpoints `/api/paises` y `/api/ciudades`, ni la UI de reportes. El objetivo es dejar la base de datos lista para el módulo Colegios sin regresión.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Prisma 5.22.0, PostgreSQL 16+, Next.js 16.2.10 |
| **Storage** | PostgreSQL (Docker Compose) |
| **Models affected** | `Departamento` (nuevo), `Ciudad` (columna `departamentoId` nullable), `Pais` (relación inversa) |
| **Seed affected** | `prisma/seed.ts` (ubicación) |
| **Endpoints affected** | Ninguno en esta fase; `/api/paises` y `/api/ciudades` se mantienen igual |
| **Components affected** | Ninguno en esta fase; la UI de ubicación sigue usando país→ciudad |
| **Testing** | Vitest; el suite completo debe seguir verde |
| **Constraints** | Migración aditiva, backup previo, sin `migrate reset/dev`, sin tocar `Reporte` |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | Solo datos geográficos textuales |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta consulta pública ni lenguaje de veredictos |
| §2.1 Stack heredado | ✅ Pass | Prisma + PostgreSQL; sin nuevas dependencias |
| §3.1 TypeScript strict | ✅ Pass | Modelos tipados con Prisma |
| §3.4 Códigos HTTP correctos | ✅ Pass | No se modifican endpoints |
| §4.1 Singletons | ✅ Pass | Prisma singleton sin cambios |
| §4.2 Rutas API individuales | ✅ Pass | No se crean endpoints nuevos |
| §4.5 Base de datos — convenciones Prisma | ✅ Pass | `@@index`, `@map`, IDs con `cuid()` |
| §6.3 Protección de datos sensibles | ✅ Pass | No se toca PII |
| §8.3 Antes de commit | ✅ Pass | Tests, lint, typecheck, build |

**Re-check post-design**: All gates still pass. No violations.

---

## Impact Analysis (Componentes y endpoints que usan Ciudad/País)

A continuación los ~10+ puntos de contacto verificados. Ninguno se modifica en esta fase; se documentan para garantizar no-regresión:

| # | Archivo | Uso de Ciudad/País | Riesgo | Mitigación |
|---|---------|-------------------|--------|------------|
| 1 | `src/components/modules/ReporteStepUbicacion.tsx` | Select de país → ciudad vía `/api/paises` y `/api/ciudades` | Medio (flujo de reporte crítico) | No se modifica el componente; `/api/ciudades` sigue devolviendo `id, nombre, paisId` |
| 2 | `src/components/modules/ReporteStepDetalle.tsx` | Idem al anterior | Medio | Idem |
| 3 | `src/app/api/ciudades/route.ts` | `findMany` de ciudades por `paisId` | Medio | No cambia la query; `departamentoId` no se incluye en el select de esta fase |
| 4 | `src/lib/validators.ts` (`crearReporteSchema`) | Valida `ciudad`, `pais`, `paisId`, `ciudadId` opcionales | Bajo | No se modifica el schema |
| 5 | `src/app/api/reportes/route.ts` | Guarda `pais`/`ciudad` string y `paisId`/`ciudadId` opcionales | Bajo | No se toca el modelo `Reporte` ni la ruta |
| 6 | `src/components/modules/AdminDashboard.tsx` | Posible uso de ciudad en estadísticas | Bajo | No se modifica en esta fase |
| 7 | `src/components/modules/PublicDashboard.tsx` | Posible uso de ciudad en mapas/estadísticas | Bajo | No se modifica en esta fase |
| 8 | `src/components/modules/ConsultaResultado.tsx` / `ConsultaEnriquecidaClient.tsx` | Muestra distribución por ciudad/país | Bajo | No se modifica en esta fase |
| 9 | `src/lib/scoring.ts` / `src/lib/ranking.ts` | Diversidad geográfica por ciudad | Bajo | No se modifica la lógica; usa `ciudad` string o `ciudadId` existente |
| 10 | `src/lib/circulo-confianza.ts` | Notificaciones por ubicación | Bajo | No se modifica |
| 11 | `src/components/modules/ReporteWizard.tsx` | Coordina pasos con ubicación | Bajo | No se modifica |
| 12 | `src/app/api/estadisticas-publicas/route.ts` | Agregaciones por ciudad/país | Bajo | No se modifica |
| 13 | `src/app/api/admin/estadisticas/route.ts` | Estadísticas por ciudad | Bajo | No se modifica |

**Conclusión**: El cambio es estructuralmente transparente para los consumidores actuales. El riesgo principal es en el seed (`prisma/seed.ts`), que debe actualizar ciudades existentes sin romper índices ni relaciones. La mitigación es el uso de `upsert` y la columna `departamentoId` nullable.

---

## Project Structure

### Documentation (this feature)

```text
specs/073-ubicacion-departamentos/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (sin cambios, documentación por claridad)
│   └── ubicacion.md
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output
```

### Source Code (affected after approval)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma          # + model Departamento, + Ciudad.departamentoId
│   ├── migrations/
│   │   └── YYYYMMDDHHMMSS_add_departamento/  # aditiva
│   └── seed.ts                # seed de Colombia con departamentos
└── scripts/
    └── seed-colombia.ts       # (opcional) data de Colombia separada
```

**Structure Decision**: La data de Colombia puede ir directamente en `prisma/seed.ts` (como el resto de países) o en un módulo separado (`scripts/seed-colombia.ts`) importado por `seed.ts`. La decisión de implementación se deja para tasks.md, con preferencia por mantener el seed centralizado mientras sea legible.

---

## Complexity Tracking

No constitution violations. No complexity justification needed. El cambio es una relación 1:N adicional y un seed de datos estáticos.

---

## Data Migration Strategy

1. **Backup**: `pg_dump` de la BD antes de cualquier cambio.
2. **Migración aditiva**:
   - Crear tabla `Departamento`.
   - Agregar `departamentoId` nullable a `Ciudad` con FK a `Departamento`.
   - Mantener `Ciudad.paisId` y su FK a `Pais`.
   - Agregar índices: `Departamento.paisId`, `Ciudad.departamentoId`.
3. **Seed idempotente**:
   - Upsert Colombia por `codigo = "CO"`.
   - Upsert departamentos por `(nombre, paisId)`.
   - Para cada ciudad colombiana existente: buscar por `(nombre, paisId)`, actualizar `departamentoId` si se encuentra.
   - Crear ciudades faltantes con su `departamentoId` y `paisId`.
4. **Verificación**: contar departamentos (33), ciudades con `departamentoId` no null (≥ las 10 existentes), y tests verdes.

---

## Open Questions (0 remaining)

All NEEDS CLARIFICATION resolved. La fuente de datos es pública (DANE), el modelo es aditivo y los consumidores no se modifican.
