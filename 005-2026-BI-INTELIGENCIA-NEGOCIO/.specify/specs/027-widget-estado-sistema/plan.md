# SPEC-027 · plan.md · widget estado sistema

## Estrategia
1 endpoint agregador + 1 widget Client. Sin deps nuevas. `Promise.allSettled` aísla fallas (candado 9). Cada healthcheck su propio timeout 3s con `AbortSignal.timeout`.

## Archivos
- `src/app/api/bi/estado-sistema/route.ts` (nuevo · GET)
- `src/components/bi/estado/EstadoSistemaWidget.tsx` (nuevo · Client)
- `tests/unit/bi-estado-sistema-route.test.ts` (nuevo)
- `tests/unit/bi-estado-sistema-widget.test.tsx` (nuevo)

## Env vars leídas
- `VANNA_BASE_URL` (default `http://bi-vanna:8001`)
- `SUPERSET_INTERNAL_URL` (default `http://bi-superset:8088`)
- `PI_BASE_URL` (default `https://pi.innovadataco.com`)

## Firma endpoint
```ts
// GET /api/bi/estado-sistema
type EstadoServicio = { ok: boolean; latenciaMs?: number; error?: string; detalle?: Record<string, unknown> };
type EstadoSistema = {
  vanna: EstadoServicio;
  superset: EstadoServicio;
  pi: EstadoServicio;
  ultimoReporte: { id: string; estado: string; creadoEn: string; latenciaMs: number | null } | null;
  ultimoReporteError?: string;
  tsGeneradoEn: string;
};
```

## Widget layout
- Grid 2×2: 3 pastillas (Vanna · Superset · PI) + 1 card "último reporte".
- Estado pastilla: verde (ok), rojo (down con label), gris (loading).
- Card reporte: fecha relativa (`hace X min/h`) o "sin datos" si null.

## Reglas de aislamiento (candado 9)
- Endpoint SIEMPRE responde 200 salvo error catastrófico interno (500 solo si el runtime rompe antes de `allSettled`).
- Widget nunca rompe la página: siempre renderiza al menos su skeleton.

## Verificación fuente (candado 15)
- Prisma model: `bIConsultaLog` con `creadoEn`, `estado`, `latenciaMs`, `id` (verificado en `prisma/schema.prisma`).
- Vanna /health devuelve `{ok, modelosDisponibles, modelosConfigurados, ollamaLatMs, service}` (verificado en `docker/vanna/main.py`).

## Gate LOCAL
```
rm -rf .next && npm run build && npm run typecheck && npm run test:unit && bash scripts/ratchets/run-all.sh
```

## Push
```
git add src/app/api/bi/estado-sistema src/components/bi/estado tests/ .specify/specs/027-*
git commit -m "feat(bi): SPEC-027 widget estado sistema proactivo"
git push origin work/bi-SPEC-027-widget-estado
```

## Fuera de scope
motor.ts · /api/bi/{preguntar,aprobar,rechazar} · src/lib/auth/ · src/lib/dal/** · superset/** · scripts/**.
