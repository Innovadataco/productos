# CLASIFICACIÓN-PURGA — contrato de la purga total (SPEC-578)

Decisión de negocio del dueño del producto (2026-09-07), que revoca comportamiento
anterior (D-001 §5 «evidencia viva» queda **anulada por D-113**):

- **PRESERVAR SIEMPRE** (configuración del producto, aun en purga total):
  `ParametroSistema`, `Plan`, modelo IA y su entrenamiento (`DatasetEntrenamiento`,
  `EmbeddingDataset`, rúbricas/reglas del motor, `ReglaRecomendacion`, config del
  clasificador), plantillas (`NotificacionPlantilla`, `NotificacionRegla`),
  catálogos y seeds (`ModuloPermisible` y grants, `GuiaAccionCategoria`,
  `TipoDocumento`, `Plataforma`, geo completo), usuario `soporte@innovadataco.com`
  y `AuditLog` (append-only; las entradas de datos de prueba quedan como histórico).
- **BORRAR** (dato de prueba): todo lo demás — los 3 reportes «evidencia viva»
  (`RPT-1RR278`, `RPT-2JFULR`, `RPT-FA1C23`) **también se borran** (D-113).

Test de la regla: **¿es configuración/seed del producto o es dato generado por
usuarios de prueba?** Lo primero preserva; lo segundo borra.

## Tabla modelo → decisión (111 modelos de `prisma/schema.prisma`)

Quién lo borra hoy: `borrarColegio` (bc), `borrarPadre` (bp), `borrarReporte` (br),
`borrarSimulacion` (bs), pre-borrado global de `reset-piloto` (pg), cascade (c),
`ejecutarBorrado` por marca demo (dm), o **HUECO** (nadie en el flujo actual).
«purga-total» = `scripts/limpieza/purga-total.ts` (SPEC-578) cierra el hueco.

