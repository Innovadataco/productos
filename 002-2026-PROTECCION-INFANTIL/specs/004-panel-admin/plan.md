# Implementation Plan: Panel de Administración

**Feature**: Panel de Administración + Dashboard de Estadísticas

**Branch**: `feature/004-panel-admin`

**Created**: 2026-07-14

---

## Technical Context

### Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js App Router | 16.2.10 |
| ORM | Prisma | 5.22.0 |
| Auth | JWT manual + bcryptjs | — |
| Estilos | Tailwind CSS | 3.4 |
| Testing | Vitest + jsdom | — |

### Dependencias existentes relevantes

- `verifyAuth()` en `src/lib/auth.ts` — retorna usuario con `rol`
- `prisma` singleton en `src/lib/prisma.ts`
- `AuditLog` modelo con `AccionAudit` enum
- Endpoints admin existentes: `/api/admin/reportes-revision`, `/api/admin/correcciones`, `/api/admin/reportes/[id]/anonimizar`

### Componentes UI base disponibles

- `Input`, `Select`, `Button`, `GlassCard` en `src/components/ui/`
- Sistema glassmorphism del spec 003 reutilizable

---

## Constitution Check

| Principio | Impacto | Mitigación |
|-----------|---------|------------|
| §1.2 Solo texto | Ninguno | El admin no añade capacidad de subir multimedia |
| §1.3 Presunción de inocencia | Dashboard y listados | Lenguaje descriptivo: "N reportes", nunca "peligroso" |
| §1.5 Clasificación de conductas | Corrección de categoría | El admin corrige categoría de conducta, no scoring de persona |
| §2.1 Stack heredado | Compatible | Next.js App Router + Prisma + Tailwind, sin nuevas deps |
| §3.1 TypeScript strict | Aplica | Sin `any`, filtros tipados con `Prisma.ReporteWhereInput` |
| §3.4 Códigos HTTP | Aplica | 401/403 para auth, 400 para validación, 404 para not found |
| §4.3 Paginación | Bandeja de reportes | Server-side page + pageSize con MAX_PAGE_SIZE=100 |
| §6.1 Cookie httpOnly | Aplica | `credentials: include` en todos los fetch admin |

**Veredicto**: Ninguna violación. Proceder.

---

## Phases

### Phase 1: Backend — Endpoints de agregación

**Nuevos endpoints**:

- `GET /api/admin/estadisticas` — Métricas agregadas (totales, porEstado, porCategoria, porPlataforma, porCiudad, tendencia 30 días)
- `GET /api/admin/audit-logs` — Logs paginados con filtros

**Reutilización** (sin cambios):

- `GET /api/admin/reportes-revision` — Lista con filtros
- `GET /api/admin/reportes-revision/[id]` — Detalle
- `POST /api/admin/correcciones` — Corrección
- `PATCH /api/admin/reportes/[id]/anonimizar` — Anonimización

### Phase 2: Frontend — Layout y protección

- `src/app/dashboard/admin/layout.tsx` — Server component que verifica rol ADMIN vía cookie; redirige si no cumple
- `src/components/modules/AdminNav.tsx` — Navegación lateral: Bandeja, Dashboard, Anonimización

### Phase 3: Frontend — Bandeja de reportes

- `src/app/dashboard/admin/page.tsx` — Página por defecto (bandeja)
- `src/components/modules/AdminReportesTable.tsx` — Tabla con paginación, ordenación, filtros
- `src/components/modules/AdminReporteDetalle.tsx` — Modal/drawer con textoOriginal, clasificación, acciones

### Phase 4: Frontend — Corrección y anonimización

- Integración de corrección en el detalle (dropdown de categoría + motivo)
- Vista de anonimización con textarea para textoAnonimizado + validación 20-5000 chars

### Phase 5: Frontend — Dashboard de estadísticas

- `src/app/dashboard/admin/estadisticas/page.tsx`
- `src/components/modules/AdminDashboard.tsx` — Tarjetas de métricas + gráficos SVG
- Componentes de visualización: `BarChart`, `DonutChart`, `Sparkline` (SVG nativo)

### Phase 6: Polish y validación

- `npm run build` sin errores TypeScript
- Escenarios A-G del quickstart validados
- Verificar que PII no filtra a APIs públicas

---

## File Structure

```
src/
├── app/
│   └── dashboard/
│       └── admin/
│           ├── layout.tsx           # Protección rol ADMIN
│           ├── page.tsx             # Bandeja (default)
│           ├── estadisticas/
│           │   └── page.tsx         # Dashboard
│           └── anonimizar/
│               └── page.tsx         # Vista rápida de pendientes
├── app/api/admin/
│   ├── estadisticas/
│   │   └── route.ts                 # NUEVO
│   └── audit-logs/
│       └── route.ts                 # NUEVO
├── components/modules/
│   ├── AdminNav.tsx
│   ├── AdminReportesTable.tsx
│   ├── AdminReporteDetalle.tsx
│   ├── AdminDashboard.tsx
│   ├── BarChart.tsx                 # SVG
│   ├── DonutChart.tsx               # SVG
│   └── Sparkline.tsx                # SVG
```

---

## Unknowns / NEEDS CLARIFICATION

Ninguno. El scope está delimitado por "fuera de alcance: módulo colegios, SaaS/pagos, gestión de usuarios". Los endpoints de agregación son nuevos pero usan Prisma `groupBy` (ya disponible).