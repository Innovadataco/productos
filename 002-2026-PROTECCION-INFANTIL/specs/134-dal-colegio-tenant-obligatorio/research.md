# Research: SPEC-134 — inventario verificado (2026-08-01)

Reverificación en fuente al radicar E-1 (los conteos de julio pudieron cambiar):

## Superficie real (allowlist Q-3)

20 archivos del dominio colegio con acceso directo a `@/lib/prisma`:

- **Rutas (14)**: `api/colegio/alertas`, `alumnos/[id]` (+`/estado`, +`/identificadores`),
  `auditoria`, `carga/validar`, `carga/confirmar`, `cursos` (+`[id]`, +`[id]/alumnos`,
  +`[id]/estado`), `identificadores/[id]` (+`/estado`), `api/me/colegio`.
- **Módulos lib (6)**: `colegio/alertas.ts` (284 L), `estadisticas.ts` (155),
  `permisos.ts` (98), `vigencia.ts` (158), `carga/importer.ts` (156),
  `carga/sesion-roster.ts` (57).

## Estado del DAL

No existe NINGÚN repo del dominio colegio en `src/lib/dal/repositories/` (26 repos de
otros dominios: apelacion, audit-log, usuario, etc.). El patrón está fijado por
SPEC-053: D1 (repo + DTO + selects `satisfies`), D2 (`tx?: Prisma.TransactionClient`
vía `DbClient` de `unit-of-work.ts`), D5 (sin schema).

## Red de tests existente (no se toca)

- Route tests por endpoint: `src/app/api/colegio/**/route.test.ts` (cursos, alumnos,
  identificadores, alertas, auditoría, carga ×2).
- Tests de módulos: `colegio/alertas.test.ts`, `vigencia.test.ts`, `permisos.test.ts`,
  `carga/importer.test.ts`, `carga/sesion-roster.test.ts`, `estadisticas` (vía ruta).
- Journey (SPEC-133): `colegio.test.ts` (carga masiva end-to-end, alertas, auditoría).
- Negativos multi-tenant A/B: `negativos-handler.test.ts` (404 cross-tenant).

## Riesgo conocido

`alertas.ts` (284 L) mezcla negocio y datos — el repo absorbe solo el acceso a datos
(romper el god-module es E-2/E-8, fuera de alcance). `vigencia.ts`/`permisos.ts` se
usan desde layouts: firmas públicas intactas.
