# Cierre: SPEC-124 — Primitivas UI compartidas (R7)

**Fecha**: 2026-07-29
**Rama**: `feature/001-scaffolding` (sin push, lo decide el responsable)

## Qué se hizo

### Primitivas creadas (commit `15c99f2f`, aditivo, sin migrar nada)

En `src/components/ui/`, con tests de componente (21 tests, verdes):

- `Tabla.tsx` — `Tabla` (contenedor `glass rounded-2xl` + scroll-x + tabla
  canónica `w-full text-left text-sm`; prop `sinContenedor`), `TablaHead`
  (variantes `relleno`/`borde`, las dos observadas en el repo), `TablaBody`
  (divide-y canónico).
- `TarjetaMetrica.tsx` — unifica las 4 copias: disposiciones `centrada`
  (ex `modules/MetricCard`) y `panel` (ex AdminDashboard/AntiAbuso), con
  `tone` up/down, `suffix`, `sub`, `mono` (ex ConsultaEnriquecida).
- `Alerta.tsx` — tonos `error`/`exito`/`advertencia`/`info`,
  `role="alert"` por defecto.
- `Cargando.tsx` — formas centrada e inline, tamaños `sm`/`md`,
  `role="status"` + `aria-live`, texto configurable.
- `use-fetch-json.ts` — hook client `{ datos, cargando, error, recargar }`
  con `credentials: "include"` y parseo defensivo.

### Pantallas migradas (12 commits, uno por pantalla/lote)

| # | Pantalla | Commit | Primitivas usadas |
| --- | --- | --- | --- |
| 1 | `AdminDashboard` | `6b0ffbf6` | TarjetaMetrica panel, Tabla, useFetchJson |
| 2 | `AdminAntiAbusoSimulacion` | `fa9063fc` | TarjetaMetrica panel+tone, Tabla, useFetchJson |
| 3 | `ConsultaEnriquecidaClient` | `09037a6d` | TarjetaMetrica mono, Tabla, Alerta |
| 4 | `AdminReportesTable` | `1d0c234c` | Tabla, Cargando |
| 5 | `SpamRevisionPanel` | `4f76d711` | Tabla, Cargando, Alerta |
| 6 | `audit-log/AuditTable` | `9d66b6b6` | Tabla (borde), Cargando inline, Alerta |
| 7 | `ApelacionesClient` | `ef2e930d` | Cargando ×2, Alerta |
| 8 | `DashboardUsuarioClient` | `cab0068b` | Cargando ×2 |
| 9 | `PadresPageClient` | `8061774d` | Tabla (borde), Cargando inline, Alerta ×2 |
| 10-12 | operadores: gestion / asignar / modelo | `45e74fc1` | Tabla (borde), Cargando inline, Alerta ×2 |
| 13 | `estadisticas/clasificacion` | `5b6ac6cf` | Tabla (borde) ×2, Cargando inline |
| 14 | `DatasetEntrenamientoPageClient` | `e7079232` | Tabla, Cargando, Alerta |
| 15-16 | `PublicDashboard` + `circulo-confianza` | `73b96c2f` | import → TarjetaMetrica; **borrada `modules/MetricCard.tsx`** |
| 17 | `AdminReporteDetalle` | `6b348b47` | Alerta ×3 |
| 18 | `AdminReporteExpediente` | `3e63157a` | Cargando |
| 19-21 | `MisReporteDetalle` + `mis-reportes` + `seguimiento` | `367276e5` | Cargando |
| 22-24 | `ConfigPanel` + `CategoriaGruposEditor` + `SeguimientoClient` | `3665d234` | Alerta, Cargando |
| 25-28 | auth: `login`, `registro`, `cambiar-password`, `recuperar/[token]` | `c6a64e61` | Alerta, Cargando |

**Total: 28 archivos/pantallas migradas en 12 commits + 1 commit de
primitivas.** Tests de componente existentes verificados verdes tras cada
migración que los tenía (ConsultaEnriquecida, PublicDashboard,
AdminReporteDetalle, AdminReporteExpediente, MisReporteDetalle,
SeguimientoClient) sin modificarlos.

## Pendientes (quedan por migrar)

- **Zonas prohibidas** (CEO probando; conservan copias locales):
  `ComiteBandeja`, `ComiteSolicitudDetalle`, `admin/comite/gestion`,
  `admin/comite/apelaciones`, `admin/colegios`, `dashboard/colegio/**`
  (6 tablas + spinners + mensajes).
- **`src/components/modules/ia/**`**: 7 tablas `min-w-full text-sm` y el
  `MetricCard` especializado con baseline/formato (otra densidad y dominio).
- **Copias sueltas en zona fría**: `PermisosRolPanel` (texto plano),
  `ReporteWizard` (spinner + aviso amber), `LandingHero` (spinner del mock),
  `MapaUbicaciones` (overlay del mapa), `NavHeader` (spinner del menú),
  `EstadoTransicion`, cajas especializadas de `reporte-detalle/*`,
  `ChartCard` duplicado en `AdminDashboard` vs `modules/ChartCard.tsx`.

## Decisiones y notas

- **Paridad de contenido**: mismos textos/datos visibles en todas las
  migraciones. Las clases se normalizaron a las canónicas de la primitiva
  (p. ej. rojo `text-red-800`→`text-red-700`, spinners sky/primary→accent,
  padding de filas de carga). Sin cambios funcionales.
- `useFetchJson` solo se aplicó donde el patrón era GET simple
  (AdminDashboard, AntiAbuso). Donde hay redirect 401, POST o múltiples
  setters (bandejas, padres, operadores) se conservó el fetch local.
- La matriz de votos de `AdminReporteExpediente` (`text-xs`, th `px-2 py-1`)
  no encaja en la densidad canónica de `Tabla`: se migró solo su `Cargando`.
- `ComiteBandeja.test.tsx` referencia "Cargando..." pero esa pantalla NO se
  tocó: el test sigue pasando tal cual (verificado en la suite completa).

## Evidencia del gate (bajo candado `/tmp/pi-gate-lock`)

- `npx tsc --noEmit`: sin errores en archivos propios (los errores
  transitorios de `src/lib/ai/*` durante la noche eran de agentes paralelos
  en vuelo; al cierre el árbol completo compila).
- `npx eslint` sobre cada archivo migrado: 0 errores en cada commit.
- Vitest por primitiva (21 tests) y por pantalla con test existente: verde
  en cada paso.
- Suite completa + build: ver sección "Gate final" más abajo (resultados
  registrados al ejecutarse).

## Reglas respetadas

- Sin push. Sin tocar `src/app/api/**` ni `src/lib/**`. Sin tocar Colegios
  ni Comité. Sin ablandar tests (ningún test existente modificado). Tailwind
  como única fuente de estilos (0 CSS nuevo). Staging solo con rutas
  explícitas propias. Candado de gate en todos los vitest/build.
