# SPEC-027 · Widget estado sistema proactivo

> **Radicado:** BI · SPEC-027 (INSTRUCTIVO-014 · A-51 §3-D) · **F3C:** 2026-08-29
> **Rama:** `work/bi-SPEC-027-widget-estado` · base `main`

## 1. Problema
Admin no ve rápido si bi-vanna/Superset/PI están vivos ni cuándo se procesó el último reporte. Diagnóstico manual = SSH + curl.

## 2. Objetivo
Endpoint agregador `GET /api/bi/estado-sistema` que agrupa 3 healthchecks independientes + timestamp del último `BIConsultaLog`, más un widget que consume ese endpoint. Un servicio caído NO tumba los otros dos (candado 9).

## 3. Alcance
**Dentro:**
- `src/app/api/bi/estado-sistema/route.ts` (GET nuevo):
  - `vanna`: `GET ${VANNA_BASE_URL}/health` (timeout 3s). Reporta `{ok, modelosDisponibles?, latenciaMs?, error?}`.
  - `superset`: `GET ${SUPERSET_INTERNAL_URL || http://bi-superset:8088}/health` (timeout 3s). Falla → `{ok: false, error: "no_disponible"}` sin tumbar la ruta.
  - `pi`: `GET ${PI_BASE_URL}/api/health` (timeout 3s). Mismo tratamiento.
  - `ultimoReporte`: `prisma.bIConsultaLog.findFirst({orderBy:{creadoEn:'desc'}, select:{id,estado,creadoEn,latenciaMs}})`. Si falla la BD → `null` con `error`.
  - Todo dentro de un `Promise.allSettled` para paralelizar y aislar fallas.
  - Responde 200 SIEMPRE (o 503 solo si los 4 fallan). Body: `{vanna, superset, pi, ultimoReporte, tsGeneradoEn}`.

- `src/components/bi/estado/EstadoSistemaWidget.tsx` (nuevo · Client Component):
  - Consume el endpoint via `fetch` + polling opcional (por default una sola vez al montar).
  - Renderiza 4 pastillas: 3 servicios (verde/rojo con label) + card "último reporte" con fecha relativa.
  - Loading skeleton mientras no hay data.

- Tests unit (mock de `fetch`):
  - Vanna up + Superset down + PI up → widget muestra 2 verdes 1 rojo, no crashea.
  - BD down → widget muestra 3 pastillas + "sin datos de reportes".
  - Todos up → widget muestra 4 verdes.

**Fuera (regla dura instructivo):**
- `src/lib/bi/motor.ts`, `/api/bi/{preguntar,aprobar,rechazar}`, `src/lib/auth/`, `src/lib/dal/**`, `superset/**`, `scripts/**` NO se tocan.

## 4. Contrato de respuesta
```ts
type EstadoServicio = { ok: boolean; latenciaMs?: number; error?: string; detalle?: Record<string, unknown> };
type EstadoSistema = {
  vanna: EstadoServicio;
  superset: EstadoServicio;
  pi: EstadoServicio;
  ultimoReporte: { id: string; estado: string; creadoEn: string; latenciaMs: number | null } | null;
  ultimoReporteError?: string;
  tsGeneradoEn: string; // ISO
};
```

## 5. Verificación en vivo (candado 14)
- Con Superset pausado (Jelkin lo hace ahora): la ruta responde 200, `superset.ok === false`, `superset.error === "no_disponible"`, y `vanna.ok` + `pi.ok` reflejan realidad.
- Sin Ollama alcanzable: `vanna.ok === false` con `error: "vanna_unreachable"`.

## 6. Criterios de aceptación
- [ ] `Promise.allSettled` (nunca `Promise.all`) para no colapsar por 1 falla.
- [ ] Timeout individual 3s por servicio (`AbortSignal.timeout`).
- [ ] Widget renderiza estado parcial (loading / partial / full).
- [ ] Tests unit cubren los 3 escenarios listados.
- [ ] `npm run build && npm run typecheck && npm run test:unit && bash scripts/ratchets/run-all.sh` verde.
- [ ] Candado 15: nombre de tabla/campo verificado contra `prisma/schema.prisma` (`bIConsultaLog` · campos `creadoEn`, `estado`, `latenciaMs`, `id`).

## 📋 Control
| Campo | Valor |
|---|---|
| Radicado | BI · SPEC-027 |
| F3C | 2026-08-29 |
| Autor | dev-bi-1 (idc-5e) |
| Estado | 🟡 spec+plan |
