# Research — SPEC-311 · Ficha colegio admin Fase 2 (rediseño 4 bloques A→D)

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

## Verificaciones en fuente (candado 15 · pre-tasks)

### V1 · Contrato de Fase 1 (repo `ColegioActividadRepository`)

Leído en `src/lib/dal/repositories/colegio-actividad.ts`:
- `actividadDelColegio(colegioId, rango): Promise<ActividadDelColegio>`
- Devuelve `{ reportes: ReporteResumen[], total, porEstado, casosAbiertos, ultimaActividad }`
- `ReporteResumen` = `{ id, estado, creadoEn }`
- Multi-tenant estricto, dedup por `Reporte.id`, 3 rutas (tenantId autor · identificadores enrolados · AlertaColegio).

**Reusable para Fase 2**:
- Llamarlo con `rango = { desde: colegio.fechaRegistro, hasta: now }` para `lineaTiempo` y `serieMensual` all-time.
- Llamarlo con `rango = últimos 30 días` (o el `periodo_default_dias`) para `distribucionRol` (limitado al rango vigente por consistencia con el resto de la ficha).

**NO se puede reutilizar directamente para**:
- `distribucionRol`: requiere `usuarioId`, `esAnonimo`, `origenRol` (SPEC-295) y `Usuario.rol`. `ReporteResumen` solo tiene `id/estado/creadoEn`. Necesito una query separada en `analytics-colegio.ts` sobre los IDs devueltos por `actividadDelColegio`.

### V2 · `analytics-colegio.ts` (payload existente Fase 1)

Leído en `src/lib/dal/repositories/analytics-colegio.ts`:
- Método `detalleColegio(colegioId)` devuelve `ColegioDetalleResponse` con bloques ya definidos (`infoBasica`, `metricasTamaño`, `actividadReportes`, `actividadReportesCruzada`, `comite`, `alertas`, `hallazgos`, `comparacionMedia`, `umbralesSemaforo`).
- Ya invoca `ColegioActividadRepository.actividadDelColegio` para el bloque `actividadReportesCruzada`.
- Todas las queries van dentro de `Promise.all` con `contarTamañoColegio`, `metricasReportesColegio`, `metricasComiteColegio`, `metricasAlertasColegio`.

**Extensión Fase 2**: añadir 4 llamadas más al `Promise.all`:
1. `actividadDelColegio(id, rangoAllTime)` para `lineaTiempo` + `serieMensual`.
2. Query DISTINCT `AlertaColegio.asignadoA` → `Usuario.{id, nombre, email}` para `operadoresAsignados`.
3. Query separada con los IDs de reportes de `actividadReportesCruzada.reportes` para agrupar por rol reportante → `distribucionRol`.

Todas paralelas (cero N+1 nuevo).

### V3 · `analytics-colegio-types.ts`

Leído. Ya declara `ColegioDetalleResponse` con la extensión aditiva de Fase 1. Añadiré 4 nuevos campos al tipo:
```ts
distribucionRol: { padre: number; estudiante: number; profesor: number; anonimo: number };
operadoresAsignados: Array<{ id: string; nombre: string; email: string }>;
lineaTiempo: { fechaRegistro: string; primerReporte: string | null; picoActividad: { anioMes: string; total: number } | null; hoy: string };
serieMensual: Array<{ anioMes: string; total: number }>;
```

### V4 · Componentes vivos reutilizables

- `src/components/modules/BarChart.tsx` (65 líneas · SVG puro) — recibe `{data: {label, value}[], ariaLabel?}`. Sirve para distribución por estado y por rol.
- `src/components/modules/colegio/home/TendenciaReportes.tsx` (139 líneas · Recharts AreaChart + toggle semanal/mensual/anual) — recibe series de `PuntoTendencia`. Para el Bloque B necesito la serie mensual — importar `PuntoTendencia` de `colegio-resumen.ts` y adaptar `serieMensual` al shape esperado.
- `src/components/modules/colegio/estadisticas/RitmoMensual.tsx` (104 líneas) — Recharts AreaChart · más simple. Alternativa si TendenciaReportes es demasiado (tiene toggle, para admin no necesito).

**Decisión**: uso `RitmoMensual` para el Bloque B (más chico y directo) o adapto `TendenciaReportes` sin el toggle. Elección final en implement.

### V5 · Rutas admin destino de CTAs

Necesito verificar `/dashboard/admin/reportes` y `/dashboard/admin/alertas` admitan `?colegioId=`. Se hará en implement (candado 17 D-98 si fallan).

