# SPEC-389 · Plan (cherry-picked al SPEC-408)

**Origen:** rama `work/pi-SPEC-389-red-profesionales-l2` (Dev Infra, WIP no mergeado).
**Estado:** los helpers puros de `vigencia.ts` + `cron-vencimiento.ts` + el módulo del catálogo `admin_verificacion_profesionales` se cherry-pickearon a la rama de SPEC-408 (commits `423977c9e` y `a5b72d933`, preservando autoría). SPEC-408 los CONSUME, no los reescribe.

## Alcance heredado
- `src/lib/profesionales/vigencia.ts` — `calcularVenceEn`, `sellos`, `ultimaAprobacion`, `puedeAparecerEnDirectorio`, `MESES_LEY_2375=4`.
- `src/lib/profesionales/cron-vencimiento.ts` — `decidirAcciones` con candado I-280 idempotente.
- `src/lib/permisos-catalogo.ts` — entrada `admin_verificacion_profesionales`.
- 24 tests candado en `vigencia.test.ts` + `cron-vencimiento.test.ts`.

## Plan completo
Vive en el `spec.md` de este directorio (autoridad original de Dev Infra) y en el `spec.md` de SPEC-408 (implementación que lo consume). Cuando SPEC-389 se merge por su propia rama, este directorio queda como fuente única y SPEC-408 apunta a él por referencia.

## Verificación
Los 24 tests de vigencia/cron siguen verdes bajo `test:unit`; su cobertura vive en `vitest.unit.includes.ts:34-36`.