| Modelo | Decisión | Razón | Hoy | Hueco |
|---|---|---|---|---|
| Usuario | BORRAR (parcial) | Dato de prueba; se preserva solo `soporte@innovadataco.com` | bp (solo PARENT) | **SÍ** — ADMIN/OPERADOR/COMITE_*/VERIFICADOR/PROFESIONAL/SCHOOL_ADMIN huérfanos |
| PerfilOperador | BORRAR | Perfil de operadores de prueba | — | **SÍ** → purga-total |
| IntegranteComite | BORRAR | Integrantes de comités de prueba | bc (solo comité convivencia) | **SÍ** → purga-total |
| IdentificadorIntegranteComite | BORRAR | Identificadores de integrantes (dato) | — | **SÍ** → purga-total |
| CodigoVerificacion | BORRAR | Token de verificación (dato) | bp (solo del padre) | **SÍ** → purga-total |
| TokenRecuperacion | BORRAR | Token de recuperación (dato) | bp | **SÍ** → purga-total |
| TokenRegistro | BORRAR | Token de registro (dato) | — | **SÍ** → purga-total |
| ParametroSistema | **PRESERVAR** | Config del producto (seed) | — | no |
| AuditLog | **PRESERVAR** | Bitácora append-only; entradas de prueba = histórico | — | no |
| SesionLog | BORRAR | Log operativo | — | **SÍ** → purga-total |
| AuditConsentimiento | BORRAR | Constancia de usuarios de prueba (SPEC-508 niega borrado parcial; la purga TOTAL sí las borra, es dato de prueba) | bp (lo niega si >0) | **SÍ** → purga-total |
| Tenant | BORRAR | Tenant de prueba | bc | no |
| Plan | **PRESERVAR** | Config comercial (seed) | — | no |
| Subscription | BORRAR | SaaS legacy (dato) | — | **SÍ** → purga-total |
| BillingCycle | BORRAR | SaaS legacy (dato) | — | **SÍ** → purga-total |
| Suscripcion | BORRAR | Suscripciones de prueba | bp/bc (solo padre/colegio) | **SÍ** → purga-total |
| Pago | BORRAR | Pagos de prueba | — | **SÍ** → purga-total |
| BonoPromocional | BORRAR | Bonos/vigencias de prueba (dato, no seed) | — | **SÍ** → purga-total |
| BonoAplicado | BORRAR | Aplicación de bonos (dato) | — | **SÍ** → purga-total |
| CodigoReferidoUso | BORRAR | Usos de código de referido (dato) | — | **SÍ** → purga-total |
| TasaCambio | BORRAR | Histórico de tasas (dato); se repuebla vía API/admin. **Decisión:** no es seed ni catálogo | — | **SÍ** → purga-total |
| Colegio | BORRAR | Colegio/tenant de prueba | bc | no |
| OnboardingColegio | BORRAR | Estado de onboarding (dato) | bc | no |
| NotificacionInApp | BORRAR | Notificaciones de usuarios | bc | parcial → purga-total |
| Curso | BORRAR | Dato de colegio | bc | no |
| Profesor | BORRAR | Dato de colegio | bc | no |
| Materia | BORRAR | Dato de colegio | bc | no |
| CursoMateria | BORRAR | Dato de colegio | bc | no |
| Estudiante | BORRAR | Dato de colegio | bc | no |
| AcudienteEstudiante | BORRAR | Dato de colegio | bc/pg | no |
| IdentificadorAcudiente | BORRAR | Identificadores (dato) | bc/pg | no |
| IdentificadorProfesor | BORRAR | Identificadores (dato) | bc/pg | no |
| EstudianteObservacion | BORRAR | Observaciones (dato) | bc/pg | no |
| IdentificadorEstudiante | BORRAR | Identificadores (dato) | bc/pg | no |
| AlertaColegio | BORRAR | Alertas de prueba | bc/pg | no |
| PatronInstitucional | BORRAR | Agregado de reportes de prueba | bc | parcial → purga-total |
| PreferenciaAlertaColegio | BORRAR | Preferencias (dato) | bc | parcial → purga-total |
| RegistroAvisoColegio | BORRAR | Bitácora de avisos (dato) | bc | parcial → purga-total |
| SeguimientoCaso | BORRAR | Casos de prueba | bc/pg | parcial → purga-total |
| NotaSeguimiento | BORRAR | Notas de casos (dato) | bc/pg | parcial → purga-total |
| Plataforma | **PRESERVAR** | Catálogo (seed) | — | no |
| TipoDocumento | **PRESERVAR** | Catálogo (seed) | — | no |
| Pais | **PRESERVAR** | Geo (seed) | — | no |
| Departamento | **PRESERVAR** | Geo (seed) | — | no |
| Ciudad | **PRESERVAR** | Geo (seed) | — | no |
| Reporte | BORRAR | **Incluidos los 3 «evidencia viva» (D-113)** | br (salvo excluidos) | **SÍ** (los 3 excluidos) → purga-total |
| SolicitudComite | BORRAR | Solicitudes de prueba | br/pg | parcial → purga-total |
| TransicionReporte | BORRAR | Traza (cascade) | c/br | no |
| ReintentoReporte | BORRAR | Traza (cascade) | c/br | no |
| PasoProcesamiento | BORRAR | Traza pipeline (cascade) | c/br | no |
| FuenteReporte | BORRAR | **Reclasificado:** es dato por reporte (anti-abuso), no catálogo — su `reporteId` es @unique; el «config de fuentes» (peso_fuente) vive en `ParametroSistema`/rúbrica, que sí se preserva | dm | **SÍ** → purga-total |
| IdentificadorReportado | BORRAR | Agregado de reportes de prueba | br (solo si tuvo EventoMatch) | **SÍ** (huérfanos sin match) → purga-total |
| EventoMatch | BORRAR | Eventos de match (dato) | br | parcial → purga-total |
| Apelacion | BORRAR | Apelaciones de prueba | — | **SÍ** → purga-total |
| DocumentoApelacion | BORRAR | Documentos (cascade) | — | **SÍ** → purga-total |
| AccesoDocumentoApelacion | BORRAR | Trazas de acceso | — | **SÍ** → purga-total |
| ContactoConfianza | BORRAR | Círculo de confianza (dato) | bp (cascade) | parcial → purga-total |
| Hijo | BORRAR | Fichas de menores de prueba | bp (cascade) | parcial → purga-total |
| HijoPadre | BORRAR | Puente deprecated (cascade) | bp (cascade) | parcial → purga-total |
| IdentificadorHijo | BORRAR | Identificadores (cascade) | bp (cascade) | parcial → purga-total |
| IdentificadorHijoDesvinculado | BORRAR | Puente deprecated (cascade) | bp (cascade) | parcial → purga-total |
| IdentificadorContacto | BORRAR | Identificadores (cascade) | bp (cascade) | parcial → purga-total |
| AlertaSuscripcion | BORRAR | Alertas del padre (dato) | — | **SÍ** → purga-total |
| ClasificacionIA | BORRAR | Clasificación de reportes de prueba (cascade) | c/br | no |
| CorreccionAdmin | BORRAR | Correcciones de revisores de prueba | br | parcial → purga-total |
| DatasetEntrenamiento | **PRESERVAR** | Entrenamiento del modelo IA | — | no |
| EmbeddingDataset | **PRESERVAR** | Embeddings del dataset (cascade del preservado) | — | no |
| EmbeddingReporte | BORRAR | Cache semántico de reportes (cascade) | c/br | no |
| RateLimit | BORRAR | Filas de rate limit (dato operativo) | — | **SÍ** → purga-total |
| SimulacionRun | BORRAR | Simulaciones (dato) | bs | no |
| SimulacionReporte | BORRAR | Casos de simulación (dato) | bs (cascade) | parcial → purga-total |
| BlockList | BORRAR | IPs bloqueadas **alimentadas por data de prueba** (simulador de abusos). Decisión: BORRAR; en purga real se repuebla con bloqueos genuinos | — | **SÍ** → purga-total |
| SimulacionAbusoRun | BORRAR | Corridas del simulador (dato) | — | **SÍ** → purga-total |
| ModuloPermisible | **PRESERVAR** | Catálogo de módulos (seed) | — | no |
| PermisoModulo | **PRESERVAR** | Grants rol↔módulo (seed) | — | no |
| ClasificacionRubricaVoto | BORRAR | Votos por clasificación (dato; la rúbrica como config vive en `ParametroSistema`) | c | parcial → purga-total |
| CargaRosterSesion | BORRAR | Sesiones de carga masiva (dato) | bc | parcial → purga-total |
| DemoMarcado | BORRAR | Se vacía al caer lo marcado; la purga total la vacía entera | dm | **SÍ** (default) → purga-total |
| HealthProbe | BORRAR | Log operativo | — | **SÍ** → purga-total |
| IncidenteInfra | BORRAR | Log operativo | — | **SÍ** → purga-total |
| WorkerLog | BORRAR | Log operativo | — | **SÍ** → purga-total |
| DerivaMotorSnapshot | BORRAR | Métrica semanal derivada de reportes de prueba | — | **SÍ** → purga-total |
| Expediente | BORRAR | Expedientes de prueba | bp/bc | parcial → purga-total |
| EventoExpediente | BORRAR | Eventos (dato) | bp/bc | parcial → purga-total |
| InformePadre | BORRAR | Informes de prueba | bp/bc | parcial → purga-total |
| InformeConsolidado | BORRAR | Informes de prueba | bp/bc | parcial → purga-total |
| SenalComunitariaCache | BORRAR | Caché de agregados (dato) | — | **SÍ** → purga-total |
| PatronExpediente | BORRAR | Patrones detectados (dato) | bp/bc | parcial → purga-total |
| GuiaAccionCategoria | **PRESERVAR** | Guías editoriales (seed/config) | — | no |
| Notificacion | BORRAR | Cola/auditoría de envíos (dato) | — | **SÍ** → purga-total |
| NotificacionPlantilla | **PRESERVAR** | Plantillas (seed/config) | — | no |
| NotificacionRegla | **PRESERVAR** | Reglas de disparo (seed/config) | — | no |
| NotificacionPreferencia | BORRAR | Opt-out de usuarios (dato) | — | **SÍ** → purga-total |
| NotificacionContactoBloqueado | BORRAR | Bounces (dato) | — | **SÍ** → purga-total |
| ScoreCliente | BORRAR | Snapshots mensuales (dato) | — | **SÍ** → purga-total |
| ReglaRecomendacion | **PRESERVAR** | Definiciones del motor de reglas (config) | — | no |
| Recomendacion | BORRAR | Instancias generadas (dato) | — | **SÍ** → purga-total |
| DigestSemanal | BORRAR | Digests generados (dato) | — | **SÍ** → purga-total |
| Anomalia | BORRAR | Anomalías detectadas (dato) | — | **SÍ** → purga-total |
| AclaracionExpediente | BORRAR | Aclaraciones (dato) | bp/bc | parcial → purga-total |
| ContactoEmergencia | BORRAR | Contactos del padre (dato) | — | **SÍ** → purga-total |
| ReglaRecomendacionHistorial | BORRAR | Versionado generado por ediciones de admins de prueba (dato, no config viva) | — | **SÍ** → purga-total |
| EjecucionAccion | BORRAR | Trazas de acciones (dato) | — | **SÍ** → purga-total |
| AnalisisExpediente | BORRAR | Análisis IA de expedientes de prueba | — | **SÍ** → purga-total |
| InformeCaso | BORRAR | Informes firmados de casos de prueba | bc/pg | parcial → purga-total |
| PerfilProfesional | BORRAR | Perfiles de profesionales de prueba | — | **SÍ** → purga-total |
| DocumentoProfesional | BORRAR | Documentos (cascade) | — | **SÍ** → purga-total |
| VerificacionProfesional | BORRAR | Verificaciones (dato) | — | **SÍ** → purga-total |
| FranjaDisponible | BORRAR | Franjas de agenda (dato) | — | **SÍ** → purga-total |
| SolicitudCita | BORRAR | Citas de prueba | — | **SÍ** → purga-total |
| EncuestaPrimeraCita | BORRAR | Encuestas (dato) | — | **SÍ** → purga-total |

