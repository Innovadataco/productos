# Data Model — SPEC-311 · Ficha colegio admin Fase 2

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

## Alcance del documento

Este fix NO añade tablas ni migraciones. Documenta:

1. Modelos Prisma existentes consultados.
2. Ampliación aditiva del tipo `ColegioDetalleResponse` en `analytics-colegio-types.ts`.
3. Reglas de derivación de cada uno de los 4 bloques nuevos.

Cero cambios en `prisma/schema.prisma`.

## 1. Modelos Prisma consultados

### `Usuario` (schema:1054 aprox)

Campos usados en `analytics-colegio.ts` Fase 2:
- `id`, `nombre`, `email` — para `operadoresAsignados` (nombre + email visibles).
- `rol: RolUsuario` — para `distribucionRol`, clasificación de autores de reportes.

### `AlertaColegio` (schema:1370)

- `colegioId` (FK) — filtro por colegio.
- `asignadoAId` (FK opcional a Usuario) — fuente de `operadoresAsignados`.

### `Reporte` (schema:1609)

- `usuarioId` (opcional) — para clasificar autor en `distribucionRol`.
- `esAnonimo`, `origenRol` (SPEC-295) — para clasificar autores anónimos y padres autenticados.
- `creadoEn` — para `lineaTiempo.primerReporte` (MIN) y `serieMensual` (agrupación por año-mes).

### `Colegio` (schema:1055)

- `fechaRegistro` (derivado de `creadoEn` según convención existente) — para `lineaTiempo.fechaRegistro`.

## 2. Ampliación aditiva del tipo `ColegioDetalleResponse`

```ts
// analytics-colegio-types.ts (ampliación Fase 2)
export interface ColegioDetalleResponse {
  // ... campos Fase 1 (SC-006 se conservan sin cambios):
  //   infoBasica, metricasTamaño, actividadReportes, comite, alertas,
  //   hallazgos, comparacionMedia, actividadReportesCruzada, umbralesSemaforo

  // === Fase 2 · aditivos ===
  distribucionRol: {
    padre: number;
    estudiante: number;   // siempre 0 en el estado actual (deuda documentada · D5 research)
    profesor: number;
    anonimo: number;
  };
  operadoresAsignados: Array<{
    id: string;
    nombre: string;
    email: string;
  }>;
  lineaTiempo: {
    fechaRegistro: string;                                          // ISO 8601
    primerReporte: string | null;                                   // ISO 8601 · null si colegio sin reportes
    picoActividad: { anioMes: string; total: number } | null;       // "YYYY-MM" · null si colegio sin reportes
    hoy: string;                                                    // ISO 8601 · momento del request
  };
  serieMensual: Array<{
    anioMes: string;   // "YYYY-MM"
    total: number;
  }>;
}
```

## 3. Reglas de derivación

### 3.1 `distribucionRol`

Cuenta los reportes del colegio en el rango vigente (`analytics.colegios.periodo_default_dias`) clasificados por rol reportante.

**Algoritmo**:
1. Obtener `reportes` del rango vigente via `actividadDelColegio(colegioId, rangoVigente)`.
2. Query separada `prisma.reporte.findMany({ where: { id: { in: reportes.map(r => r.id) } }, select: { id, esAnonimo, origenRol, usuario: { select: { rol } } } })`.
3. Clasificar cada reporte:
   - Si `origenRol === "PARENT"` → `padre`.
   - Sino si `esAnonimo === true` o `usuarioId === null` → `anonimo`.
   - Sino si `usuario.rol === "PARENT"` → `padre`.
   - Sino si `usuario.rol IN ("SCHOOL_ADMIN", "OPERADOR", "COMITE_VALIDACION", "COMITE_CONVIVENCIA")` → `profesor`.
   - Sino → `anonimo` (default defensivo).
4. `estudiante` = 0 (sin `RolUsuario.STUDENT` en el sistema actual · categoría reservada para futuro).
5. Sumas: `padre + estudiante + profesor + anonimo == actividadReportesCruzada.total` (invariante testeable).

### 3.2 `operadoresAsignados`

DISTINCT usuarios que aparecen como asignados a alguna alerta del colegio.

**Algoritmo**:
1. Query: `prisma.usuario.findMany({ where: { alertasAsignadas: { some: { colegioId } } }, select: { id, nombre, email }, distinct: ["id"] })`.
2. Orden: por `nombre` ASC (estable).
3. Vacío si ninguna alerta del colegio tiene `asignadoAId`.

**Nota**: la relación `alertasAsignadas` en `Usuario` existe si Prisma la genera desde `AlertaColegio.asignadoA @relation(fields: [asignadoAId], references: [id])`. Verificar en implement con `Usuario.alertasAsignadas` autocomplete o `prisma studio`. Si no existe la relación reversa, usar subquery: `prisma.usuario.findMany({ where: { id: { in: (await prisma.alertaColegio.findMany({ where: { colegioId, asignadoAId: { not: null } }, distinct: ["asignadoAId"], select: { asignadoAId: true } })).map(a => a.asignadoAId!) } }, select: { id, nombre, email } })`.

### 3.3 `lineaTiempo`

Marcadores clave para el Bloque C.

**Algoritmo**:
1. `fechaRegistro`: `colegio.creadoEn.toISOString()` (o campo equivalente del `Colegio`).
2. Query all-time: `actividadDelColegio(colegioId, { desde: colegio.creadoEn, hasta: now })`. Devuelve `reportes` all-time deduplicados.
3. `primerReporte`: `MIN(reportes.creadoEn)` o `null` si `reportes.length === 0`.
4. `picoActividad`: agrupar reportes por `anioMes = creadoEn.toISOString().slice(0, 7)`, contar por bucket. Devolver el bucket con máximo. En caso de empate, tomar el `anioMes` más reciente (max lexicográfico). `null` si sin reportes.
5. `hoy`: `new Date().toISOString()`.

### 3.4 `serieMensual`

Serie temporal mensual all-time (o últimos 12 meses si sin actividad histórica).

**Algoritmo**:
1. Con los `reportes` all-time de 3.3 paso 2, agrupar por `anioMes`.
2. Rellenar meses vacíos con `total: 0` entre `primerReporte` (o `fechaRegistro`) y `hoy` para continuidad visual.
3. Si `reportes.length === 0`, devolver `[]`.
4. Orden: ASC por `anioMes`.

## 4. Invariantes testeables

- `distribucionRol.padre + estudiante + profesor + anonimo === actividadReportesCruzada.total` (SC-011 aux).
- `operadoresAsignados.length === new Set(operadoresAsignados.map(o => o.id)).size` (DISTINCT).
- `lineaTiempo.primerReporte === null` sii el colegio no tiene reportes en ninguna de las 3 rutas de pertenencia.
- `lineaTiempo.picoActividad.total >= 1` cuando no es `null`.
- `serieMensual.reduce((s, m) => s + m.total, 0)` = total all-time de reportes del colegio.
- `serieMensual` ordenada ASC por `anioMes`, sin duplicados.

## 5. Sin migración Prisma

Cero cambios en `schema.prisma`. Todos los datos vienen de modelos existentes.
