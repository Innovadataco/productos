# Plan de implementación: SPEC-189 — Vista de operador con métricas (002-PI-084)

## Resumen

Añadir una ficha de operador con métricas de productividad y listados de casos. Todo se construye sobre tablas existentes (`Usuario`, `Reporte`, `AuditLog`, `ClasificacionIA`); no hay migraciones. La lógica de agregación vive en un nuevo servicio del DAL y los endpoints reutilizan los repositorios existentes.

## Cambios de código

### 1. DTOs y tipos

En `src/lib/dal/types/operador.ts` (archivo existente) añadir:

```ts
export interface MetricasOperadorDto {
    casosAbiertos: Array<{
        id: string;
        numeroSeguimiento: string | null;
        identificador: string;
        plataformaClave: string;
        plataformaNombre: string;
        categoria: string | null;
        estado: string;
        asignadoEn: Date;
        tiempoDesdeAsignacionMs: number;
    }>;
    casosResueltos24h: number;
    casosResueltos7d: number;
    casosResueltos30d: number;
    tiempoMedioResolucionMs: number | null;
    casosPorCategoria: Array<{ categoria: string; total: number }>;
    tasaEscalamientoComite: number | null;
}

export interface CasoOperadorListItemDto {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    plataformaClave: string;
    plataformaNombre: string;
    estado: string;
    categoria: string | null;
    asignadoEn: Date;
}
```

### 2. Servicio de métricas

Crear `src/lib/dal/services/operador-metricas.ts`:

- `obtenerMetricas(operadorId: string, ahora = new Date()): Promise<MetricasOperadorDto>`
  - Valida que el usuario exista, sea `OPERADOR` y esté activo.
  - Casos abiertos: `ReporteRepository.findBandejaRevision` con `whereReporteEnEstado("REVISION_MANUAL", { operadorId })`.
  - Resueltos por ventana: `AuditLogRepository.countAcciones(ACCIONES_CIERRE, rango)` filtrando `usuarioId = operadorId`.
  - Escalados: `AuditLogRepository.countAcciones(["CASO_ESCALADO"], rango30d)` filtrando `usuarioId = operadorId`.
  - Tiempo medio: `AuditLogRepository.findAsignaciones` + `AuditLogRepository.findCierres` en 30 días; cruzar por `recursoId`, calcular diferencia y promediar.
  - Categorías: query a `Reporte` + `ClasificacionIA` de los reportes cerrados por el operador en 30 días.
- `listarCasos(operadorId, filtros, paginacion): Promise<[CasoOperadorListItemDto[], number]>`
  - Where base: `operadorId` + `eliminado: false`.
  - Filtro opcional por `estado`.
  - Select mínimo: id, numeroSeguimiento, identificador, estado, plataforma, clasificación.categoria, creadoEn.

> **Nota de arquitectura**: se consultan repositorios, nunca `prisma` directo. Si `OperadorService` crece, se puede mover el método a `OperadorMetricasService`; de lo contrario se añaden métodos a `OperadorService`.

### 3. Repositorios (solo lectura, sin cambios de interfaz)

- `ReporteRepository`: reutilizar `findBandejaRevision`, `countWhere`, `findPaginadosConTotal`.
- `AuditLogRepository`: reutilizar `countAcciones`, `findCierres`, `findAsignaciones`.
- `UsuarioRepository`: reutilizar `findOperadorById`.

Posible extensión menor en `ReporteRepository` para la query de categorías si no encaja en los selects existentes.

### 4. Endpoints

Crear `src/app/api/admin/operadores/[id]/metricas/route.ts`:

```ts
const paramsSchema = z.object({ id: z.string().cuid2() });
```

- `verifyAuth("ADMIN")` + `assertModulo(user, "operadores")`.
- Rate-limit `admin_read`.
- Devuelve `MetricasOperadorDto`.

Crear `src/app/api/admin/operadores/[id]/casos/route.ts`:

```ts
const querySchema = z.object({
    estado: z.nativeEnum(EstadoReporte).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
```

- Mismo auth/rate-limit.
- Devuelve `{ items, pagination }`.

### 5. Frontend

#### 5.1 Página de detalle

Crear `src/app/dashboard/admin/operadores/[id]/page.tsx`:

- Server Component.
- Verifica que el usuario tenga rol `ADMIN` y módulo `operadores`.
- Si el operador no existe o no es `OPERADOR`, muestra `notFound()` o mensaje de error.
- Renderiza:
  - **Cabecera**: nombre, email, cupo máximo, casos abiertos, botón "Volver a asignar" (`/dashboard/admin/operadores/asignar`).
  - **Tarjetas**: tiempo medio, resueltos 7d, tasa escalamiento, categoría top.
  - **Casos abiertos**: tabla con RPT, categoría, estado, tiempo desde asignación, link a detalle.
  - **Historial resueltos**: tabla paginada con fetch del endpoint `casos?estado=CORREGIDO` (o sin filtro, según decisión).
  - **Distribución por categoría**: lista ordenada desc por total.

Crear componente cliente para la paginación del historial (mismo patrón que bandejas de SPEC-181).

#### 5.2 Enlace en asignar

Editar `src/app/dashboard/admin/operadores/asignar/page.tsx`:

- Añadir columna o botón "Ver detalle" en cada fila.
- Mantener botón "Reasignar caso" existente.

### 6. Tests

- `src/app/api/admin/operadores/[id]/metricas/route.test.ts`: fixtures con asignaciones, cierres y escalados; verifica conteos y tiempos.
- `src/app/api/admin/operadores/[id]/casos/route.test.ts`: paginación y filtro por estado.
- `src/lib/dal/services/operador-metricas.test.ts` (o tests del servicio): cálculo de tiempo medio con casos edge.
- Componente: `src/app/dashboard/admin/operadores/[id]/page.test.tsx` con datos mock, verifica renderizado de tarjetas y tablas.

## Tareas

Ver [tasks.md](./tasks.md).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Query de métricas lenta con muchos registros | Filtros por `creadoEn >= 30 días` e índices existentes (`AuditLog.creadoEn`, `AuditLog.accion`). Si es necesario, añadir índice compuesto aditivo en migración separada (no en esta spec). |
| Cálculo de tiempo medio distorsionado por reasignaciones | Usar primera asignación del operador actual, documentado en spec. |
| Exposición accidental de texto de reporte | Select mínimo en el endpoint; nunca incluir `texto` ni `textoOriginal`. |
| Divergencia con `estadisticas.ts` | Reutilizar la constante `ACCIONES_CIERRE` existente; no inventar una nueva lista. |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde (nuevas rutas bajo `/admin/**` con permisos correctos).
- Sin cambios en `src/lib/ai/**`.
- Cero migraciones.
