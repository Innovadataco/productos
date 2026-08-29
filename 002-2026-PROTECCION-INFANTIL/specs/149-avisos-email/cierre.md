# Cierre: SPEC-149 — Avisos por email configurables

**Fecha**: 2026-08-09 · **Radicado**: 002-PI-058 (continuación D-51) · **Spec**: [spec.md](./spec.md)

## Evidencia

- Commits en `work/002-pi-058`: `9ea8fca3` schema+repos · `19ac4aee`
  pipeline+cola+emails+worker · `0576eca0` api+página+seeds · `dd2a4575`
  arch+oráculos · `495eea3c` fix lint DAL · `773c5624` docs.
- Checks (exit 0): `tsc` · `lint` · `tokens:check` (1122) · `arch:check` 4/4 ·
  build · suite completa local verde (1846 tests, área 159).
- I-49: el diff crudo traía los 4 DROP INDEX del drift + RENAME + CREATE EXTENSION;
  migración escrita a mano solo aditiva (2 tablas, 3 índices, 2 ADD VALUE, 2 FK) y
  verificada post-deploy. La mina sigue ACTIVA (radicada aparte).

## Qué se entregó (FR → evidencia)

- FR-001: `PreferenciaAlertaColegio` (upsert único por `{colegioId, tipoEvento}`) +
  `RegistroAvisoColegio` (idempotencia por `@@unique([colegioId, tipoEvento,
  entidadId, dia])` — test: misma clave dos veces = UNA fila; FALLIDO no consume y
  el retry actualiza la misma fila a ENVIADO).
- FR-002/004: cola `colegio-aviso` (hook encola, worker envía con retry); **cero
  doble email** — el envío inline viejo quedó superado y `alertas.test.ts`
  fortalecido a la nueva conducta (verifica encolado y OMITIDO auditado).
- FR-003: UMBRAL_CURSO (N=3/7d default) y ESTUDIANTE_REPETIDO (M=2/30d, 2 nicks del
  mismo estudiante) cruzan solo al llegar; ventana móvil.
- FR-004/005: tope diario (default 5) → `PENDIENTE_DIGEST`; schedule lunes 07:00
  Bogotá con KPIs D2 + "te espera" + pendientes + copy positivo; colegio vencido
  omitido; un fallo no detiene a los demás.
- FR-006/007/008: `email.ts` extendido (mailer real; `src/lib/mailer/` no existía)
  con copy ciego §3 · `/api/colegio/preferencias-avisos` + página
  `/dashboard/colegio/configuracion` + nav · seeds de `colegio.notificaciones.*` y
  `colegio.avisos.*`.

## Desviaciones y hallazgos

1. `tipoEvento`/`estado` como String con valores cerrados (patrón
   `AlertaColegio.estado`) en vez de enums Prisma — evita CREATE TYPE fuera de la
   lista I-49; documentado en el schema.
2. Tests corridos contra `proteccion_infantil_test3` por la contención FK fantasma
   de la BD compartida (proceso vitest ajeno sigue vivo en la máquina).
3. Carrera teórica del tope diario (2 envíos concurrentes en el mismo segundo
   podrían superarlo en 1): volumen ínfimo por colegio; documentado en el pipeline.
4. RESUMEN_SEMANAL excluido del tope diario (es semanal y programado).

## Deuda técnica

- `dev-restart.sh` no ejecutado (máquina compartida con otros frentes activos) —
  queda para el deploy del CEO.
- Drift de índices (I-49) sigue activo: radicado aparte, antes de abrir a usuarios.