Búsqueda preliminar (no exhaustiva):
- `src/app/dashboard/admin/reportes/` — existe (asumido).
- `src/app/dashboard/admin/alertas/` — existe (asumido, hay referencias en el proyecto).

Si alguna no admite el filtro, dos opciones:
- (a) Añadir el filtro en la ruta correspondiente (ampliación aditiva del server component). Requiere cambio menor.
- (b) Reabrir §4, actualizar spec para omitir el CTA correspondiente o llevarlo a otra ruta existente.

Decisión pre-implement: PARO y reporto HALLAZGO si (a) requiere > 20 líneas o toca lógica sensible.

### V6 · Enum `RolUsuario` (para `distribucionRol`)

Leído en `prisma/schema.prisma`:
```
enum RolUsuario {
  ADMIN
  SCHOOL_ADMIN
  PARENT
  OPERADOR
  COMITE_VALIDACION
  COMITE_CONVIVENCIA
}
```

Mapeo a categorías del brief §6.2 (padre/estudiante/profesor/anónimo):
- `PARENT` → `padre` (natural).
- `SCHOOL_ADMIN` / `OPERADOR` / `COMITE_VALIDACION` / `COMITE_CONVIVENCIA` → `profesor` (personal del colegio). Único bucket para "personal".
- `ADMIN` → NO debería aparecer como autor de reportes (excluir o clasificar como `anonimo` con warning).
- `usuarioId = null` o `esAnonimo = true` → `anonimo`.
- `origenRol = "PARENT"` (SPEC-295, autoreporte padre autenticado) → `padre` sin depender de `Usuario.rol`.
- `estudiante`: NO existe como `RolUsuario` — el estudiante NO tiene cuenta propia en el sistema. Sale del brief pero técnicamente no aplica; siempre será 0 en la realidad actual. Se conserva la categoría en el shape para no romper contrato futuro.

**Decisión** (registrable): la categoría `estudiante` siempre será 0 en Fase 2 porque no hay reportes generados por estudiantes en el sistema actual. Documentado en `data-model.md`.

### V7 · `AlertaColegio.asignadoAId`

Leído en `prisma/schema.prisma:1381`: FK opcional a `Usuario`. Los operadores asignados son los `Usuario` distintos referenciados en `AlertaColegio.asignadoA` para las alertas del colegio.

Query planeada (dentro de `analytics-colegio.ts` en `Promise.all`):
```ts
const operadores = await this.db.usuario.findMany({
  where: { alertasAsignadas: { some: { colegioId } } },
  select: { id: true, nombre: true, email: true },
  distinct: ["id"],
});
```

(La relación `alertasAsignadas` existe si Prisma la genera automáticamente desde `AlertaColegio.asignadoA @relation(...)`; si no, uso subquery raw. Verifico en implement.)

## Decisiones del plan

### D1 · Composición en `analytics-colegio.ts` (NO modificar `colegio-actividad.ts`)

**Decision**: las 4 ampliaciones del payload viven en `analytics-colegio.ts`, componiendo con `ColegioActividadRepository.actividadDelColegio` (llamado 2 veces: rango vigente + rango all-time) más queries adicionales para `operadoresAsignados` y `distribucionRol`.

**Rationale**: El instructivo prohíbe tocar `colegio-actividad.ts` (contrato Fase 1 inmutable). Toda la lógica nueva es analítica derivada — encaja naturalmente en `analytics-colegio.ts` que ya compone las queries del detalle.

**Alternativas descartadas**:
- Modificar `colegio-actividad.ts` con nuevos métodos — descartado por candado del instructivo y por SRP (el repo Fase 1 es "reportes del colegio", no "reportes agrupados por rol").
- Crear un repo nuevo `ColegioRediseñoRepository` — descartado por over-engineering; 4 métodos privados en `analytics-colegio.ts` alcanzan.

### D2 · Componente rediseñado: rebautizar in-place `ColegioDetalleSecciones` → `ColegioDetalleFichaV2`, o modificar in-place

**Decision**: modificar `ColegioDetalleSecciones.tsx` in-place con los 4 bloques A→D. NO renombrar el archivo para preservar imports existentes (`ColegioDetalleClient.tsx` importa de esta ruta).

**Rationale**:
- Renombrar rompe el import en `ColegioDetalleClient.tsx` — cambio innecesario que amplía el blast radius.
- Modificar in-place: el `git diff` muestra claro qué cambia (jerarquía visual) y qué se conserva (todos los datos de las 7 secciones).
- Los tests miden por atributos del DOM (títulos de bloque, presencia de campos), no por nombre de archivo.

