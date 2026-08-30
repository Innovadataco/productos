# PLAN-025 · Widget KPIs live (Home)

## Fases

### F1 · Endpoint `GET /api/bi/kpis`

Archivo nuevo: `src/app/api/bi/kpis/route.ts`.

Estructura:

```ts
import { NextResponse } from "next/server";
import { sesionDeRequest } from "@/lib/auth/sesion";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"; // KPIs live · sin cache

async function fetchHealth(url: string, timeoutMs = 3000) {
  const t0 = performance.now();
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    const ok = r.ok;
    return { ok, latMs: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, latMs: null, error: e instanceof Error ? e.message : "err" };
  } finally { clearTimeout(to); }
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export async function GET(req: Request) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // KPI 1..5 · queries paralelas contra bi-db-replica
  const [reportes24h, alertasActivas, colegiosActivos, suscActivas, mrrMes, upBiVanna, upPiApp] =
    await Promise.all([
      safeQuery(() => prisma.$queryRaw<{ v: bigint | null }[]>`
        SELECT COALESCE(SUM(total_reportes), 0)::bigint AS v
        FROM mv_fact_reporte_diario
        WHERE dia >= NOW() - INTERVAL '24 hours'
      `, [{ v: null }] as any),
      safeQuery(() => prisma.$queryRaw<{ v: bigint | null }[]>`
        SELECT COALESCE(SUM(total_alertas_colegio + total_alertas_suscripcion), 0)::bigint AS v
        FROM mv_fact_salud_sistema
        WHERE dia >= (NOW() AT TIME ZONE 'America/Bogota')::date - 7
      `, [{ v: null }] as any),
      safeQuery(() => prisma.$queryRaw<{ v: bigint | null }[]>`
        SELECT count(*)::bigint AS v FROM "Colegio" WHERE estado = 'activo'
      `, [{ v: null }] as any),
      safeQuery(() => prisma.$queryRaw<{ v: bigint | null }[]>`
        SELECT count(*)::bigint AS v FROM "Subscription" WHERE estado = 'activo'
      `, [{ v: null }] as any),
      safeQuery(() => prisma.$queryRaw<{ v: number | null }[]>`
        SELECT COALESCE(SUM(monto_total), 0)::float8 AS v
        FROM mv_fact_comercial_mensual
        WHERE mes = date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')
          AND ciclo_estado = 'pagado'
      `, [{ v: null }] as any),
      fetchHealth(`${process.env.VANNA_API_URL ?? "http://bi-vanna:8001"}/health`),
      fetchHealth(`${process.env.PI_BASE_URL ?? "https://pi.innovadataco.com"}/api/health`),
    ]);

  const toNum = (rows: { v: bigint | number | null }[]): number | null => {
    const v = rows[0]?.v;
    if (v === null || v === undefined) return null;
    const n = typeof v === "bigint" ? Number(v) : v;
    return n === 0 ? null : n; // candado 9 · 0 filas = sin datos
  };

  return NextResponse.json({
    generadoEn: new Date().toISOString(),
    kpis: {
      reportes24h:     { valor: toNum(reportes24h) },
      alertasActivas:  { valor: toNum(alertasActivas) },
      colegiosActivos: { valor: toNum(colegiosActivos) },
      suscActivas:     { valor: toNum(suscActivas) },
      mrrMesActualCop: { valor: toNum(mrrMes) },
      uptime: {
        biNext:  { ok: true, latMs: 0 },  // self · el propio endpoint responde
        biVanna: upBiVanna,
        piApp:   upPiApp,
      },
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
```

Notas clave:
- `safeQuery` aísla cada fallo (MV inexistente, permiso denegado). El endpoint devuelve 200 aunque una query falle; ese KPI aparece como "sin datos".
- `toNum` convierte `bigint` → `number` y aplica candado 9: si es 0, devuelve `null` (interpretado en UI como "sin datos aún").
- `biNext` es self, siempre `ok: true` (si el endpoint responde, bi-next está up por definición).

### F2 · Componente `KpisDashboardHome`

Archivo nuevo: `src/components/bi/kpis/KpisDashboardHome.tsx`.

