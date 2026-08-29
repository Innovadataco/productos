# Research: SPEC-145 — Modelo `Profesor` mínimo

**Fecha**: 2026-08-03 · **Spec**: [spec.md](./spec.md)

## D-R1 · I-49 — La mina del drift de índices

**Contexto** (hallazgo del cierre de SPEC-144): existen índices creados por SQL crudo
en migraciones viejas que el schema NO declara:
`AlertaColegio_patronInstitucionalId_idx`, `Ciudad_nombreNormalizado_trgm_idx` y los
índices vectoriales de `Embedding*` — más un rename por nombre truncado en
`patrones_institucionales`.

**Por qué la 145 no debería pisarla**: `prisma migrate dev` genera el diff entre el
HISTORIAL de migraciones (shadow DB) y el schema — no contra la BD real. Como esos
índices no están ni en migraciones-shadow ni en schema de forma divergente para este
cambio, el diff de la 145 debería ser solo `CREATE TABLE "Profesor"` +
`ADD COLUMN` + `ALTER TYPE … ADD VALUE`.

**Verificación obligatoria (I-49)**: antes de aplicar, leer el SQL generado línea a
línea. Si contiene CUALQUIER `DROP INDEX` (o `DROP TABLE`, `ALTER TYPE … DROP`),
PARA y se reporta a ZEUS — aplicarlo borraría el trigram de ciudades y los
vectoriales del motor. Nota de proceso de SPEC-144: `migrate dev` exige TTY; se usó
`migrate diff` + shadow DB y se aplicó con `migrate deploy` — mismo camino aquí.

## D-R2 · Enum `AccionAudit`: ADD VALUE es aditivo y seguro

`ALTER TYPE "AccionAudit" ADD VALUE 'COLEGIO_PROFESOR_CREADO'` (y sus 2 hermanos) es
aditivo en PostgreSQL 16 — precedente en el repo: `MATCH_DETECTADO`,
`CONSULTA_SIN_RESULTADOS`, `CONSULTA_VACIA_CTA_REPORTAR` se añadieron así en
migraciones recientes. Prisma no envuelve migraciones de postgres en transacción, así
que la restricción "ADD VALUE no va en bloque transaccional" (PG < 12) no aplica.
**Cuidado (ZEUS)**: el valor nuevo NO se puede USAR en la misma migración que lo
crea; un backfill/seed que lo necesitara iría en migración aparte (no es el caso).

## D-R3 · Patrón CRUD (espejo de cursos/estudiantes)

Ruta de referencia verificada: `src/app/api/colegio/cursos/[id]/alumnos/route.ts`
(SPEC-144). Secuencia por verbo: `verifyAuth("SCHOOL_ADMIN")` → `assertModulo(user,
"colegios_gestion")` → `verificarVigenciaColegio` → `checkRateLimit`
(`admin_read`/`admin_write`) → `withValidation` (params/body Zod) → repo DAL
tenant-first → `logAudit` → respuesta. Errores: 400 Zod (mensaje humano), 404
recurso/tenant, 409 duplicado, 429 rate limit.

Duplicado: `buscarPorNombreEnCurso` de estudiantes es el patrón →
`buscarPorNombreApellidosEnColegio` para profesores (409 si duplicado activo).

## D-R4 · Asignación curso↔profesor (RESUELTO — D1 = A, ZEUS 2026-08-03)

Los endpoints de curso aceptan `profesorTitularId?` YA con validación same-tenant.
CONDICIÓN 1: test negativo explícito (profesor de B a curso de A → 404/400, nunca
éxito). CONDICIÓN 2: la baja suave del titular CONSERVA la asignación (FR-014) — el
titular histórico es información forense; `null` desasigna solo por acción explícita
del colegio.

## D-R5 · Cargas O-1 / O-2 (cambios de test solamente)

- **O-2**: `src/components/ui/LuzAmbiental.test.tsx` — patrón de
  `PanelVidrio.test.tsx` (render por estado, token/clase aplicada, `aria-hidden`,
  reduced-motion). Cierra SC-004 de SPEC-157 al pie de la letra.
- **O-1**: fixture `modeloUsado: "rubrica:M1+M2"` y votos `modelo: "M2"` en
  `mis-reportes/[id]/route.test.ts`; aserciones restauradas a
  `not.toContain("M1")`/`not.toContain("M2")` amplias — los cuid son alfanuméricos en
  minúscula, imposible colisión. Determinista sin perder el barrido.
