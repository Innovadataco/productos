# 003-2026-SICOV-OTPC — Rediseño de Gesmovil / SICOV

Rediseño del sistema **Gesmovil / SICOV** (despachos, llegadas, mantenimientos, novedades,
proveedores vigilados y consulta integradora, con reporte a la Superintendencia de Transporte).
Metodología **Spec-Kit**; specs 001–004 implementadas y probadas en modo stub.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16.2.10 (App Router) + React + TypeScript |
| ORM / BD | Prisma 5.22 · PostgreSQL 16 (Docker propio del 003, puerto host **5434**) |
| Colas | **Table-driven en PostgreSQL** + advisory lock (sin Redis, sin pg-boss) · worker Node independiente con supervisor |
| Auth | JWT interno (cookie httpOnly) · login único usuario/contraseña |
| Integraciones | Capa propia con **stubs** (Supertransporte / integradora) |
| Testing | Vitest |

## Cómo ejecutar

```bash
docker compose up -d     # levanta la BD PostgreSQL 16 del 003 (host :5434)
npm install
npm run db:migrate       # migraciones (aditivas) + npm run db:seed si aplica
npm run dev              # app en http://localhost:5010
npm run worker           # worker de colas (demonio + supervisor), en otra terminal
npm test                 # suite Vitest
```

Verificación completa: `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`.

## Specs (Spec-Kit)

Cada feature vive en `specs/NNN-nombre/` con su set completo de artefactos
(`spec.md`, `plan.md`, `tasks.md`, …). Implementadas: `001-auth-despacho-doble-token`,
`002-llegadas-doble-token`, `003-integradora-consulta`, `004-salidas-wizard`.

## Integraciones — modo stub por defecto

Las integraciones con Supertransporte corren en **modo stub**:

```
INTEGRACIONES_MODO=stub
SUPERTRANSPORTE_HABILITADO=false
```

**Nunca consumir las APIs productivas sin verificación humana previa** (hoy no hay
credenciales reales en el entorno). El contrato de doble token (proveedor + vigilado + NIT)
se respeta igual en los stubs.

## Carpetas legacy

- `legacy-sistema-original/` — código del sistema en producción (AdonisJS 5 + Angular).
  **Solo referencia**: fuente de verdad del dominio; no se modifica.
- `api/` y `web/` — **demo inicial descartado** (React+Vite + NestJS + SQLite). No usar,
  no compilar, no construir encima. Ver `LEEME-DEMO-MUERTO.md` en cada carpeta.

## Documentación de referencia

`AGENTS.md` (reglas de operación) · `HANDOFF-SICOV.md` (análisis del sistema real + fe de
erratas) · `.specify/memory/constitution.md` (constitución del proyecto).
