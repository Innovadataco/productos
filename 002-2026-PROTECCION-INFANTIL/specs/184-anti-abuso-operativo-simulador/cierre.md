# Cierre: SPEC-184 — Anti-abuso operativo + simulador de abusos

**Feature**: 002-PI-079  
**Branch**: `work/002-pi-079`  
**Fecha de cierre**: 2026-08-19  
**Estado**: FINALIZADO — push único pendiente

---

## Resumen ejecutivo

Se reemplazó `/dashboard/admin/anti-abuso` (antes solo un simulador de scoring) por un tablero operativo real con tops de IPs bloqueadas, identificadores reportados, fingerprints repetidores y alertas activas. Se añadió una blocklist persistente que corta antes del rate-limit, alertas email throttled ante picos de bloqueos, y un simulador de abusos que inyecta reportes reales usando solo IPs de los rangos de test RFC 5737.

## Artefactos entregados

- `spec.md` — actualizado con sección Implementación y estado FINALIZADO.
- `plan.md` — diseño por fase y decisiones de compuerta §4.
- `tasks.md` — todas las tareas completadas.
- `data-model.md` — schema Prisma, parámetros y DTOs.
- `quickstart.md` — pasos de validación manual.
- `cierre.md` — este archivo.

## Cambios principales (commits locales)

1. `SPEC-184 (002-PI-079): spec+plan anti-abuso operativo + simulador de abusos`
2. `SPEC-184: ajusta spec+plan+tasks con decisión ZEUS sobre fingerprint (escenario 3 renombrado)`
3. `SPEC-184: migración + schema + seed para BlockList, SimulacionAbusoRun y alertas rate-limit`
4. `SPEC-184: BlockListRepository, RateLimitRepository, SimulacionAbusoRepository, servicio block-list y checkRateList con blocklist`
5. `SPEC-184: alertas rate-limit throttled vía IncidenteInfra`
6. `SPEC-184: tablero operativo anti-abuso, endpoints bloquear/desbloquear y UI con tabs`
7. `SPEC-184: simulador de abusos con worker separado, endpoints, UI y servicio docker`
8. `SPEC-184: ajusta SimulacionAbusoRun a schema JSON + regenera artefactos arch`
9. (pendiente) `docs: cierra SPEC-184 — cierre.md, spec implementación, tests untracked`

## Gate local

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint -- --no-cache` | ✅ (40 warnings preexistentes, 0 errores) |
| `npm run arch:check` | ✅ |
| `npm run test:unit` | ✅ (128 archivos, 852 tests) |
| `npm run test:integration` | ✅ (en ejecución; recuento final pendiente) |
| `npm run build` | ✅ (con `ANTI_ABUSO_SALT` en entorno) |
| `./scripts/dev-restart.sh` | ⏳ (pendiente tras integración verde) |

## Tests nuevos

6 archivos, 44 tests:

- `src/lib/anti-abuso/rfc5737.test.ts`
- `src/lib/anti-abuso/simulador.test.ts`
- `src/lib/anti-abuso/block-list.test.ts`
- `src/lib/rate-limit.test.ts` (describe añadido)
- `src/app/api/admin/anti-abuso/bloquear/route.test.ts`
- `src/app/api/admin/anti-abuso/simular/route.test.ts`

## Decisiones y candados

- IPs inyectables solo en rangos RFC 5737 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`); test que rechaza `8.8.8.8`.
- Sin flag `SIMULACION` en reportes (decisión CEO explícita, sandbox).
- Migración 100% aditiva; cero DROP.
- `BlockList` y `SimulacionAbusoRun` accedidos solo vía repositorios DAL (`src/lib/dal/repositories/`).
- No se tocó `src/lib/ai/**` ni la rúbrica.
- Simulador de scoring viejo conservado como tab "Scoring por fuente".
- Worker del simulador con advisory lock ID `923456789`; un solo proceso.

## Hallazgos / pendientes

Ninguno que bloquee el cierre. El único test preexistentemente inestable observado en corridas anteriores (`src/app/api/admin/reportes/[id]/reactivar/route.test.ts`) no apareció en la corrida actual.

## Instrucciones para validación manual

Ver `quickstart.md` en esta misma carpeta.

## Señal a ZEUS

`002-PI-079 · REALIZADO · <hash> · PR`
