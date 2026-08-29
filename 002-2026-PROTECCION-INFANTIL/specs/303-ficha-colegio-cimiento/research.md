# Research — SPEC-303 · Ficha colegio admin Fase 1

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

## Verificaciones en fuente (candado 15 · pre-tasks)

Antes de escribir la spec y el plan, agente Explore corrió sobre la base `cc391ff32` y devolvió:

### V1 · `actividadDelColegio` NO existe

`grep -r "actividadDelColegio" src/` = 0 resultados. Método a crear desde cero. No hay riesgo de duplicación con código existente.

### V2 · Convención DAL

Los ~140 archivos de `src/lib/dal/repositories/` usan el patrón:

```ts
export class XRepository {
  private readonly db: DbClient;
  constructor(tx?: Prisma.TransactionClient) { this.db = tx ?? prisma; }
  async metodo(...) { return this.db.modelo... }
}
```

Ejemplo canónico en `src/lib/dal/repositories/colegio.ts:41-56`. Import: `import { prisma } from "@/lib/prisma"`; `import type { DbClient } from "../unit-of-work"`. La nueva clase `ColegioActividadRepository` sigue esto exactamente.

### V3 · `Reporte` NO tiene `colegioId` directo

Schema Prisma línea 1609: `Reporte` se relaciona con colegio SOLO por 3 rutas indirectas:

- **A** por `tenantId` denormalizado (Usuario del reporte comparte `tenantId` con `Colegio.tenantId @unique`).
- **B** por join `(identificador, plataformaId)` a `IdentificadorEstudiante` (→ `Estudiante.colegioId`), `IdentificadorProfesor.colegioId` (denormalizado directo), o `IdentificadorAcudiente.colegioId` (denormalizado directo).
- **C** por `AlertaColegio.reporteId` con `AlertaColegio.colegioId == colegioId` (FK directo).

Esto CONFIRMA la definición del brief §4 y explica el bug de "Sin datos": la consulta actual (verificada en `analytics-colegio.ts:96`) solo usa `tenantId`, perdiendo B y C completos.

### V4 · Estados de Reporte

Enum Prisma: `EstadoReporte { PENDIENTE, PROCESANDO, CLASIFICADO, REVISION_MANUAL, POSIBLE_SPAM, DUPLICADO, REQUIERE_ANONIMIZACION, CORREGIDO }`. Los tests marcan "visibles" (no-pendiente): `["CLASIFICADO","CORREGIDO","REVISION_MANUAL","POSIBLE_SPAM","REQUIERE_ANONIMIZACION"]`.

### V5 · `AlertaColegio.estado`

String (no enum) con valores conocidos: `nueva|vista|gestionada|escalada|cerrada`. Estados "abiertos" (requieren acción): `nueva`, `vista`, `escalada`. Estados terminales: `gestionada`, `cerrada`.

### V6 · `ParametroSistema` — namespace existente

`prisma/seed.ts:1969-1985` ya siembra 5 keys bajo prefijo `analytics.colegios.*`:

| Key | Default |
|---|---|
| `analytics.colegios.cache_ttl_min` | 5 |
| `analytics.colegios.inactividad_alerta_dias` | 45 |
| `analytics.colegios.spam_alerta_pct` | 0.5 |
| `analytics.colegios.resolucion_comite_ok_pct` | 0.8 |
| `analytics.colegios.periodo_default_dias` | 30 |

Patrón upsert real (línea 1980-1984):

```ts
await prisma.parametroSistema.upsert({
  where: { clave: p.clave },
  update: {},         // no pisar ajustes CEO (SPEC-187 · anti-I-100)
  create: p,
});
```

### V7 · Semáforo actual

`src/lib/analytics/hallazgos-colegio.ts:34-98` implementa `calcularHallazgos(umbrales, metrics)` que devuelve `{ semaforo: 'verde' | 'amarillo' | 'rojo' }` según hallazgos positivos/negativos. Invocado en `analytics-colegio.ts:105` para el detalle y en `.ts:132` para cada fila del listado.

**Estado hoy**: el semáforo YA se calcula por-fila y se expone. Lo que FALTA es la leyenda + los umbrales visibles + la columna "Reportes" + la línea de motivo.

### V8 · Endpoints existentes

