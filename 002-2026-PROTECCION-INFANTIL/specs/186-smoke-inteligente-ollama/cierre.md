# Cierre: SPEC-186 — Smoke inteligente del monitor Ollama (002-PI-081)

**Feature**: 002-PI-081  
**Branch**: `work/002-pi-081`  
**Fecha de cierre**: 2026-08-20  
**Estado**: IMPLEMENTADO — PR a `feature/001-scaffolding` pendiente de merge

---

## Resumen ejecutivo

Se rediseñó el probe `ollama_smoke` de SPEC-171 de un smoke real cada 5 min a un vigilante de 3 niveles:
1. **Ping HTTP** a `/api/tags` cada 60 s (sin cargar modelo).
2. **Piggyback** en la última `ClasificacionIA` exitosa si fue en los últimos 15 min.
3. **Smoke real** solo si no hay piggyback y ya pasaron 30 min desde el último smoke exitoso.

Esto libera la GPU del CEO: Ollama solo se molesta cuando no hay tráfico real reciente. Se añadió la columna aditiva `metodo` a `HealthProbe`, un endpoint de historial, y un modal en el tablero operativo para evidenciar el comportamiento (pings / piggybacks / smokes / fallos en 24h).

## Artefactos entregados

- `spec.md` — requisitos, escenarios y decisiones de compuerta §4.
- `plan.md` — diseño técnico y fases.
- `tasks.md` — tareas completadas.
- `data-model.md` — impacto en schema y parámetros.
- `research.md` — contexto del problema.
- `checklists/requirements.md` — checklist de requisitos.
- `cierre.md` — este archivo.

## Cambios principales (commits en `work/002-pi-081`)

1. `b7e0869b` docs(SPEC-186): spec+plan — smoke inteligente del monitor Ollama (002-PI-081)
2. `484b62f3` feat(SPEC-186): smoke inteligente del monitor Ollama (002-PI-081)
3. `905548f9` docs(SPEC-186): regenera línea base de arquitectura
4. (este push) docs(SPEC-186): registra SPEC-186 en specs/README.md + cierre.md

## Gate local

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint -- --no-cache` | ✅ (40 warnings preexistentes, 0 errores) |
| `npm run arch:check` | ✅ |
| Tests de integración SPEC-186 | ✅ 24 tests |
| Tests unitarios SPEC-186 | ✅ 14 tests |
| `npm run build` | ⏳ en ejecución / pendiente documentar |

## Tests nuevos / actualizados

- `src/lib/monitoreo/probes.test.ts` — ping, piggyback, smoke real, throttling.
- `src/app/api/admin/monitoreo/historial/route.test.ts` — endpoint de historial + resumen 24h.
- `src/components/modules/monitoreo/OperacionTableroClient.test.tsx` — apertura del modal Cerebro IA.
- `prisma/seed-security.test.ts` — seed mixto idempotente (params nuevos UPDATE, viejos DO NOTHING).

## Decisiones y candados

- Columna aditiva `HealthProbe.metodo` (`String? @default("SMOKE")`) con migración aditiva; probes históricos se reportan como `SMOKE`.
- Seed mixto (I-65): params nuevos/cambiados de SPEC-186 se aplican con `update`; los 13 params viejos de SPEC-171 se siembran solo si faltan (`update: {}`).
- Frontera DAL respetada: `probes.ts` e `incidentes.ts` no importan `prisma`; todo pasa por `MonitoreoRepository` / `ClasificacionIARepository`.
- No se tocó `src/lib/ai/**`; solo se consulta `ClasificacionIA` para piggyback.
- Migración 100% aditiva; cero `DROP`.
- Cobertura I-51 conservada e incluso mejorada: caída total detectada en ≤1 min por ping; clasificación rota detectada en ≤30 min por smoke real.

## Hallazgos / notas

- Durante el cierre se encontraron archivos no commiteados de SPEC-185 en el working tree (`sugerencias-simulador.ts`, `descripcion-escenario.ts`, `reparar-simulaciones-fechafin.mjs`, etc.). Se movieron a `/tmp/spec185-wip-20260820/` para no contaminar el push de SPEC-186; el stash original de SPEC-185 (`stash@{0}`) los preserva.
- El working tree de `work/002-pi-081` queda limpio salvo `specs/README.md` y el nuevo `cierre.md`.

## Instrucciones para validación manual

1. Asegurar que Ollama esté vivo y el parámetro `ia.rubrica.modelos[0]` configurado.
2. Ver tablero `/dashboard/admin/estadisticas/operacion` → tarjeta "Cerebro IA" → click para abrir historial.
3. Con tráfico real reciente, el resumen debe mostrar piggybacks y pocos (o cero) smokes reales.
4. Tras 30 min sin tráfico ni smoke, debe aparecer un `SMOKE` real en el historial.

## Señal a ZEUS

`002-PI-081 · REALIZADO · <hash> · PR`
