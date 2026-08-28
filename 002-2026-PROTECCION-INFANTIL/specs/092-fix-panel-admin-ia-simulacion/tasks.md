# TASKS 092 — Fix Panel Admin IA + Simulación (002-PI-300)

Orden de ejecución. Cada tarea es atómica y verificable.

## T-1 · I-161 · Cambio quirúrgico en `progreso.ts`

- **Archivo:** `src/lib/simulacion/progreso.ts`
- **Rango:** líneas 50-52.
- **Acción:** reemplazar el bloque `if (["COMPLETADA", "FALLIDA", "CANCELADA"]...)` por los dos bloques descritos en `plan.md §3.1`.
- **Verificación:** `grep -n '"COMPLETADA", "CANCELADA"' src/lib/simulacion/progreso.ts` retorna 1 línea; `grep -n 'run.estado === "FALLIDA"' src/lib/simulacion/progreso.ts` retorna 1 línea.

## T-2 · I-161 · Tests en `progreso.test.ts`

- **Archivo:** `src/lib/simulacion/progreso.test.ts`
- **Acción:** dentro del `describe("progreso.ts — actualizarProgresoYEstado", ...)` agregar los 3 tests A/B/C descritos en `plan.md §4.1`.
- **Verificación:** `npm run test -- src/lib/simulacion/progreso.test.ts` verde con los 3 tests nuevos identificables por su título ("I-161 rescata FALLIDA...", "I-161 no rescata FALLIDA...", "I-161 CANCELADA intacta...").

## T-3 · I-160 · Endpoint nuevo `todos/route.ts`

- **Archivo:** `src/app/api/config/parametros/todos/route.ts` (creación).
- **Acción:** implementar `GET` admin-only según `plan.md §3.2`. Reutilizar `AppError`, `ERROR_CODES`, `verifyAuth`, `assertModulo`, `NextResponse`.
- **Verificación:** `curl -s http://localhost:5005/api/config/parametros/todos -b cookies.txt | jq '.items | length'` retorna un número > 0 (con sesión ADMIN); sin sesión responde 401/403.

## T-4 · I-160 · Test del endpoint

- **Archivo:** `src/app/api/config/parametros/todos/route.test.ts` (creación).
- **Acción:** implementar tests D y E descritos en `plan.md §4.2`.
- **Verificación:** `npm run test -- src/app/api/config/parametros/todos/route.test.ts` verde con 2 tests.

## T-5 · I-160 · Cambio de URL en `ConfigPanel.tsx`

- **Archivo:** `src/components/modules/ConfigPanel.tsx`
- **Línea:** 31.
- **Acción:** cambiar `fetch("/api/config/parametros", ...)` por `fetch("/api/config/parametros/todos", ...)`.
- **Verificación:** `grep -n "/api/config/parametros" src/components/modules/ConfigPanel.tsx` muestra la URL nueva; verificación funcional manual → `ConfigPanel` en dev carga todos los parámetros.

## T-6 · I-162 · Default puerto en `ollama-config.ts`

- **Archivo:** `src/lib/ai/ollama-config.ts`
- **Línea:** 4.
- **Acción:** cambiar `"http://localhost:11434"` por `"http://localhost:11435"`.
- **Verificación:** `grep -n "11434" src/lib/ai/ollama-config.ts` no retorna resultados.

## T-7 · I-162 · Puerto en `.env.example`

- **Archivo:** `.env.example`
- **Línea:** 16.
- **Acción:** cambiar el literal a `OLLAMA_BASE_URL="http://localhost:11435"  # daemon launchd com.idc.ollama-serve (KEEP_ALIVE=24h)`.
- **Verificación:** `grep -n "11434" .env.example` no retorna resultados.

## T-8 · Gate local

- **Comando:** `npx tsc --noEmit && npm run test:unit`
- **Verificación:** ambos comandos verdes.

## T-9 · Commit único + push + PR

- **Acción:** commit atómico con el mensaje descrito en `plan.md §6`, push a `work/002-PI-300`, `gh pr create --base main`.
- **Verificación:** URL del PR emitida.

## T-10 · Señal de cierre

- **Señal:** `desarrollo-1: 002-PI-300 · REALIZADO · <hash-commit> · I-160+I-161+I-162`.

---

## Fuera de alcance (recordatorio)

- Simulaciones activas `cmtd60m0*`.
- `MAX_PAGE_SIZE` global (queda en 100).
- `.env.production` del VPS (lo actualiza Jelkin con `sed`).
- Endpoint de recalcular manual (no existe; se documenta en el cierre si aplica).
