# Modelo de datos: SPEC-200 — INFRA · Timezone Bogotá (002-PI-097)

## Resumen

Migración aditiva que convierte todos los campos `DateTime` que representan **momentos** a `@db.Timestamptz(6)`. No se crean ni eliminan modelos. No se tocan campos `@db.Date` (representan día calendario sin hora).

## Campos afectados

A continuación los modelos y campos que pasan a `@db.Timestamptz(6)`. La lista se generó inspeccionando `prisma/schema.prisma` actual; cualquier campo `DateTime` sin `@db.Date` y sin `@db.Timestamptz` preexistente está incluido.

| Modelo | Campos que pasan a `@db.Timestamptz(6)` | Notas |
|---|---|---|
| `Usuario` | `bloqueadoHasta`, `ultimaSesion`, `inicioServicio`, `finServicio`, `creadoEn`, `actualizadoEn` | |
| `PerfilPadre` | `ultimaNotificacionCirculoEn`, `ultimaNotificacionColegioEn` | |
| `PerfilOperador` | `ultimoEmailNotificacionEn`, `creadoEn`, `actualizadoEn` | |
| `Suscripcion` | `fechaInicio`, `fechaFin`, `creadoEn`, `actualizadoEn` | |
| `Invitacion` | `expiraEn`, `creadoEn` | |
| `RefreshToken` | `expiraEn`, `creadoEn`, `actualizadoEn` | |
| `Tenant` / `Colegio` | `creadoEn`, `actualizadoEn` | |
| `Curso` | `creadoEn` | |
| `Alumno` | `creadoEn` | |
| `AlumnoCurso` | `creadoEn` | |
| `PeriodoAcademico` | `iniciaEn`, `terminaEn`, `creadoEn` | |
| `CicloFacturacion` | `periodoInicio`, `periodoFin`, `creadoEn` | |
| `Plan` | `inicioServicio`, `finServicio`, `creadoEn`, `actualizadoEn` | |
| `CategoriaConducta` | `completadoEn`, `creadoEn`, `actualizadoEn` | |
| `NotificacionPlataforma` | `leidaEn`, `archivadaEn`, `creadoEn`, `actualizadoEn` | |
| `AuditLog` | `createdAt`, `updatedAt` | |
| `ParametroSistema` | `createdAt`, `updatedAt` | |
| `RateLimit` | `creadoEn`, `actualizadoEn` | |
| `PreferenciaAlertaColegio` | `creadoEn`, `actualizadoEn` | |
| `AlertaColegio` | `creadoEn`, `actualizadoEn` | |
| `RegistroAvisoColegio` | `creadoEn`, `actualizadoEn` | `dia` permanece `@db.Date` |
| `EstudianteObservacion` | `creadoEn`, `actualizadoEn` | |
| `Reporte` | `fechaIncidente`, `eliminadoEn`, `anonimizacionValidadaEn`, `creadoEn`, `actualizadoEn` | |
| `ClasificacionIA` | `creadoEn`, `resueltoEn` | |
| `IdentificadorReportado` | `creadoEn` | |
| `ApelacionIdentificador` | `creadoEn` | |
| `VisibilidadPublica` | `ocultoPorComiteEn`, `ultimoReporteEn`, `creadoEn`, `actualizadoEn` | |
| `ApelacionDocumento` | `creadoEn` | |
| `WebhookEvent` | `creadoEn` | |
| `SesionActiva` | `creadoEn`, `actualizadoEn` | |
| `EmailLog` | `ultimoEmailEn`, `creadoEn`, `actualizadoEn` | |
| `EmbedCorregido` | `creadoEn` | |
| `RubricaPreguntaEdicion` | `creadoEn` | |
| `ModeloIAPreferencia` | `creadoEn` | |
| `HealthProbe` | `inicio`, `fin`, `ultimoEmailEn`, `creadoEn`, `actualizadoEn` | |
| `SimulacionCaso` | `fechaInicio`, `fechaFin`, `createdAt`, `updatedAt` | |
| `SimulacionRun` | `fechaInicio`, `fechaFin`, `createdAt`, `updatedAt` | |
| `CasoAsignado` | `asignadoEn`, `plazoRespuestaEn`, `resueltoEn`, `creadoEn`, `actualizadoEn` | |
| `CasoMensaje` | `eliminadoEn`, `creadoEn` | |
| `ApelacionMensaje` | `accedidoEn` | |
| `ActividadUsuario` | `creadoEn`, `actualizadoEn` | |
| `UsuarioBloqueado` | `bloqueadoEn` | |
| `ConsultaPublicaCache` | `expiraEn`, `creadoEn`, `actualizadoEn` | |
| `ExportJob` | `creadoEn`, `actualizadoEn` | |
| `Consentimiento` | `creadoEn` | |
| `MetricaDiaria` | `creadoEn` | `semanaInicio` se trata aparte |

## Unificación de precisiones

- `WebhookEvent` actualmente usa `@db.Timestamptz(3)`; se unifica a `@db.Timestamptz(6)`.
- `MetricaDiaria.semanaInicio` es `DateTime` sin `@db.Timestamptz` actualmente; pasa a `@db.Timestamptz(6)` porque representa un momento (lunes 00:00 Bogotá).

## Campos que NO cambian

| Modelo | Campo | Razón |
|---|---|---|
| `RegistroAvisoColegio` | `dia` | Representa un día calendario (`@db.Date`) |

## Migración

- Nombre sugerido: `add_timestamptz_bogota`
- SQL esperado (aditivo): `ALTER TABLE ... ALTER COLUMN ... TYPE TIMESTAMPTZ(6)` para cada campo listado.
- Precaución: ejecutar la migración con sesión en `Etc/UTC` para que la conversión de `timestamp without time zone` a `timestamp with time zone` no desplace los valores existentes.