**Totales: 16 PRESERVAR · 94 BORRAR completos + `Usuario` (parcial, solo soporte@).**

## Decisiones intermedias (explicitadas)

- **TasaCambio → BORRAR.** Es histórico de tasas (API/manual), no catálogo ni
  seed: se repuebla solo con la primera consulta del conversor. Preservarla
  arrastraría precios de prueba a la era post-purga.
- **BlockList → BORRAR.** Alimentada casi exclusivamente por el simulador de
  abusos (data de prueba). Se acepta perder bloqueos genuinos: en producción
  piloto todo es data de prueba (D-113); la lista se repuebla con bloqueos reales.
- **AuditLog → PRESERVAR (siempre).** Append-only. Las entradas que referencian
  datos de prueba quedan como histórico; sus FKs a `Usuario`/`Colegio` son
  nullable/SetNull, así que sobreviven al borrado.
- **FuenteReporte → BORRAR (reclasificado).** El dueño lo listó como catálogo,
  pero el modelo es por-reporte (`reporteId` @unique). El config de fuentes que
  sí es catálogo (pesos anti-abuso, rúbrica) vive en `ParametroSistema` y se preserva.
- **ReglaRecomendacionHistorial → BORRAR.** El dueño preserva `ReglaRecomendacion`
  (config viva); el historial son snapshots de ediciones hechas por admins de
  prueba → dato.
