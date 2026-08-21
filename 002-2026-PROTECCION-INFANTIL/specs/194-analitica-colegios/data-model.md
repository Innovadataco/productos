# Data Model: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT

## Principio rector

**No se crean nuevos modelos ni campos en `Colegio` o `Usuario`.** Toda la analítica se construye con agregaciones SQL sobre el modelo existente. Solo se proponen índices aditivos y nuevos parámetros en `ParametroSistema`.

## Entidades de lectura (sin cambios estructurales)

### `Usuario`
Usado para el sub-tab "Padres" y futuros sub-tabs de usuarios.
- Filtros: `rol`, `estado`, `creadoEn`, `ultimaSesion`, `tenantId`, `colegioId`.
- No se expone `passwordHash`, `intentosFallidos`, `bloqueadoHasta`.

### `Colegio`
Entidad central del resumen y la ficha.
- Lecturas: `id`, `nombre`, `paisId`, `departamentoId`, `ciudadId`, `direccion`, `representanteLegalNombre`, `representanteLegalEmail`, `estado`, `creadoEn`, `tenantId`.
- Relaciones usadas: `cursos`, `estudiantes`, `profesores`, `alertas`, `solicitudesComite`, `integrantesComite`, `tenant.reportes`.

### `Reporte`
Agregaciones por `tenantId` (que es único por colegio) y por `usuarioId`.
- Filtros: `tenantId`, `usuarioId`, `estado`, `creadoEn`, `eliminado = false`.
- No se expone `texto`, `textoOriginal`.

### `AlertaColegio`
Agregaciones por `colegioId`.
- Filtros: `colegioId`, `estado`, `tipoSujeto`, `creadoEn`.

### `SolicitudComite`
Agregaciones por `colegioId`.
- Filtros: `colegioId`, `estado`, `creadoEn`, `resueltoEn`.

### `IntegranteComite`
Conteo de integrantes activos por `colegioId`.
- Filtros: `colegioId`, `estado`.

### `Curso`, `Estudiante`, `Profesor`
Conteos de tamaño por `colegioId`.

## Índices aditivos propuestos

La migración aditiva debe crear los siguientes índices para soportar las agregaciones sin full scans:

```sql
-- Reportes por colegio y fecha (serie temporal, conteos)
CREATE INDEX IF NOT EXISTS "idx_reportes_tenant_creado_eliminado"
  ON "Reporte" ("tenantId", "creadoEn", "eliminado");

-- Reportes por colegio y estado (% procesados)
CREATE INDEX IF NOT EXISTS "idx_reportes_tenant_estado_eliminado"
  ON "Reporte" ("tenantId", "estado", "eliminado");

-- Reportes por usuario para conteos de padres
CREATE INDEX IF NOT EXISTS "idx_reportes_usuario_eliminado"
  ON "Reporte" ("usuarioId", "eliminado");

-- Alertas por colegio y estado
CREATE INDEX IF NOT EXISTS "idx_alertas_colegio_estado"
  ON "AlertaColegio" ("colegioId", "estado");

-- Solicitudes de comité por colegio y estado
CREATE INDEX IF NOT EXISTS "idx_solicitudes_comite_colegio_estado"
  ON "SolicitudComite" ("colegioId", "estado");

-- Integrantes por colegio y estado
CREATE INDEX IF NOT EXISTS "idx_integrantes_comite_colegio_estado"
  ON "IntegranteComite" ("colegioId", "estado");
```

## Parámetros nuevos en `ParametroSistema`

Sembrar en `prisma/seed.ts` (sección `monitoreoNuevos` como excepción documentada):

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `analytics.colegios.cache_ttl_min` | INTEGER | 5 | TTL de caché de analytics en minutos |
| `analytics.colegios.inactividad_alerta_dias` | INTEGER | 45 | Días sin reportes para generar hallazgo negativo |
| `analytics.colegios.spam_alerta_pct` | FLOAT | 0.5 | % de reportes SPAM para generar hallazgo negativo |
| `analytics.colegios.resolucion_comite_ok_pct` | FLOAT | 0.8 | % de resolución del comité para generar hallazgo positivo |
| `analytics.colegios.periodo_default_dias` | INTEGER | 30 | Ventana temporal por defecto de las series |

## Diseño de caché

- Claves:
  - Resumen: `analytics:colegios:resumen:<hash(queryParams)>`
  - Detalle: `analytics:colegios:detalle:<colegioId>`
- TTL: `analytics.colegios.cache_ttl_min * 60 * 1000` ms.
- Almacenamiento: `Map<string, { value, expiraEn }>` en memoria del proceso.
- No se invalida manualmente al cambiar parámetros; se espera al TTL.

## DTOs principales

### `UsuarioListItem` (sub-tab Padres)
```ts
{
  id: string;
  email: string;
  nombre: string | null;
  estado: "activo" | "inactivo" | "bloqueado";
  creadoEn: string;
  ultimaSesion: string | null;
  reportesEnviados: number;
  colegiosAsociados: { id: string; nombre: string }[];
}
```

### `ColegioResumenItem`
```ts
{
  id: string;
  nombre: string;
  ciudad: string;
  departamento: string | null;
  fechaRegistro: string;
  estado: "activo" | "inactivo";
  alumnos: number;
  profesores: number;
  reportesUltimos30Dias: number;
  reportesTotal: number;
  alertasEscaladas: number;
  casosProcesadosPct: number;
  semaforo: "verde" | "amarillo" | "rojo";
}
```

### `ColegioDetalleResponse`
```ts
{
  id: string;
  infoBasica: { ... };
  metricasTamaño: { alumnos, profesores, cursos, materias };
  actividadReportes: { serie, porClasificacion, topIdentificadores };
  comite: { integrantesActivos, casosEscalados, casosResueltos, tiempoPromedioResolucionHoras, ultimosCasos };
  alertas: { total, resueltas, ultimasAlertas };
  hallazgos: { positivos: string[], negativos: string[], semaforo };
  comparacionMedia: { metricas: { nombre, valorColegio, mediana }[] };
}
```

## Notas de privacidad

- Los DTOs nunca incluyen `Reporte.texto`, `Reporte.textoOriginal`, `Reporte.usuarioId` del denunciante ni datos de menores.
- El "top identificadores" incluye el string del identificador (teléfono/nick) porque es información agregada por colegio, comparable a la consulta pública; no incluye quién lo reportó.
