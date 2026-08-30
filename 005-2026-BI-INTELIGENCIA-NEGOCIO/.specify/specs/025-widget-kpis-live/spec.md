# SPEC-025 · Widget KPIs live (Home)

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 025 |
| **Nombre** | widget-kpis-live |
| **Origen** | BI · INSTRUCTIVO-012 · F3C 2026-08-29 20:29 COT · Brief A-51 §3-B |
| **Audiencia** | Admin/analista (Jelkin) · Home BI |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Poblar el Home (`/dashboard`, esqueleto de SPEC-024) con 6 KPIs live que responden "¿cómo está el negocio hoy?". Datos desde las 5 MVs materializadas (`mv_fact_*`, migración `20260828120100_mv_fact_bi`) y desde healthchecks HTTP de los 3 servicios (bi-next, bi-vanna, pi-app). Endpoint nuevo `GET /api/bi/kpis` + componente `KpisDashboardHome`.

---

## Alcance · 6 KPIs

| # | KPI | Fuente real (candado 15) | Formato |
|---|---|---|---|
| 1 | Reportes últimas 24 h | `mv_fact_reporte_diario` · `SUM(total_reportes) WHERE dia >= NOW()::date` | número entero |
| 2 | Alertas activas | `mv_fact_salud_sistema` · `SUM(total_alertas_colegio + total_alertas_suscripcion) WHERE dia >= NOW()::date - 7` | número entero |
| 3 | Colegios activos | `SELECT count(*) FROM "Colegio" WHERE estado='activo'` (tabla PI replicada por pg_logical a `bi-db-replica`) | número entero |
| 4 | Suscripciones activas | `SELECT count(*) FROM "Subscription" WHERE estado='activo'` | número entero |
| 5 | MRR mes actual (COP) | `mv_fact_comercial_mensual` · `SUM(monto_total) WHERE mes = date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') AND ciclo_estado='pagado'` | COP sin decimales |
| 6 | Uptime servicios | fetch a `GET /api/health` (bi-next · self) + `${VANNA_API_URL}/health` (bi-vanna) + `${PI_BASE_URL}/api/health` (pi-app) — cada healthcheck independiente | `{biNext, biVanna, piApp}` con `{ok, latMs}` c/u |

**Columnas reales verificadas** contra `prisma/migrations/20260828120100_mv_fact_bi/migration.sql`. Sin nombres inventados (candado 15).

---

## Endpoint `GET /api/bi/kpis`

Server Route Handler en `src/app/api/bi/kpis/route.ts`.

### Contrato de respuesta

```ts
type KpisResponse = {
  generadoEn: string;                     // ISO timestamp
  kpis: {
    reportes24h:      { valor: number | null; nota?: string };
    alertasActivas:   { valor: number | null; nota?: string };
    colegiosActivos:  { valor: number | null; nota?: string };
    suscActivas:      { valor: number | null; nota?: string };
    mrrMesActualCop:  { valor: number | null; nota?: string };
    uptime: {
      biNext:  { ok: boolean; latMs: number | null; error?: string };
      biVanna: { ok: boolean; latMs: number | null; error?: string };
      piApp:   { ok: boolean; latMs: number | null; error?: string };
    };
  };
};
```

### Reglas

- **Candado 9 · sin datos → "sin datos"**: si una query devuelve 0 filas o la MV está vacía, `valor: null` + `nota: "sin datos aún"`. Nunca `valor: 0` cuando no hay filas.
- **Timeout por servicio en uptime**: 3 s. Timeout → `{ok: false, latMs: null, error: "timeout"}`. Uno falla, los otros dos igual se muestran.
- **Guardia de auth**: `sesionDeRequest(req)` (SOLO LECTURA). Sin sesión → 401.
- **Cache HTTP**: `Cache-Control: no-store` (KPIs son live).
- **Sin worker**: query sync directa con Prisma `$queryRaw` (los KPIs son livianos · las MVs se refrescan por `bi-mv-refresh`).

---

## Componente `KpisDashboardHome`

Client Component en `src/components/bi/kpis/KpisDashboardHome.tsx`.

- 6 tarjetas en grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- Cada tarjeta: título + valor grande + subtítulo (fuente MV / última actualización).
- Estado `loading` mientras `fetch('/api/bi/kpis')` corre.
- Estado `error` con `ErrorState` de `@/components/ui/ErrorState` si el endpoint falla.
- Cuando `valor === null` → muestra "sin datos aún" en gris (candado 9).
- Uptime: 3 chips (bi-next · bi-vanna · pi-app) con color verde/rojo + latencia ms.

### Placement

Se importa desde `src/app/dashboard/page.tsx` (esqueleto de SPEC-024) y se coloca como sección principal del Home. Este SPEC modifica ese archivo para agregar el `<KpisDashboardHome />` — el resto del layout ya está.

---

## Fuera de alcance

- Refresh automático cada X segundos (Fase 2 · hoy es fetch al montar).
- Deep-dive de cada KPI (botón "ver más" · Fase 2).
- KPIs adicionales del brief §3-B que no están en la tabla arriba (los 6 son los del INSTRUCTIVO-012).

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 9 | Sin datos → "sin datos" | `valor: null` + "sin datos aún" en UI · nunca 0 falso |
| 13 | Sanitizer PII | Ninguno de los 6 KPIs expone PII (todos son agregados) |
| 15 | Verificar en fuente | Columnas de las 5 MVs verificadas contra migración · nombres NO inventados |
| 22 | Rutas SOLO LECTURA | NO tocar `motor.ts` · `/api/bi/{preguntar,aprobar,rechazar}` · `src/lib/auth/**` · `src/lib/dal/**` · `superset/**` · `scripts/**` · `docker/vanna/**` |
| 14 | Verificación en vivo | Gate local con `npm run dev` + `curl /api/bi/kpis` con sesión de prueba |

---

## Riesgos

- **`mv_fact_reporte_diario.dia` truncada por día**: si Jelkin abre a las 00:15, el KPI "reportes 24h" solo tiene 15 min de datos (los reportes de ayer están en la fila `dia = ayer`). Mitigación: la query suma `dia >= NOW() - INTERVAL '24 hours'` (ver plan.md), no solo `dia = hoy`.
- **PI_BASE_URL no responde**: fallback documentado en el endpoint (uptime piApp muestra "error"). El widget no se cae por eso.
- **Tabla `Colegio` puede no estar replicada aún en dev**: el catálogo BI no incluye `Colegio` en `bi_catalogo_tabla`, pero la BD replicada sí tiene la tabla vía pg_logical. Query directa con `$queryRaw` funciona.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-29 21:0x COT |
| **Autor** | Dev BI-2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
