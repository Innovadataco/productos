# Implementation Plan 029 · Rediseño de la consulta pública + panel del usuario autenticado

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

---

## Summary

Rediseñar la consulta pública para comunicar riesgo de un vistazo (badge, confianza, cantidad, fecha, plataformas, CTA de cuenta) y convertir `/dashboard` en el panel del usuario autenticado con dos secciones: "Mis reportes" y "Consulta enriquecida". Implementar un cálculo de riesgo conservador para vistas públicas, con umbrales configurables. No tocar el círculo de confianza ni el pipeline de clasificación.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, Tailwind CSS |
| **Storage** | PostgreSQL 16 con modelos existentes (`Reporte`, `ClasificacionIA`, `IdentificadorReportado`, `Plataforma`, `Ciudad`, `Pais`) |
| **Testing** | Vitest + jsdom + `@testing-library/react` |
| **Target Platform** | Docker Compose / Mac Studio / VPS |
| **Performance Goals** | Consulta < 1s para < 100 reportes |
| **Constraints** | Sin cambios de schema; no exponer PII; reutilizar componentes existentes |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto | ✅ Pass | No multimedia |
| §1.3 Presunción de inocencia | ✅ Pass | Se comunica "riesgo agregado", no culpabilidad |
| §1.4 Umbral parametrizable | ✅ Pass | Umbrales de riesgo en `ParametroSistema` |
| §2.1 Stack heredado | ✅ Pass | Next.js + Prisma + JWT manual |
| §3.1 TypeScript strict | ✅ Pass | Se mantiene |
| §3.5 Logs y auditoría | ✅ Pass | Se reutiliza `AuditLog` para cambios de parámetros de riesgo si aplica |
| §6.1 JWT en cookie | ✅ Pass | El endpoint de consulta enriquecida reutiliza `verifyAuth` |

---

## Project Structure

```text
specs/029-redisenio-consulta-panel-usuario/
├── spec.md
├── plan.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── consulta.md

src/
├── app/
│   ├── api/
│   │   ├── consulta/
│   │   │   └── route.ts            # ← extiende con riesgo/confianza
│   │   └── consulta/
│   │       └── detalle/
│   │           └── route.ts        # ← nuevo endpoint autenticado
│   ├── consulta/
│   │   └── page.tsx                # ← sin cambios, solo el cliente
│   └── dashboard/
│       └── page.tsx                # ← nuevo panel con dos secciones
├── components/
│   └── modules/
│       ├── ConsultaPublicaClient.tsx   # ← rediseño Nivel 1
│       ├── ConsultaEnriquecidaClient.tsx  # ← Nivel 2
│       └── DashboardUsuarioClient.tsx     # ← envuelve ambas secciones
└── lib/
    ├── riesgo-consulta.ts          # ← nuevo cálculo de riesgo
    ├── riesgo-consulta.test.ts     # ← tests
    └── parametros.ts               # ← ajustar para nuevos params (si aplica)
```

---

## Fases

### Fase 1 — Cálculo de riesgo público y parámetros

- Crear `src/lib/riesgo-consulta.ts` con:
  - `calcularNivelRiesgoConsulta(reportes, umbrales)`.
  - Peso por categoría de gravedad (reutilizar severidad de `scoring.ts` si es posible).
  - Regla: con 1 reporte, máximo MEDIO; con >= `min_reportes_alto` y score >= umbral, ALTO.
- Asegurar defaults de parámetros (`risk.umbral_medio=50`, `risk.umbral_alto=75`, `risk.min_reportes_alto=3`) con fallback en el helper para no requerir seed.
- Test unitario del helper.

### Fase 2 — Nivel 1: consulta pública rediseñada

- Extender `GET /api/consulta` para devolver:
  - `nivelRiesgo` (BAJO/MEDIO/ALTO).
  - `confianzaPromedio` (0-1).
  - `ultimoReporte` (ya existe).
  - `resumenPlataformas` (usando `formatPlataformasResumen`).
- Rediseñar `ConsultaPublicaClient.tsx`:
  - Badge grande de nivel de riesgo con color.
  - Tarjetas: confianza %, cantidad de reportes, último reporte.
  - Resumen de plataformas.
  - Bloque CTA "Crea una cuenta para ver el detalle completo".
- Asegurar que no se muestre `undefined` en plataformas (verificación final).

### Fase 3 — Nivel 2: panel autenticado

- Crear `GET /api/consulta/detalle` (requiere `verifyAuth("PARENT")`):
  - Devuelve identificador, reportes clasificados (plataforma, fecha, categoría, confianza, nivel de riesgo), ubicaciones agregadas por ciudad, nivel de riesgo global, confianza promedio, resumen de plataformas.
  - No devuelve texto del reporte ni usuarioId.
- Crear `ConsultaEnriquecidaClient.tsx` con buscador, lista de reportes, mapa de ubicaciones y resumen.
- Crear `DashboardUsuarioClient.tsx` que combine `MisReportesList` (ya existente) y `ConsultaEnriquecidaClient`.
- Actualizar `src/app/dashboard/page.tsx` para usar `DashboardUsuarioClient`.

### Fase 4 — Integración y pruebas

- Tests unitarios del helper de riesgo.
- Tests del endpoint `/api/consulta` (nivel de riesgo, confianza, sin undefined).
- Tests del endpoint `/api/consulta/detalle` (privacidad, mapa, autenticación).
- Tests de `ConsultaPublicaClient` y `ConsultaEnriquecidaClient`.
- lint, tsc, build, tests, smoke-e2e.

---

## Dependencies

- No se agregan dependencias nuevas.
- Reutilizar: `formatPlataforma`, `formatPlataformasResumen`, `MapaUbicaciones`, `Badge`, `MetricCard`, `ChartCard`, `GlassCard`, `Button`, `Input`.
- No se toca el pipeline de clasificación (R7 no aplica).

---

## Rollback

- Revertir el commit específico de la spec 029.
- Restaurar `src/app/dashboard/page.tsx` y `src/components/modules/ConsultaPublicaClient.tsx` desde la versión anterior.
- Eliminar `src/app/api/consulta/detalle/route.ts`, `src/lib/riesgo-consulta.ts` y componentes nuevos.
