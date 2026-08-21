# Cierre: SPEC-192 — UX del simulador anti-abuso (002-PI-086)

**Feature**: 002-PI-086  
**Branch**: `work/002-pi-086`  
**Fecha de cierre**: 2026-08-20  
**Estado**: IMPLEMENTADO — PR a `feature/001-scaffolding` pendiente de merge

---

## Resumen ejecutivo

Se cerraron 6 incidencias de UX en el simulador `/dashboard/admin/anti-abuso` (SPEC-184/185) más el bypass seguro del rate-limit por fingerprint para simulaciones:

- **I-70**: reset limpio del panel al cambiar de escenario.
- **I-71**: bypass de `report_fingerprint` mediante header `x-simulacion-secret` validado con `crypto.timingSafeEqual`; el worker falla loud si falta `SIMULADOR_ABUSO_SECRET`.
- **I-74**: dropdown de plataformas reales con fallback hardcoded.
- **I-75**: priorización de arrays (`identificadores`, `ips`) sobre campos únicos.
- **I-76**: historial con escenario legible y nota interna opcional (`SimulacionAbusoRun.nota`).
- **I-77**: botón "Iniciar simulación" se re-habilita tras finalizar una corrida.

No se tocó `src/lib/ai/**` ni se modificaron scopes de `src/lib/rate-limit.ts`.

## Artefactos entregados

- `spec.md` — requisitos y escenarios (v2 con secret compartido).
- `plan.md` — diseño técnico.
- `tasks.md` — tareas completadas.
- `data-model.md`, `research.md`, `checklists/requirements.md`, `contracts/endpoints.md`.
- `cierre.md` — este archivo.

## Cambios principales

1. `src/components/modules/AdminAntiAbusoSimulador.tsx` — reset al cambiar escenario, dropdown de plataformas, priorización de arrays, input de nota, botón re-habilitado.
2. `src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx` — columna escenario legible y columna nota.
3. `src/lib/anti-abuso/simulador-secreto.ts` + `.test.ts` — validación constante del header `x-simulacion-secret`.
4. `src/app/api/reportes/route.ts` — bypass condicional de `report_fingerprint` cuando el secret coincide.
5. `src/app/api/reportes/route.test.ts` — 3 tests de integración de bypass.
6. `scripts/simulador-abuso.mjs` — envía el header; `process.exit(1)` si falta el env.
7. `src/app/api/admin/anti-abuso/simular/route.ts` + `route.test.ts` — soporta y persiste `nota`.
8. `src/lib/anti-abuso/simulador.ts`, `src/lib/dal/repositories/simulacion-abuso.ts`, `src/lib/schemas/index.ts` — propagación de `nota`.
9. `prisma/schema.prisma` + migración aditiva `20260820030000_spec_192_simulador_nota` — campo `SimulacionAbusoRun.nota`.
10. `.env.example`, `.env.production.example`, `.env.test` — variable `SIMULADOR_ABUSO_SECRET`.
11. `specs/README.md` — registro de SPEC-192 en ambas tablas.

## Gate local

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint -- --no-cache` | ✅ (42 warnings preexistentes, 0 errores; se descartaron archivos no trackeados de SPEC-193 para el gate) |
| `npm run arch:check` | ✅ |
| `npm run test:unit` | ✅ 855 tests |
| `npm run test:integration` | ✅ |
| `npm run build` | ✅ |

## Tests nuevos / actualizados

- `src/lib/anti-abuso/simulador-secreto.test.ts` — 5 tests unitarios del comparador constante.
- `src/app/api/reportes/route.test.ts` — bypass con secret correcto; bloqueo sin header; bloqueo con header falso.
- `src/app/api/admin/anti-abuso/simular/route.test.ts` — persistencia de nota y lectura en detalle.

## Decisiones y candados

- Bypass SOLO del scope `report_fingerprint`; `report` (IP/usuario) y `report_identificador` siguen activos.
- `validarSecretoSimulacion` usa `crypto.timingSafeEqual`; nunca loguea el valor.
- Si `SIMULADOR_ABUSO_SECRET` no está definido, el bypass nunca aplica (fail-safe en app; fail-loud en worker).
- Migración aditiva: `SimulacionAbusoRun.nota VARCHAR(200)`, nullable.
- No se tocó `src/lib/ai/**` ni `src/lib/rate-limit.ts`.
- Cambios aditivos de SPEC-193 (002-PI-087) que estaban en el árbol de trabajo paralelo se conservan: `src/lib/audit.ts` retorna `AuditLog` y `prisma/seed.ts` siembra `monitoreo.logs.*`. Son compatibles hacia atrás y no afectan el comportamiento de SPEC-192.

## Configuración de despliegue

Generar el secret en producción:

```bash
openssl rand -hex 32
```

Añadir el resultado a `.env.production` tanto en `pi-app` como en `pi-simulador-abuso`:

```bash
SIMULADOR_ABUSO_SECRET=<valor-de-openssl-rand-hex-32>
```

No incluir el valor en commits, docs ni chat (I-22).

## Señal a ZEUS

`002-PI-086 · REALIZADO · <hash> · PR`