- **DatasetEntrenamiento/EmbeddingDataset → PRESERVAR** (entrenamiento del modelo);
  **EmbeddingReporte/ClasificacionIA → BORRAR** (dato de reportes).
- **NotificacionPlantilla/Regla → PRESERVAR**; **Notificacion/NotificacionInApp/
  NotificacionPreferencia/NotificacionContactoBloqueado/DigestSemanal → BORRAR**.
- **Config con FK requerida a `Usuario`** (`Plan.creadoPorAdminId`,
  `GuiaAccionCategoria.creadaPorAdminId`, `ReglaRecomendacion.creadaPorAdminId`):
  la purga total reasigna esas filas a `soporte@innovadataco.com` antes de borrar
  usuarios (la FK obliga a un dueño válido; la configuración se preserva).
- **`AuditConsentimiento`**: SPEC-508 niega el borrado *parcial* (evidencia legal);
  la purga **total** sí lo borra porque el consentimiento era de usuarios de prueba.

## Huecos de cobertura del flujo actual (reset-piloto default)

Cubre: colegios completos, padres PARENT, reportes huérfanos (salvo los 3
excluidos), simulaciones, y el pre-borrado global de solicitudes/alertas/
identificadores/observaciones/acudientes.

Huecos que cierra `purga-total.ts`:

