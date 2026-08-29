# Research: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT

## Estado base relevante

- `feature/001-scaffolding @d976623b` incluye SPEC-196 (parche UI anti-abuso) y las specs anteriores hasta 193.
- El módulo Colegio A-G está en prod desde `689d46ac`.
- La vista `/dashboard/admin/padres` (SPEC-117, I-37 parcial) ya existe con listado, búsqueda, paginación, acciones de vigencia y restablecimiento de contraseña.
- El endpoint `/api/admin/padres` ya devuelve usuarios `rol=PARENT` con conteo agregado de reportes.
- `/dashboard/admin/colegios` existe como gestión de colegios (CRUD de instituciones), no como analítica.
- `/dashboard/admin/estadisticas/operacion` tiene sub-tabs Operación/Clasificación/Logs/Motor vía `EstadisticasSubNav`.

## Componentes y rutas existentes para reutilizar

| Componente / Ruta | Ubicación | Uso en SPEC-194 |
|---|---|---|
| `EstadisticasSubNav` | `src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.tsx` | Añadir tab "Colegios" con `?tab=colegios` |
| `OperacionTableroClient` | `src/app/dashboard/admin/estadisticas/operacion/OperacionTableroClient.tsx` | Contenedor del tablero operativo; se extiende para renderizar tab Colegios |
| `PadresPageClient` | `src/app/dashboard/admin/padres/PadresPageClient.tsx` | Referencia de UI para el sub-tab Padres |
| `ColegiosPageClient` | `src/app/dashboard/admin/colegios/ColegiosPageClient.tsx` | Referencia de estructura de tabla y datos básicos de colegio |
| `Tabla`, `GlassCard`, `Badge`, `Input`, `Button`, `EmptyState`, `ErrorState`, `Cargando` | `src/components/ui/**` | Componentes base de UI |
| `verificarAccesoPagina` | `src/lib/permisos-modulos.ts` | Protección de rutas por módulo |
| `assertModulo` | `src/lib/permisos-modulos.ts` | Protección de API por módulo |
| `UsuarioRepository` | `src/lib/dal/repositories/usuario.ts` | Lectura de usuarios por rol |
| `ReporteRepository` | `src/lib/dal/repositories/reporte.ts` | Conteos agregados de reportes |
| `ColegioRepository` | `src/lib/dal/repositories/colegio.ts` | Lectura de colegios |
| `getParametroSistemaValor` | `src/lib/parametros.ts` | Lectura de parámetros de configuración |

## Permisos y navegación

- `src/lib/nav-items.ts`: actualmente tiene ítem "Padres" → `/dashboard/admin/padres` y "Colegios" → `/dashboard/admin/colegios`.
- Se propone añadir ítem "Usuarios" → `/dashboard/admin/usuarios` (módulo nuevo `usuarios_admin`) y mantener "Colegios" de gestión.
- Se propone módulo `analytics_colegios` para el sub-tab de analytics.
- `src/lib/permisos-modulos.ts`: debe registrar los nuevos módulos y su mapping a ADMIN.

## Modelo de datos relevante

- `Usuario`: `rol`, `estado`, `creadoEn`, `ultimaSesion`, `tenantId`, `colegioId`.
- `Colegio`: relaciones con `cursos`, `estudiantes`, `profesores`, `alertas`, `solicitudesComite`, `integrantesComite`.
- `Reporte`: `tenantId`, `usuarioId`, `estado`, `creadoEn`, `eliminado`.
- `AlertaColegio`: `colegioId`, `estado`, `tipoSujeto`, `creadoEn`.
- `SolicitudComite`: `colegioId`, `estado`, `creadoEn`, `resueltoEn`.
- `IntegranteComite`: `colegioId`, `estado`.
- `Tenant`: `id`, `nombre`, `estado`; `Colegio.tenantId` es unique, por lo que cada colegio es un tenant.

## Estrategia de agregaciones SQL

Para evitar N+1 y mantener tiempos < 3 s:

1. **Resumen de colegios**: una query con CTEs o subconsultas que calculen conteos por colegio en una sola pasada.
2. **Detalle por colegio**: query específica por `colegioId` con CTEs para cada sección; se pueden dividir en 2-3 queries paralelas si es necesario.
3. **Serie temporal**: GROUP BY `DATE_TRUNC('day', creadoEn)` para 30/90/365 días.
4. **Top identificadores**: GROUP BY `identificador` filtrado por `tenantId = colegio.tenantId`, ordenado por conteo, limit 5.
5. **Comité**: JOIN con `IntegranteComite` y `SolicitudComite`.
6. **Alertas**: agregaciones directas sobre `AlertaColegio`.

## Caché

- No se detecta Redis ni infraestructura de caché centralizada en el proyecto.
- Estrategia: caché en memoria por instancia de Next.js (proceso) con TTL de 5 min por defecto.
- Clave: `analytics:colegios:resumen:<hash_filtros>` y `analytics:colegios:detalle:<colegioId>`.
- Limitación: en desarrollo con `next dev` y hot reload, la caché se pierde; en producción con un solo contenedor `app`, es efectiva.

## Privacidad

- No exponer `Reporte.texto`, `Reporte.textoOriginal`, `Reporte.usuarioId` ni datos del denunciante.
- Los identificadores reportados (teléfono/nick) sí se muestran en el "top 5 identificadores" porque son datos agregados públicos por diseño del producto (consulta pública), pero se filtran por colegio.
- Los reportes del historial de un padre muestran solo: número de seguimiento, fecha, estado, categoría — sin texto.

## Riesgos identificados

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Queries pesadas en BD con muchos colegios/reportes | Alto | Caché + índices + SQL agregado en una pasada |
| Schema no tiene índices óptimos para agregaciones | Medio | Añadir índices aditivos en migración |
| Confusión entre `/dashboard/admin/colegios` (gestión) y `/dashboard/admin/estadisticas/operacion?tab=colegios` (analytics) | Medio | Labels claros: "Gestión de colegios" vs "Analítica de colegios" |
| Exposición accidental de PII | Alto | Revisión de selects en repositorios; tests de contrato |

## Decisiones preliminares

- Crear `/api/admin/usuarios` genérico en vez de reusar `/api/admin/padres`, para facilitar futuros sub-tabs de otros roles.
- Crear módulo `analytics_colegios` separado de `colegios_gestion`.
- Implementar caché en memoria simple (sin Redis) documentando la limitación.
- US5 (CSV) se evalúa al final del implementation; si supera 1 día, se deja como deuda.