- Listado: `GET /api/admin/analytics/colegios` → hoy devuelve array de items con `{ ..., semaforo }`.
- Detalle: `GET /api/admin/analytics/colegios/[id]` → hoy devuelve objeto detallado con `{ ..., semaforo, hallazgos, ... }`. Consumido por `ColegioDetalleClient.tsx` via `useEffect + fetch`.
- La ficha carga con `verificarAccesoPagina("analytics_colegios")` en el server + fetch al endpoint desde el cliente. NO hay RSC data loader.

### V9 · Componentes UI existentes

- `ColegiosAnalyticsTable.tsx` — 12 columnas actuales (Semáforo, Nombre, Ciudad, Estado, Registro, Alumnos, Profesores, 30 días, Total, Escalados, %Proc., Acciones). Sin leyenda ni tooltip.
- `ColegioDetalleSecciones.tsx` — 7 secciones exactas, `EmptyState title="Sin datos"` en línea 109 (sección "3. Actividad de reportes").

### V10 · Charts reutilizables

Confirmado: `BarChart.tsx`, `TendenciaReportes.tsx` (usa Recharts + `PuntoTendencia` de `colegio-resumen`), `RitmoMensual.tsx` (Recharts). Reuso previsto para Fase 2.

## Decisiones del plan

### D1 · Composición en endpoints, NO modificación de `analytics-colegio.ts`

**Decision**: los endpoints (`/api/admin/analytics/colegios` y `[id]/route.ts`) componen su respuesta: (a) invocan `AnalyticsColegioRepository` existente para el bloque actual (sin cambios); (b) invocan el nuevo `ColegioActividadRepository.actividadDelColegio(colegioId, últimos N días)` para el bloque `actividadReportes`; (c) leen `ParametroSistema` para el bloque `umbralesSemaforo`.

**Rationale**:
- `analytics-colegio.ts` funciona y sirve a `hallazgos-colegio.ts` (semáforo actual). Modificarlo abre la puerta a regresión difícil de aislar.
- La responsabilidad de "reportes que pertenecen al colegio" es un concepto nuevo que merece su propio repo (SRP). Meterlo dentro del repo de analytics existente violaría el principio de "un repo, una responsabilidad" (patrón visto en `alerta-colegio.ts`, `busqueda-colegio.ts`, etc. — cada uno con scope propio).
- La composición se hace en el endpoint (ya es la capa de composición natural).

**Alternatives considered**:
- **Modificar `analytics-colegio.ts`**: descartado por riesgo de regresión y por violar SRP.
- **Middleware/HOC de endpoint**: descartado por sobre-ingeniería para 2 endpoints únicos.

### D2 · Reutilizar namespace `analytics.colegios.*` (delta con instructivo)

**Decision**: las 3 keys nuevas van bajo `analytics.colegios.casos_abiertos_alto`, `analytics.colegios.casos_sin_movimiento_dias`, `analytics.colegios.porcentaje_procesado_min`. NO se crea `colegios.semaforo.*` paralelo como sugería el instructivo.

**Rationale**:
- El namespace `analytics.colegios.*` ya está en prod con 5 keys. Fragmentar en dos namespaces confunde al CEO al editar (¿por qué unas cosas viven en `analytics.colegios.*` y otras en `colegios.semaforo.*` si ambas afectan lo mismo?).
- La coherencia semántica se preserva: todos los parámetros que afectan el análisis y el semáforo del colegio viven en un solo prefijo. El semáforo es parte del "análisis del colegio".
- Costo del delta: cero técnico. Solo cambia el prefijo. La lógica es idéntica.

**Alternatives considered**:
- **Crear `colegios.semaforo.*` como pide el instructivo**: descartado por fragmentación.
- **Renombrar las 5 existentes bajo `colegios.semaforo.*`**: descartado — requiere migración de datos en prod (los CEOs pueden haber editado los valores) y rompe idempotencia del seed.

**Comunicación a Fábrica**: se destaca en la señal `spec+plan LISTO` como delta razonado. Fábrica decide si aprueba tal cual o pide `colegios.semaforo.*`; si pide el paralelo, ajuste = cambiar 3 strings en el seed + los readers en el endpoint.

### D3 · Cerrar las 4 zonas del instructivo en la spec (NO usar `/speckit-clarify`)