1. Usuarios no-PARENT (ADMIN salvo soporte@, OPERADOR, COMITE_VALIDACION,
   COMITE_CONVIVENCIA, VERIFICADOR, PROFESIONAL, SCHOOL_ADMIN huérfanos) y sus
   perfiles (`PerfilOperador`, `IntegranteComite`, `IdentificadorIntegranteComite`).
2. Los 3 reportes «evidencia viva» y **todos** los reportes (sin excepciones).
3. Comercial global: `Pago`, `BonoPromocional`, `BonoAplicado`,
   `CodigoReferidoUso`, `TasaCambio`, `ScoreCliente`, `Subscription`, `BillingCycle`.
4. Expediente global: `Expediente` y cadena, `SenalComunitariaCache`,
   `AnalisisExpediente` (incluidos los de casos de colegio).
5. Profesionales: `PerfilProfesional`, `DocumentoProfesional`,
   `VerificacionProfesional`, `FranjaDisponible`, `SolicitudCita`, `EncuestaPrimeraCita`.
6. Apelaciones: `Apelacion`, `DocumentoApelacion`, `AccesoDocumentoApelacion`.
7. Notificaciones: `Notificacion`, `NotificacionPreferencia`,
   `NotificacionContactoBloqueado`.
8. Análisis: `Recomendacion`, `EjecucionAccion`, `ReglaRecomendacionHistorial`,
   `Anomalia`, `DigestSemanal`.
9. Logs operativos: `WorkerLog`, `HealthProbe`, `IncidenteInfra`, `SesionLog`,
   `RateLimit`, `DerivaMotorSnapshot`, `SimulacionAbusoRun`.
10. Anti-abuso/círculo global: `BlockList`, `AlertaSuscripcion`,
    `ContactoEmergencia`, tokens (`CodigoVerificacion`, `TokenRecuperacion`,
    `TokenRegistro`), `AuditConsentimiento`.
11. Agregados globales: `IdentificadorReportado` (todos, no solo huérfanos con
    match), `EventoMatch`, `PatronInstitucional` (cross-tenant).
12. `DemoMarcado` (el default no limpia marcas).

## Helpers reusables

- `scripts/limpieza/_common.ts`: `parseArgs`, `requerirMotivo`,
  `registrarAuditoria`, `log`, `PRESERVA_SIEMPRE`, `validarFlagsResetPiloto`.
- `scripts/limpieza/borrar-colegio.ts` / `borrar-padre.ts` / `borrar-reporte.ts` /
  `borrar-simulacion.ts`: órdenes FK-safe por entidad (modo default).
- `scripts/demo/_marcado.ts`: `enLotes`/`borrarEnLotes`/`contarEnLotes` (techo de
  32.767 parámetros de PostgreSQL — SPEC-420).
- `scripts/demo/_borrado-marcado.ts`: `planDeBorrado`/`ejecutarBorrado` (modo
  `--solo-sembrado`, por `demo_marcado`).

## Compuerta de la purga total

Tras borrar, `purga-total.ts` verifica y **tira error si falla**:

- `Reporte.count() === 0`.
- `Usuario` = exactamente los preservados (`soporte@innovadataco.com`).
- Conteos idénticos antes/después de: `ParametroSistema`, `Plan`,
  `DatasetEntrenamiento`, `NotificacionPlantilla`, `ModuloPermisible`,
  `Pais`/`Departamento`/`Ciudad` (y el resto de PRESERVAR: `AuditLog`,
  `EmbeddingDataset`, `NotificacionRegla`, `PermisoModulo`, `GuiaAccionCategoria`,
  `ReglaRecomendacion`, `Plataforma`, `TipoDocumento`).