```tsx
"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";

type Kpis = { /* mismo shape que la respuesta del endpoint */ };

export function KpisDashboardHome() {
  const [data, setData] = useState<Kpis | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bi/kpis", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(setData)
      .catch(e => setErr(e.message));
  }, []);

  if (err) return <ErrorState title="No se pudieron cargar los KPIs" description={err} />;
  if (!data) return <div className="animate-pulse">Cargando KPIs…</div>;

  const k = data.kpis;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard title="Reportes últimas 24 h" value={k.reportes24h.valor} format="int" />
      <KpiCard title="Alertas activas (7 d)"  value={k.alertasActivas.valor} format="int" />
      <KpiCard title="Colegios activos"       value={k.colegiosActivos.valor} format="int" />
      <KpiCard title="Suscripciones activas"  value={k.suscActivas.valor} format="int" />
      <KpiCard title="MRR mes actual (COP)"   value={k.mrrMesActualCop.valor} format="cop" />
      <UptimeCard uptime={k.uptime} />
    </div>
  );
}
```

`KpiCard` interno: valor grande + subtítulo; si `value===null` → gris "sin datos aún".
`UptimeCard`: 3 chips con `bg-green-100`/`bg-red-100` + `ok · Nms` o `error`.

### F3 · Integración en `/dashboard`

`src/app/dashboard/page.tsx` (creado por SPEC-024 con placeholder) se modifica para incluir `<KpisDashboardHome />`:

```tsx
import { KpisDashboardHome } from "@/components/bi/kpis/KpisDashboardHome";

export default function DashboardHomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Home BI</h1>
      <KpisDashboardHome />
      {/* SPEC-027: EstadoSistemaWidget */}
      {/* SPEC-028: SupersetLink */}
    </section>
  );
}
```

**Coordinación con SPEC-024**: si SPEC-024 aún no está en `main` al momento de implementar SPEC-025, se hace `git merge origin/work/bi-SPEC-024-layout-sidebar` o se espera a que Fábrica mergee.

### F4 · Tests unitarios

`tests/unit/bi-kpis-endpoint.test.ts` (mock de prisma y fetch):
- Test 1: sin sesión → 401.
- Test 2: sesión válida + todas las queries OK → shape esperado.
- Test 3: mv vacía (0 filas) → `valor: null` (candado 9).
- Test 4: query lanza excepción → `valor: null` + endpoint sigue devolviendo 200.
- Test 5: bi-vanna healthcheck timeout → `uptime.biVanna.ok: false`.

`tests/unit/bi-kpis-componente.test.tsx`:
- Test 1: loading state inicial.
- Test 2: render con data completa (6 tarjetas visibles).
- Test 3: KPI con `valor: null` → texto "sin datos aún".
- Test 4: uptime.piApp.ok=false → chip rojo con "error".

### F5 · Gate local

- `rm -rf .next && npm run build`.
- `npm run typecheck`.
- `npm run test:unit`.
- `bash scripts/ratchets/run-all.sh` (4/5 esperados verdes · mv-schema-check SKIP en Dev BI-2).
- Prueba `curl -H "Cookie: session=<jwt-dev>" http://localhost:3001/api/bi/kpis` — inspeccionar shape.

### F6 · Push

- `git add src/app/api/bi/kpis src/components/bi/kpis src/app/dashboard/page.tsx tests/unit/bi-kpis-*.test.* .specify/specs/025-widget-kpis-live/`
- `git commit -m "feat(bi): SPEC-025 widget KPIs live"`
- `git push origin work/bi-SPEC-025-kpis-live`

---

## Dependencias

- **`src/lib/auth/sesion.ts`** (SOLO LECTURA · usado por el endpoint).
- **`src/lib/prisma.ts`** (SOLO LECTURA · singleton existente).
- **Migración `20260828120100_mv_fact_bi/migration.sql`** (SOLO LECTURA · define las 5 MVs).
- **Endpoint `/api/health` de bi-next** (SOLO LECTURA · devuelve `{status:"ok"}`).
- **Endpoint `/health` de bi-vanna** (SOLO LECTURA · shape `{ok, service, modelosDisponibles, modelosConfigurados, ollamaLatMs}`).
- **Endpoint `${PI_BASE_URL}/api/health`** (asumido existente · si no responde, uptime.piApp muestra error, no rompe).

**Bloqueado por:** REVISO de Fábrica antes de PASO 4. Coordinación con SPEC-024 (si aún no mergeado, hacer merge de esa rama al implementar).

---

## Artefactos producidos

- `src/app/api/bi/kpis/route.ts`
- `src/components/bi/kpis/KpisDashboardHome.tsx`
- `src/app/dashboard/page.tsx` (modificado · agrega `<KpisDashboardHome />`)
- `tests/unit/bi-kpis-endpoint.test.ts`
- `tests/unit/bi-kpis-componente.test.tsx`

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 21:0x COT |
| **Autor** | Dev BI-2 |
