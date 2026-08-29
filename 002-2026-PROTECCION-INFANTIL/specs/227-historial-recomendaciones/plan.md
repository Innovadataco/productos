# Plan de implementación: SPEC-227 — Historial de recomendaciones y métricas de tuning

## 1. Resumen ejecutivo

Vista admin de solo lectura sobre `Recomendacion`/`ReglaRecomendacion` (entregadas por SPEC-221): historial paginado con filtros, métricas de tuning (tasa de aplicación, tasa de ignorada, tiempo promedio de resolución) globales y por regla, y export CSV opcional pseudonimizado. Tres endpoints nuevos, un servicio DAL, un módulo permisible nuevo y una página. Cero migraciones, cero escrituras en el dominio de recomendaciones.

## 2. Decisiones de arquitectura

### 2.1 Solo lectura sobre el modelo de SPEC-221

- SPEC-227 no crea ni altera tablas: consume `Recomendacion` y `ReglaRecomendacion` con sus índices existentes (`[estado, prioridad, generadaEn]`, `[sujetoId]`).
- Toda la consulta vive en `src/lib/dal/services/analisis-recomendaciones.ts`, siguiendo el patrón de `IaSimulacionesService` (`src/lib/dal/services/ia-simulaciones.ts`): la ruta valida y serializa; el servicio ejecuta Prisma con `Prisma.RecomendacionWhereInput` tipado.

### 2.2 Endpoints: tres rutas, un mismo contrato de filtros

- `GET /api/admin/analisis/recomendaciones` — lista paginada.
- `GET /api/admin/analisis/recomendaciones/metricas` — agregados del conjunto filtrado (sin paginación).
- `GET /api/admin/analisis/recomendaciones/export` — CSV del conjunto filtrado (sin paginación, con tope).
- Un único schema Zod `filtrosHistorialSchema` compartido por las tres rutas garantiza que "lo que ves es lo que exportas".

**Alternativa considerada**: un solo endpoint con `?formato=csv|json`. Rechazada: mezclar paginación con export en la misma ruta complica el contrato y rompe el patrón ya usado en `api/admin/ia/simulaciones/[id]/export/route.ts` (ruta dedicada para export).

### 2.3 Métricas: cálculo en SQL agregado, no en memoria

- Totales por estado: `groupBy` Prisma sobre `estado` con el `where` filtrado.
- Tiempo promedio de resolución: agregación sobre `resueltaEn - generadaEn` solo para filas con `resueltaEn` no nula. Prisma no soporta `AVG` de intervalos directamente; se usa `$queryRaw` tipado (`EXTRACT(EPOCH FROM (resuelta_en - generada_en))/3600`) dentro del DAL, o doble pasada (`groupBy` + fetch de pares de fechas del subconjunto) si el volumen filtrado es bajo. Decisión: `$queryRaw` con parámetros, documentado, restringido a columnas fijas (sin interpolación de strings de usuario).
- Tasas: calculadas en el servicio a partir de los conteos; denominador = resueltas (`APLICADA + IGNORADA + EXPIRADA`); `PENDIENTE` solo cuenta en "total generadas". División por cero → `null` (UI muestra "—").

### 2.4 Privacidad del CSV (Ley 1581)

- Columnas fijas de metadatos; **no** se exportan `titulo`, `descripcion` ni `datosContexto` (pueden llevar nombre del colegio renderizado desde la plantilla de la regla).
- `sujeto_hash` = SHA-256(`sujetoId` + `process.env.ANALISIS_EXPORT_SALT`) truncado a 16 hex. La sal vive solo en variable de entorno (documentada en `.env.example` sin valor real). Estable entre exports, irreversible.
- Tope `analisis.recomendaciones.export_max_filas` (default 5000): `count` previo; si excede → `413` con mensaje de refinar filtro.
- `AuditLog` por exportación: acción, `usuarioId`, filtros (JSON), `filasExportadas`. Sin contenido.