**Decision**: las 4 zonas del instructivo se resolvieron en la spec con defensas técnicas:

| Zona | Resolución | Fundamento |
|---|---|---|
| (i) Criterio combinado `actividadDelColegio` | UNIÓN sin duplicados por `Reporte.id` sobre las 3 rutas | Brief §4 lo define explícito con "cualquiera" (OR lógico), dedup previene doble conteo cuando el mismo reporte cumple 2+ rutas |
| (ii) "Casos abiertos" | `AlertaColegio.estado in ('nueva','vista','escalada')` + `Expediente` activos | Solo cuentan cosas que el admin puede accionar. Reportes en `REVISION_MANUAL`/`POSIBLE_SPAM` son procesamiento interno (los procesa el worker o el operador), no responsabilidad del ADMIN del colegio |
| (iii) Rango temporal default | `analytics.colegios.periodo_default_dias` (YA sembrado, 30d) | Reutiliza key existente en vez de duplicar |
| (iv) Paginado listado vs semáforo | Semáforo por-fila individual sobre datos propios del colegio. Paginado NO lo afecta. Distribución global la reporta Fábrica post-deploy con SQL sobre BD prod | Comportamiento actual del listado ya es por-fila; no cambia |

**Rationale**: `/speckit-clarify` es para ambigüedades reales sin default razonable. Aquí las 4 tienen default defendible desde brief + esquema. Ejecutar clarify por deferencia agregaría ida y vuelta sin valor.

**Alternatives considered**:
- **Correr `/speckit-clarify`**: descartado — mismo resultado con paso extra; el instructivo dice "si no cerrás en el spec" (opcional, no obligatorio).

### D4 · Query strategy: 3 subconsultas UNION + dedup por `Reporte.id`

**Decision**: la implementación de `actividadDelColegio` usa una de dos estrategias:

- **Opción A (preferida)**: single query con `Prisma.$queryRaw` que emite `SELECT DISTINCT r.* FROM Reporte r WHERE r.id IN ( (SELECT... ruta A) UNION (SELECT... ruta B) UNION (SELECT... ruta C) )`. Una sola llamada a la BD. Cero N+1. Tipos casteados con `Prisma.ReporteGetPayload<...>`.
- **Opción B (fallback)**: 3 queries Prisma en paralelo (`Promise.all`) con `findMany`, deduplicación en memoria por `Reporte.id`. Peor plan que A si el conjunto es grande pero más legible y sin `$queryRaw`.

**Rationale**: Opción A es más eficiente y controla el plan de query, pero requiere `$queryRaw` (que la constitución §3.2 no prohíbe pero desaconseja). Opción B respeta el patrón Prisma puro. **Recomendación durante `/speckit-implement`**: empezar con B, medir con el colegio más grande de prod (SC-009); si supera 800 ms, migrar a A.

**Alternatives considered**:
- **Un solo `findMany` con `where OR`**: descartado — no se puede expresar limpiamente la ruta B (join a tablas puente).
- **Vista materializada**: descartado — introduce migración destructiva y complejidad de refresh.

### D5 · Definición operativa de "Expediente activo"

**Decision**: `Expediente` con `estado != 'cerrado'` cuenta como "abierto". El schema `Expediente` (línea 2286) tiene un campo `estado` cuyo valor terminal exacto se verifica durante `/speckit-implement` (podría ser `'CERRADO'`, `'FINALIZADO'`, etc.). Se documenta el hallazgo en `plan.md` si el valor real difiere.

**Rationale**: sin acceso a los datos exactos del enum sin re-leer el schema completo, se toma el default más conservador. Si `Expediente` no tiene `estado` como esperamos, el fallback es `casosAbiertos = alertas no-cerradas` únicamente y se reporta la limitación.

**Alternatives considered**:
- **Excluir `Expediente` de `casosAbiertos`**: descartado — el brief §3 lo incluye explícito en "casos abiertos" del colegio.

### D6 · Cache o no cache en Fase 1

**Decision**: NO añadir cache. El endpoint ya lee `analytics.colegios.cache_ttl_min` (existe), pero su implementación de cache actual (si la hay) se respeta sin cambios. Si no hay cache backend hoy, tampoco se agrega en Fase 1.

