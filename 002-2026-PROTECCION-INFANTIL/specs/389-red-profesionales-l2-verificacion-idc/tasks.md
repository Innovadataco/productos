# SPEC-389 · Tasks

## Estado: PARCIAL — código incorporado por cherry-pick a SPEC-408

- [x] `src/lib/profesionales/vigencia.ts` + tests.
- [x] `src/lib/profesionales/cron-vencimiento.ts` + tests.
- [x] Entrada `admin_verificacion_profesionales` en `permisos-catalogo.ts` (SOLO ADMIN por default).
- [x] `spec.md` original (autoridad de Dev Infra).
- [ ] Endpoints + UI del propio SPEC-389 — reemplazados por la implementación completa de SPEC-408 (una sola cola visible en el admin, no dos SPECs).
- [ ] Worker cron efectivo — a instrumentar cuando el worker de vencimientos se conecte a `decidirAcciones` (fuera de este PR).

## Cadena
SPEC-388a (modelo, mergeado) → SPEC-391 (registro, mergeado) → SPEC-389 (verificación — código base acá) + **SPEC-408 (pantalla + endpoints del Verificador, este PR)**.