**Alternativa considerada**: export agregado (una fila por regla/día). Rechazada como única opción porque el ADMIN necesita el detalle por sugerencia para auditar casos concretos; el detalle pseudonimizado cumple Ley 1581 sin perder utilidad.

### 2.5 Módulo permisible y navegación

- Nueva clave `analisis_recomendaciones` en el catálogo de módulos (`prisma/seed-modulos-grants.ts`), submódulo de la sección de análisis si SPEC-222 ya registró un padre `analisis`; en caso contrario, módulo de primer nivel. Backfill: solo `ADMIN`.
- Entrada en `AdminNav` bajo análisis/estadísticas, visible solo si el módulo está otorgado (el layout ya filtra por `modulosPermitidosParaRol`).

### 2.6 Zona horaria y rangos

- `desde`/`hasta` se interpretan como día calendario `America/Bogota`: `desde` → 00:00:00 Bogotá, `hasta` → 23:59:59.999 Bogotá, convertidos a UTC para el `where`. Se reutiliza el patrón de `date-fns-tz` ya usado en el proyecto (decisión D-69 del brief).

### 2.7 UI

- Página Server Component `page.tsx` (carga inicial de filtros disponibles: lista de reglas para el select); componentes cliente para la tabla filtrable, KPIs y export (data fetching con `useEffect`, patrón del repo).
- Sistema visual heredado: vidrio Apple en cards de KPIs y tabla, color `ambar` de Admin, radios 16/12/22, Instrument en numerales si el token ya existe en el tema.
- Semáforo de tasas: `pino` (aplicación alta), `ambar` (atención), `rubi` (tasa de ignorada > `tasa_ignorada_alerta_pct`) con etiqueta "revisar umbral".
- Terminología brief §3 en UI: "Sugerencia", "Pendiente/Aplicada/Ignorada/Expirada", "Regla". Tono neutral, sin voseo.

## 3. Flujos detallados

### 3.1 Lista

```text
1. verifyAuth(ADMIN) → assertModulo(user, "analisis_recomendaciones") → rate limit admin_read.
2. Zod parse de searchParams (filtrosHistorialSchema + page/pageSize).
3. DAL construye Prisma.RecomendacionWhereInput:
   estado / reglaId / categoria / sujetoTipo / sujetoId / ejecutadaAutomatica / generadaEn gte-lte (Bogotá→UTC).
4. Promise.all([findMany(include: regla{id,clave,nombre}, orderBy generadaEn desc, skip/take), count]).
5. Respuesta { items, pagination }.
```

### 3.2 Métricas

```text
1. Misma auth/filtros (sin paginación).
2. groupBy estado con where → conteos.
3. $queryRaw: AVG(EPOCH(resuelta_en - generada_en))/3600 WHERE resuelta_en IS NOT NULL (+ filtros).
4. Lo mismo desagregado por reglaId → mapa porRegla, ordenado por tasaIgnorada desc.
5. Servicio calcula tasas (null si denominador 0) y umbral de alerta desde ParametroSistema.
```

### 3.3 Export CSV

```text
1. Misma auth/filtros + count; si count > export_max_filas → 413.
2. findMany del subconjunto (sin include pesado; join regla para clave/nombre).
3. Serializar columnas fijas con escape CSV (patrón toCsv de ia/simulaciones/export).
4. sujeto_hash = sha256(sujetoId + ANALISIS_EXPORT_SALT).slice(0,16); null si sujetoId null.
5. AuditLog (accion EXPORT, metadatos: filtros + filas).
6. Respuesta text/csv con Content-Disposition attachment.
```

## 4. Estructura de archivos propuesta

