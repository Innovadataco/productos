# Tasks: SPEC-132 — Seguridad de la carga masiva del colegio

**Estado**: PENDIENTE — compuerta §4.

Las tareas (`TNNN`) se generan con `/speckit.tasks` **tras la aprobación de ZEUS** del
spec.md y plan.md de esta carpeta (instructivo 002-PI-055). Este archivo existe como
marcador para la disciplina de specs; no contiene tareas aún.

Orden previsto por el plan (se materializará en TNNN al aprobarse):

1. S-3: migrar parser a exceljs con fixtures intactos + límites
   (`carga.max_archivo_bytes`, `carga.max_filas`) y retirar `xlsx` del runtime.
2. S-4: tabla ADITIVA `CargaRosterSesion` (+ regenerar `01-modelo-datos.md`), sesión con
   TTL, `token.ts` firma SOLO `{ sesionId, colegioId }`, `validar` persiste y `confirmar`
   lee por id con guardas (vencida/inexistente/ajena).
3. Limpieza de sesiones expiradas en el worker.
4. Tests: fidelidad parser, límites, token sin PII (guarda), flujo validar→confirmar,
   id vencido/ajeno; gates: suite + tsc + lint + build + arch:check.
5. Cierre: sección Implementación en spec.md + índice specs/README.md.
