# Implementation Plan: SPEC-149 — Avisos por email configurables

**Branch**: `work/002-pi-058` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

## Summary

Canal de avisos del colegio: 4 eventos (reporte nuevo, umbral por curso,
estudiante repetido, resumen del lunes) con preferencias por colegio, idempotencia
por constraint `@@unique([colegioId, tipoEvento, entidadId, dia])`, tope diario con
digest, envío encolado por pg-boss (nunca inline), y página de configuración.
Extiende `src/lib/email.ts` (el mailer real; `src/lib/mailer/` no existe).

## Technical Context

**Stack**: Next.js 16.2.10 · Prisma 5.22.0 · pg-boss · Resend (mockeado en tests) ·
Zod · Tailwind tokens. **Storage**: 2 tablas nuevas + 2 valores enum (migración
aditiva, inspección I-49 línea a línea). **Constraints**: cero PII en emails ·
idempotencia por BD · tope diario · tenant-first · cero doble email.

## Project Structure

```text
prisma/
├── schema.prisma                       # + PreferenciaAlertaColegio,
│                                       #  RegistroAvisoColegio, +2 AccionAudit
└── migrations/…_avisos_colegio/        # ADITIVA — SQL inspeccionado (I-49)

src/
├── lib/
│   ├── email.ts                        # + funciones por tipo de evento (copy ciego)
│   ├── colegio/
│   │   ├── alertas.ts                  # hook: encola evento (reemplaza envío inline)
│   │   ├── avisos.ts                   # NUEVO — pipeline: evalúa preferencias,
│   │   │                               #  umbrales, idempotencia, tope, digest
│   │   └── avisos-resumen.ts           # NUEVO — digest semanal del lunes
│   ├── dal/repositories/
│   │   ├── preferencia-alerta-colegio.ts   # NUEVO + test A/B
│   │   └── registro-aviso-colegio.ts       # NUEVO + test (idempotencia)
│   ├── queue.ts                        # + cola colegio-aviso (+ schedule semanal
│   │                                   #  registrado en el worker)
│   └── schemas/index.ts                # + preferenciaAvisoSchema
├── app/
│   ├── api/colegio/preferencias-avisos/route.ts  # GET/PATCH + test A/B
│   └── dashboard/colegio/configuracion/          # página + client + nav
scripts/worker-reportes.mjs             # + handler colegio-aviso + schedule lunes
prisma/seed.ts                          # + colegio.notificaciones.* y colegio.avisos.*
```

## Fases

1. **Schema + migración** (I-49) + repos DAL.
2. **Pipeline de avisos** (lib) + hook + cola + worker + emails.
3. **API + página** de configuración + seeds.
4. **Cierre**: arch regen (modelos 52→54, páginas 55→56) + checks + tests.

## Complexity Tracking

Sin violaciones.
