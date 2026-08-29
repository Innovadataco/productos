# Cierre: SPEC-159 — Seguimiento del caso con bitácora

**Fecha**: 2026-08-09 · **Radicado**: 002-PI-058 (continuación D-51) · **Spec**: [spec.md](./spec.md)

## Evidencia

- Commits en `work/002-pi-058`: `b60a73d9` schema+repos · `894730bd`
  lib+endpoints · `60ad9e10` página+componentes · `65466ed6` arch+docs.
- Checks (exit 0): `tsc` · `lint` · `tokens:check` (1122) · `arch:check` 4/4 ·
  suite completa verde (1882 tests).
- I-49: diff crudo con 4 DROP INDEX + RENAME + CREATE EXTENSION del drift →
  ninguno aplicado; migración 100% aditiva (1 ADD VALUE, 2 tablas, 3 índices, 5 FK).

## Qué se entregó (FR → evidencia)

- FR-001: `SeguimientoCaso` (1:1 lazy por `alertaId` único) + `NotaSeguimiento`
  (inmutable: sin PATCH/DELETE, 404 por construcción) + `COLEGIO_CASO_NOTA_AGREGADA`.
- FR-002/003: `GET /api/colegio/alertas/[id]` en UNA llamada; timeline solo de
  fuentes reales (creación · AuditLog estados · RegistroAviso por reporteId con su
  estado honesto · EventoMatch agregado) — test SC-001: 5 hitos cumplidos
  ordenados con fixture real, pendientes nunca inventados.
- FR-004: `POST .../notas` atómico (fallo forzado a mitad = 0 filas); 2 notas = 1
  caso + 2 audits (audit sin texto de la nota).
- FR-005: página del caso con resumen (sin valor del identificador ni texto —
  I-28), "lo que falta" computado server-side (nueva→3, gestionada sin nota→1, al
  día→0), bitácora; la lista de alertas enlaza al detalle.
- FR-006/007: A/B en repo y rutas (404 sin cruce ni filas) · I-29 intacto ·
  oráculos (modelos 54→56, páginas 56→57) · tokens ≤ piso.

## Desviaciones y hallazgos

1. Mi commit de docs de la spec (`e85be943`) dejó `specs/README.md` sin la fila
   159 → `specs-discipline.test.ts` ROJO en la rama (el chequeo que ZEUS
   anticipó). El implementador lo corrigió en su commit de docs; aquí queda
   consolidado el resto del cierre.
2. El hito "avisado" usa `actualizadoEn` del RegistroAvisoColegio (marca real del
   ENVIADO tras el 200 del proveedor); hitos de estado solo desde AuditLog.

## Deuda técnica

- `dev-restart.sh` pendiente (máquina compartida; deploy del CEO).
- Drift de índices (I-49) sigue activo: radicado aparte.