**Alternativa descartada**: crear `ColegioDetalleFichaV2.tsx` nuevo y modificar `ColegioDetalleClient.tsx` para importarlo — cambio más grande sin beneficio claro.

### D3 · Bloque C: componente nuevo `ColegioLineaTiempo`

**Decision**: componente separado `ColegioLineaTiempo.tsx` con visualización horizontal SVG puro (o CSS flex con markers absolutos). Sin librería nueva.

**Rationale**:
- No es reutilizable por otros bloques.
- SVG puro para 4 marcadores es < 60 líneas de código, sin dep.
- Testeable en aislamiento (unit test simple).

**Alternativa descartada**: incrustar la línea de tiempo directo en `ColegioDetalleSecciones.tsx` — dificultaría testing y aumentaría complexity del componente principal (ya cerca del límite lint 20).

### D4 · Verificación de rutas admin destino de CTAs — pre-implement obligatorio

**Decision**: durante `/speckit-implement` T-0, verificar con `grep` o inspección directa que `/dashboard/admin/reportes` y `/dashboard/admin/alertas` admiten `?colegioId=`. Si al menos una NO admite:
- (a) Si añadir el filtro es < 20 líneas + query trivial en el server component: ampliar la ruta como parte del PR (aditivo, sin romper).
- (b) Si requiere > 20 líneas o toca lógica sensible: **PARO**, actualizo spec (FR-003 y edge case), reabro §4 con Fábrica.

**Rationale**: candado 17 D-98. Precedente registrable para Fase 2 más profunda.

### D5 · Categoría `estudiante` en `distribucionRol`

**Decision**: mantener la categoría `estudiante` en el shape del payload aunque siempre valga 0 en la realidad actual (no hay `RolUsuario.STUDENT` ni reportes generados por estudiantes autenticados).

**Rationale**: el brief §6.2 declara las 4 categorías. Mantener el shape estable para futuras extensiones (si en el futuro se añade `RolUsuario.STUDENT` o autoreporte estudiantil, el frontend no necesita cambiar).

**Alternativa descartada**: 3 categorías (padre/profesor/anónimo) — desviación del brief.

### D6 · Rendimiento — `serieMensual` all-time podría ser grande

**Decision**: `serieMensual` cubre desde `primerReporte` hasta hoy. Si el colegio tiene 5+ años de historia, son 60+ puntos, todavía renderizables por Recharts AreaChart sin problemas. Sin agrupación por trimestre en Fase 2. Si SC-009 falla por esto, se agrega agrupación en un mini-fix.

**Rationale**: la mayoría de colegios en prod tiene < 12 meses de historia; el edge case de 5+ años es aún raro.

### D7 · Cache — reutilizar el TTL existente

**Decision**: el endpoint `/api/admin/analytics/colegios/[id]` ya cachea con `analytics.colegios.cache_ttl_min` (5 min default). El payload ampliado hereda ese cache automáticamente. Cero cambios de cache.

**Rationale**: SC-009 se protege también por cache. El primer request post-cambio pagará el precio; los siguientes en la ventana TTL son rápidos.

## Deuda técnica creada

- **`operadoresAsignados` puede ser lento** si un colegio tiene 1000+ alertas con muchos usuarios distintos. Mitigación: `distinct` en Prisma o subquery raw. Verificar en implement.
- **`distribucionRol` requiere query separada** sobre los IDs de reportes (findMany + groupBy o dos queries). Costo: ~1 query adicional dentro de `Promise.all` — no impacta latencia global si va en paralelo.
- **La categoría `estudiante` siempre es 0** en el estado actual del sistema — deuda documentada.
- **Rutas admin `/dashboard/admin/reportes` y `/dashboard/admin/alertas`** pueden no admitir `?colegioId=` — deuda contingente evaluada en implement.

## Referencias

- Brief `BRIEF-FICHA-COLEGIO-ADMIN.md` §6.2 (layout 4 bloques) + §9 (SC-006/007/009)
- Instructivo `INSTRUCTIVO-002-PI-210-FICHA-COLEGIO-ADMIN-FASE-2.md`
- SPEC-303 Fase 1 (repo `ColegioActividadRepository`, payload `actividadReportesCruzada`, `umbralesSemaforo`)
- SPEC-295 (origenRol para autoreporte PARENT)
- I-98 (`04-INCIDENCIAS.md:113`)
- `prisma/schema.prisma` (modelos `Usuario`, `AlertaColegio`, `Reporte`, `Colegio`)
