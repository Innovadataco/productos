# Implementation Plan: SPEC-350 · Caso del colegio (A-69 · C3)

**Branch**: `work/pi-SPEC-350-caso-colegio` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

## Summary

Detalle del `SeguimientoCaso` con estilo expediente: mapa+cronología del padre
reusados tal cual, capa 1 (cifras en vivo) calculada en el DAL del colegio y
capa 2 (análisis IA) enganchada al orquestador de SPEC-341 con
`alcance=COLEGIO_BLINDADO`, compartiendo cola pg-boss + worker + validación +
economía del padre (cool-down, TTL, agotamiento, huérfano). Voz USTED.

## Technical Context

- **TypeScript strict** · **Next.js 16 App Router** · **Prisma 5.22** · **Vitest**.
- Dependencias reusadas (NO se toca su código): `MapaUbicaciones`, `ExpedienteVivo`
  (extraer subcomponentes que aplican), `ExpedienteGenerando`, orquestador
  `ejecutar-analisis.ts`, cola `padre.analisis.expediente`, worker.
- Nuevo: `seguimientoCasoId` en `AnalisisExpediente`, `expedienteId` a nullable,
  DAL `analisis-caso.ts`, ruta `/api/colegio/casos/[id]/analisis`, componente
  `CasoVivo.tsx` (voz USTED).

## Constitution Check

- §1.3 (presunción inocencia) — prompts + validador de frases se comparten con
  el padre, ya blindados. **PASA.**
- §1.4 (parametrizables sembrados) — no agrega parámetros; reusa los de
  `padre.analisis.*` (y su gemelo colegio ya sembrado por SPEC-341). **PASA.**
- §2.1 (stack heredado) — cero deps nuevas. **PASA.**
- §4.4 (pg-boss) — misma cola, mismo worker. **PASA.**

## Project Structure

```
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                                    # AnalisisExpediente: +seguimientoCasoId?, expedienteId opcional
│   └── migrations/<ts>_analisis_caso_colegio/           # aditiva: ALTER TABLE
├── src/
│   ├── lib/
│   │   ├── dal/services/
│   │   │   └── analisis-caso.ts                         # NUEVO — leerVigente/evaluarYEncolarSiCorresponde para caso
│   │   └── caso/
│   │       └── hechos-caso.ts                           # NUEVO — mapea reportes del caso a HechoPadre[]
│   ├── app/api/colegio/casos/[id]/
│   │   └── analisis/
│   │       ├── route.ts                                 # NUEVO — GET+POST
│   │       └── route.test.ts                            # NUEVO
│   └── components/modules/colegio/casos/
│       ├── CasoVivo.tsx                                 # NUEVO — envuelve mapa + capa1 + análisis (voz USTED)
│       └── AnalisisCaso.tsx                             # NUEVO — client component (misma forma que AnalisisExpediente del padre pero USTED)
└── src/app/dashboard/colegio/casos/[id]/page.tsx        # NUEVO o extendida — monta <CasoVivo/>
```

## Fases

### Phase 0 — Research
- **R-1**: Constraint XOR de aplicación (uno de `expedienteId`/`seguimientoCasoId`): revisar si Prisma admite check o solo runtime. Decisión: guard en DAL — Prisma 5 no expresa CHECK.
- **R-2**: Reusar `MapaUbicaciones` — verificar shape de `puntos` y adaptar desde los reportes del caso.
- **R-3**: `AlertaColegio.reporteId` → llegar a los hechos del caso; hay 1 reporte por alerta principal, pero un caso puede evolucionar. Se cargan los reportes del identificador del sujeto de la alerta que arrancó el caso.
- **R-4**: Boundary de rol — `SCHOOL_ADMIN` o `COMITE_CONVIVENCIA` del mismo colegio; reusar patrón de las otras rutas `/api/colegio/*`.

### Phase 1 — Design & contratos
- `data-model.md`: cambios al `AnalisisExpediente` + shape `HechoDeCaso` (mismo `HechoPadre` con nombre nuevo).
- `contracts/caso-analisis-endpoint.md`: `GET/POST /api/colegio/casos/[id]/analisis` con el mismo body que la del padre (`vigente + hashActual + coincide + hechosNuevosDesde + estado + cola + colaLlena + cooldown + agotadoPorFallos`).
- `quickstart.md`: recorrido manual (escalar caso → abrir detalle → ver mapa + capa 1 + banner → esperar → recargar → ver análisis + guía + Actualizar).

## Complexity Tracking

Sin violaciones de constitución.