**Rationale**: SC-007 pide "el update SQL directo cambia el valor devuelto en el siguiente request (sin cache o con TTL respetable menor a `cache_ttl_min`)". Añadir cache complica el afine del CEO. Fase 1 prioriza correctness sobre latencia.

**Alternatives considered**:
- **Añadir cache Redis / en memoria del endpoint**: descartado — sobre-ingeniería para volumen actual.

## Consideraciones para tests

### Test integración (nuevo)

`src/lib/dal/repositories/colegio-actividad.test.ts` con `beforeEach(await resetDatabase())` y fábricas `crearColegioConAdmin`, `crearEstudiante`, `crearIdentificadorProfesor`, `crearAcudienteEstudiante`. Fixtures:

- **Colegio A**: tenantId propio + rector con 3 reportes + 5 AlertaColegio ligadas a reportes distintos + 2 estudiantes enrolados con identificadores que aparecen como objetivo en 2 reportes.
- **Colegio B**: tenantId propio + sin alertas + un usuario con 1 reporte.
- **Colegio C**: tenantId propio + aislado (sin reportes, sin usuarios, sin alertas).

Casos:
1. `actividadDelColegio(A, últimos 30d)` → `total >= 5` (los 5 de alertas) + los 3 del rector + los 2 de identificadores enrolados, dedup si hay solape. Verificar `casosAbiertos` con las alertas en `nueva/vista/escalada`.
2. `actividadDelColegio(B, últimos 30d)` → `total = 1` (solo el reporte del usuario).
3. `actividadDelColegio(C, últimos 30d)` → `total = 0`, `casosAbiertos = 0`.
4. **A/B cross-leak** (SC-010): la actividad de A NO contiene reportes de B ni C, y viceversa.

### Test unit fórmula semáforo

Verificar que dados 4 escenarios (verde limpio, amarillo por 1 hallazgo positivo, rojo por casos_abiertos_alto, rojo por sin_movimiento_dias), la función `calcularHallazgos` existente devuelve el color esperado (sin modificar la función; solo cubrirla con casos nuevos si la cobertura actual no lo hace).

### Test componente listado

Renderizar `ColegiosAnalyticsTable` con 3 filas mock (una por color) y verificar: (a) leyenda visible sin hover; (b) columna "Reportes" con conteos correctos; (c) motivo bajo no-verdes; (d) tokens PI aplicados vía className esperado.

### Test A/B multi-tenant

Ya cubierto por caso 4 de integración.

### Test regresión ficha

`ColegioDetalleSecciones` renderiza las 7 secciones sin errores para: (a) colegio con actividad; (b) colegio sin actividad. La sección 3 muestra números en (a) y EmptyState "Aún no hay actividad registrada" en (b) — nunca más "Sin datos" cuando hay datos.

## Deuda técnica creada

- Si Opción A ($queryRaw) se activa: el SQL queda hardcodeado y requiere mantenimiento manual si cambia el schema. Mitigación: comentario en el repo indicando qué campos consume.
- Si `Expediente.estado` no tiene los valores esperados: `casosAbiertos` cae a "solo alertas no-cerradas" con nota. Deuda pequeña, se ajusta en un PR de sequía si el CEO lo pide.
- El seed sigue siendo el punto único de sembrado de params. Si aparecen ambientes que no corren el seed (dev efímero), los 3 defaults faltan y el endpoint debe fallar con default en código, no con undefined. Mitigación: el endpoint aplica default si la key no existe (defensa en profundidad).

## Referencias

- Brief `BRIEF-FICHA-COLEGIO-ADMIN.md` §4 (defecto de fondo), §5 (semáforo), §7 (modelo de datos), §11 (mapa de cola)
- Instructivo `INSTRUCTIVO-002-PI-209-FICHA-COLEGIO-ADMIN-FASE-1.md` §Alcance Fase 1
- `src/lib/dal/repositories/colegio.ts:41-56` — plantilla convención
- `prisma/seed.ts:1969-1985` — plantilla upsert anti-I-100
- `src/lib/analytics/hallazgos-colegio.ts:34-98` — fórmula semáforo actual (SOLO LECTURA)
- I-98 (`04-INCIDENCIAS.md:113`), I-104 (`04-INCIDENCIAS.md:114`)
