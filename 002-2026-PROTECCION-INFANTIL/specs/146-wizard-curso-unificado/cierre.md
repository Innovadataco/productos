# Cierre: SPEC-146 — Wizard unificado curso + estudiantes + identificadores

**Fecha**: 2026-08-03 · **Radicado**: 002-PI-058 (lote D-51) · **Spec**: [spec.md](./spec.md)

## Evidencia

- Commits en `work/002-pi-058`: `525a3170` datos+endpoints · `40c5e19e` UI wizard ·
  `f82d6676` redirects+nav+docs.
- Checks de día (exit 0): `tsc` · `lint` · `tokens:check` (**1135**, baja de 1166:
  los PageClients eliminados tenían 31 crudos) · `arch:check` VERDE (87 hrefs).
- Tests nuevos (65): schema 11 · endpoint unificado 16 · validar/plantilla 9 ·
  Accordion a11y 8 · wizard 21. Suite del área: 50 archivos / 360 tests verdes
  (incluye endpoints viejos y journeys colegio intactos).

## Qué se entregó (FR → evidencia)

- FR-001/004: wizard §5.3 en `/dashboard/colegio/cursos/unificado` con `Accordion`
  nuevo (test a11y: teclado, aria-expanded, foco, reduced-motion).
- FR-002: `POST /api/colegio/cursos/unificado` — `withUnitOfWork`, re-validación
  Zod completa, profesor same-tenant o nuevo inline, duplicados 409, audit
  `COLEGIO_*`. **Atomicidad probada**: fallo en la última entidad (identificador
  duplicado intra-payload) → 409 y 0 filas en todas las tablas.
- FR-003: `POST .../unificado/validar` dry-run stateless (conteos de BD y roster
  idénticos antes/después) + plantilla con columnas de acudiente (conserva las base
  para compatibilidad de archivos existentes).
- FR-005: redirects de `cursos/nuevo` y `cursos/carga` (permanentRedirect; la de
  carga al wizard en modo Excel), nav "Subir lista", CTAs de home actualizados.
- FR-006: endpoints API viejos intactos — sus tests y journeys verdes sin tocar
  assertions.
- FR-007/008/009: titular existente o nuevo · acudientes inline máx 2 · A/B tenant
  (profesor de B → 404, nada persiste en A) · I-29.

## Desviaciones y hallazgos

1. Oráculo `rutas-app.test.ts` 52→53 (regla del propio oráculo: prevalece el conteo
   real).
2. 3 tests de home (SPEC-143) actualizados SOLO en hrefs esperados → wizard (FR-005);
   cero aserciones de comportamiento.
3. `CursosPageClient` (sin test): botones apuntaban a rutas redirigidas y uno decía
   "Carga masiva" (término prohibido §3) → al wizard con "Subir lista".
4. El validator viejo sigue exigiendo identificador (su test lo fija); la
   opcionalidad del wizard vive en el wrapper `validarFilasUnificado`.
5. Alcance (decisión documentada en spec.md): `cursos/[id]` y `alumnos/[id]` NO se
   reemplazaron aquí — los reconstruyó SPEC-147 sobre esta, como manda su fila del
   brief.

## Deuda técnica

- El wizard solo crea (no edita); la edición vive en `cursos/[id]` (SPEC-147).
- La acción "guardar solo correctos" descarta las filas con problemas en cliente;
  el guardado final re-valida todo server-side (defensa en profundidad).