```text
src/lib/dal/services/
  analisis-recomendaciones.ts        # where tipado, lista, métricas, dataset export
  analisis-recomendaciones.test.ts

src/lib/analisis/
  filtros-historial.ts               # schema Zod compartido + tipos
  pseudonimizar.ts                   # sha256 con sal de entorno
  pseudonimizar.test.ts

src/app/api/admin/analisis/recomendaciones/
  route.ts                           # GET lista
  route.test.ts
  metricas/route.ts                  # GET métricas
  metricas/route.test.ts
  export/route.ts                    # GET CSV
  export/route.test.ts

src/app/dashboard/admin/analisis/recomendaciones/
  page.tsx                           # Server Component
  components/
    HistorialRecomendaciones.tsx     # cliente: filtros + tabla + KPIs + export
    HistorialRecomendaciones.test.tsx

prisma/seed.ts                       # 2 parámetros analisis.recomendaciones.* (idempotente)
prisma/seed-modulos-grants.ts        # módulo analisis_recomendaciones (backfill ADMIN)
src/components/modules/AdminNav.tsx  # entrada de navegación (condicionada al módulo)
.env.example                         # ANALISIS_EXPORT_SALT (sin valor real)

specs/227-historial-recomendaciones/
  spec.md, plan.md, research.md, data-model.md, quickstart.md
  contracts/227-historial-recomendaciones.md
  checklists/requirements.md
```

## 5. Interfaz pública

### 5.1 Servicio DAL

```typescript
type FiltrosHistorial = {
  estado?: EstadoRecomendacion;
  reglaId?: string;
  categoria?: string;
  sujetoTipo?: string;
  sujetoId?: string;
  ejecutadaAutomatica?: boolean;
  desde?: string; // ISO date, día calendario Bogotá
  hasta?: string;
};

class AnalisisRecomendacionesService {
  listar(filtros: FiltrosHistorial, page: number, pageSize: number): Promise<{ items: RecomendacionConRegla[]; total: number }>;
  metricas(filtros: FiltrosHistorial): Promise<MetricasHistorial>;
  prepararExport(filtros: FiltrosHistorial): Promise<{ filas: FilaExport[]; total: number }>;
}
```

### 5.2 Endpoints

Ver `contracts/227-historial-recomendaciones.md`.

## 6. Fases de implementación

1. **Fase 1 — Seed y permisos**: parámetros `analisis.recomendaciones.*`, módulo `analisis_recomendaciones`, entrada de nav.
2. **Fase 2 — Servicio DAL**: where tipado, lista, métricas (groupBy + `$queryRaw` promedio), prepararExport + pseudonimización. Tests del servicio primero (TDD donde aplique).
3. **Fase 3 — Endpoints**: lista, métricas, export, con Zod compartido y códigos canónicos. Tests de ruta.
4. **Fase 4 — Vista**: página + componentes cliente, KPIs con semáforo, export button. Tests de componente.
5. **Fase 5 — Validación**: quickstart manual + gate local del mega-lote (`tsc`, `lint`, `test:unit` de la spec, `build`).

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| SPEC-221 aún no entrega los modelos en la rama | Dependencia declarada bloqueante; esta spec se implementa después en la cadencia del lote. |
| `$queryRaw` con filtros dinámicos abre inyección | Solo parámetros posicionales de Prisma (`Prisma.sql`), columnas fijas; ningún string de usuario interpolado. |
| Título de sugerencia filtra PII en la tabla | La tabla muestra `titulo` (render de plantilla controlada por el admin que escribió la regla) pero el CSV NO lo exporta; si ZEUS lo considera riesgoso, la tabla puede mostrar `regla.nombre` + metadatos en su lugar (decisión documentada en spec §FR-003/FR-007). |
| Volumen grande en métricas sin índice de rango | Índice `[estado, prioridad, generadaEn]` de SPEC-221 cubre los filtros principales; el rango usa `generadaEn`. |
| Sal de export ausente en un entorno | `prepararExport` falla con `500` explícito si `ANALISIS_EXPORT_SALT` no está definida (fail-closed, nunca exporta id crudo). |
