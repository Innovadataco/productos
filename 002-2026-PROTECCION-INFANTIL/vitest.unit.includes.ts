/**
 * Lista explícita de archivos de test considerados unitarios (sin base de datos).
 * Se usa en vitest.unit.config.ts y en el project "unit" de vitest.config.ts.
 * Mantener al día al agregar tests unitarios puros.
 */
export const UNIT_TEST_INCLUDES: string[] = [
    "prisma/seed-security.test.ts",
    "scripts/arch/no-prisma-mocks.test.ts",
    // SPEC-287 (002-PI-187): fuente única de guardias + cookie firmada de vigencia + 4 ratchets estáticos.
    "src/lib/routing/guardias.test.ts",
    "src/lib/routing/vigencia-cookie.test.ts",
    "src/lib/routing/middleware.test.ts",
    // SPEC-416 (I-118): fuente única de "titular del dato" y "con camino guiado".
    "src/lib/routing/roles-titulares.test.ts",
    // SPEC-423 (I-298): la credencial de respaldo se muestra SIEMPRE en admin.
    "src/app/api/admin/credencial-siempre-visible.candado.test.ts",
    // SPEC-463 (D-107): el colegio habla de usted; el padre conserva «tú».
    "src/app/dashboard/colegio/voz-usted.candado.test.ts",
    // SPEC-435 (Jelkin 04-09): la cuenta VERIFICADOR nace con un solo módulo
    // (no hereda operador/comité/padre). Fuente: `prisma/seed-modulos-grants.ts`.
    "src/lib/verificador-modulos.candado.test.ts",
    // SPEC-331 (002-PI-231): vigencia cookie sesion_estado derivada por rol (SCHOOL_ADMIN/COMITE_CONVIVENCIA → colegio, PARENT → suscripción, internos → ACTIVA).
    "src/lib/routing/sesion-estado-emitter.test.ts",
    // 002-PI-232 (A-65 · I-225): borrado FK-safe de Expediente/EventoExpediente en scripts de limpieza.
    "scripts/limpieza/borrar-limpieza.test.ts",
    // SPEC-329 (002-PI-229): guardianes de estado devuelven JSON 403 en /api/ (contraprueba 302 en pantallas).
    "src/middleware-api-guardias.test.ts",
    "scripts/lint/ratchets.test.ts",
    // SPEC-284 (002-PI-184 · I-130): compuerta de IDs de advisory lock únicos.
    "scripts/locks-check.test.ts",
    // SPEC-280 (002-PI-180): constructor puro del resumen del CI, sin BD ni red.
    "scripts/ci/resumen.test.mjs",
    // SPEC-281 (002-PI-180): algoritmo LPT de reparto de shards por peso.
    "scripts/ci/reparto-shards.test.mjs",
    // SPEC-450 (I-282): el margen contra el techo de 45 min — 6 shards, aviso
    // a los 30, y pesos que dicen de cuántas corridas salen.
    "scripts/ci/shards-margen.candado.test.mjs",
    // SPEC-381 (I-269): cada ruta de inicio-admin.ts DEBE tener page.tsx.
    "src/lib/dal/services/inicio-admin.ratchet.test.ts",
    // SPEC-414 (I-294): el marcador se consulta por su nombre físico
    // (`demo_marcado`) y una señal que truena se VE en vez de desaparecer.
    "src/lib/dal/services/inicio-admin.marcado.test.ts",
    // SPEC-398 (I-286): candado del jurado del pipeline real — sin override,
    // el motor recibe {} (jurado completo). Con override, {modeloClasificacion:X}.
    "src/lib/dal/services/reporte-processing/pipeline-jurado.test.ts",
    // SPEC-381 (I-276): la barra <ComiteSubNav> la monta solo el layout compartido.
    "src/app/dashboard/admin/comite/layout.ratchet.test.ts",
    // SPEC-389 (Red de Profesionales · L2): reserva legal del sello público + vigencia (Ley 2375/2024).
    "src/lib/profesionales/vigencia.test.ts",
    // SPEC-449 (I-313): el reloj de vencimiento. Candado de CABLEADO — la
    // lógica existía desde SPEC-389 y nadie la llamaba.
    "src/lib/profesionales/vencimiento.candado.test.ts",
    // SPEC-389: idempotencia del worker de vencimiento (candado I-280).
    "src/lib/profesionales/cron-vencimiento.test.ts",
    // SPEC-374: decisión should-skip (saltar CI en PRs que no tocan PI ni raíz compartida).
    "scripts/ci/should-skip-pi.test.mjs",
    // SPEC-375: dispose limpio del singleton pg-boss (cierra el event loop del fork).
    "src/lib/queue-dispose.test.ts",
    // SPEC-290 (002-PI-190): heartbeat de vida del worker-sesiones (helper puro).
    "scripts/worker-sesiones.test.mjs",
    // SPEC-290 (002-PI-190): mapeo sesion.* → sección "sesiones" del ConfigPanel.
    "src/components/modules/config-panel/types.test.ts",
    "src/app/dashboard/admin/estadisticas/components/EstadisticasSubNav.test.tsx",
    "src/app/dashboard/colegio/alertas/AlertasColegioPageClient.test.tsx",
    "src/components/modules/config-panel/MantenimientoLogsPanel.test.tsx",
    // SPEC-241 (002-PI-144): modal de consentimiento informado (sin BD).
    "src/components/modules/ModalConsentimiento.test.tsx",
    // SPEC-455: gráficas en tokens + dashboard público sin rojo de alarma (fuente, sin BD).
    "src/components/modules/graficas-y-mapa-sin-alarma.candado.test.ts",
    // SPEC-456: portada — canales oficiales arriba + hero en tokens + voz sin jerga (fuente, sin BD).
    "src/components/modules/portada-sin-alarma.candado.test.ts",
    // SPEC-473: GlassCard firma — radio por token, sin grano (fuente, sin BD).
    "src/components/ui/glasscard-firma.candado.test.ts",
    // SPEC-343 (I-232): candado — los documentos legales servidos no contienen notas internas.
    "src/lib/legal/documentos-servidos.test.ts",
    // SPEC-326 §3.1: vista de notificaciones del padre en frases (sin BD, mock fetch).
    "src/components/modules/perfil/PreferenciasNotificaciones.test.tsx",
    "src/app/dashboard/colegio/cursos/CursosPageClient.test.tsx",
    "src/app/dashboard/colegio/configuracion/ConfiguracionPageClient.test.tsx",
    "src/app/dashboard/colegio/profesores/ProfesoresPageClient.test.tsx",
    "src/components/modules/AdminNav.test.tsx",
    "src/components/modules/AdminAntiAbusoSimulador.test.tsx",
    "src/components/modules/AdminAntiAbusoSimulacion.test.tsx",
    "src/components/modules/AdminReporteDetalle.test.tsx",
    "src/components/modules/AdminReporteExpediente.test.tsx",
    "src/components/modules/admin/UsuariosSubNav.test.tsx",
    "src/components/modules/admin/tables/tables.test.tsx",
    // SPEC-233: búsqueda por identificador (padre + admin)
    "src/components/modules/admin/IdentificadorAgregadoAnonimo.test.tsx",
    "src/components/modules/admin/IdentificadorExpedientesAnonimos.test.tsx",
    "src/components/modules/padre/IdentificadorBusquedaClient.test.tsx",
    // SPEC-317: menú lateral del área padre (sin BD).
    "src/components/modules/padre/PadreSideNav.test.tsx",
    // I-261: el expediente vivo pinta fecha + hora sin minutos (helper compartido).
    "src/components/modules/padre/ExpedienteVivo.test.tsx",
    // SPEC-392 (L3): tarjeta del directorio (tarifa por delante, "Nuevo en la red").
    "src/components/modules/padre/profesionales/ProfesionalTarjeta.test.tsx",
    // SPEC-392 (L3 · H-4): baraja determinística por semilla.
    "src/lib/padre/directorio-shuffle.test.ts",
    // SPEC-392 (L3 · H-2 · veredicto CEO 13:30): candado de TIPO — la intersección
    // del DTO público con los campos prohibidos DEBE ser never. Si no, no compila.
    "src/lib/dal/repositories/perfil-profesional-dto.test.ts",
    "src/components/modules/ComiteBandeja.test.tsx",
    "src/components/modules/ComiteSolicitudDetalle.test.tsx",
    "src/components/modules/ConsultaEnriquecidaClient.test.tsx",
    "src/components/modules/ConsultaVaciaBloque.test.tsx",
    "src/components/modules/EstadoTransicion.test.tsx",
    "src/components/modules/LandingFooter.test.tsx",
    "src/components/modules/LandingHero.test.tsx",
    "src/components/modules/MisReporteDetalle.test.tsx",
    "src/components/modules/NavHeader.test.tsx",
    "src/components/modules/PublicDashboard.test.tsx",
    "src/components/modules/ReporteWizard.test.tsx",
    "src/components/modules/SeguimientoClient.test.tsx",
    "src/components/modules/SpamRevisionPanel.test.tsx",
    "src/components/modules/spam/SpamAnaliticaPanel.test.tsx",
    "src/components/modules/spam/SpamFiltros.test.tsx",
    "src/components/modules/spam/SpamReportesTabla.test.tsx",
    "src/components/modules/spam/SpamResolucionModal.test.tsx",
    "src/components/modules/audit-log/legible.test.ts",
    "src/components/modules/colegio/BuscadorGlobal.test.tsx",
    "src/components/modules/colegio/ColegioSideNav.test.tsx",
    "src/components/modules/colegio/comite/ComiteEstadisticas.test.tsx",
    "src/components/modules/colegio/curso/AcudienteContacto.test.tsx",
    "src/components/modules/colegio/curso/AnilloCurso.test.tsx",
    "src/components/modules/colegio/curso/CursoHeader.test.tsx",
    "src/components/modules/colegio/curso/FormAgregarEstudiante.test.tsx",
    "src/components/modules/colegio/curso/TablaEstudiantes.test.tsx",
    "src/components/modules/colegio/curso/TarjetasCurso.test.tsx",
    "src/components/modules/colegio/estadisticas/BarrasPorCurso.test.tsx",
    "src/components/modules/colegio/estadisticas/RelojActividad.test.tsx",
    "src/components/modules/colegio/estadisticas/RitmoMensual.test.tsx",
    "src/components/modules/colegio/home/AccionesRapidas.test.tsx",
    "src/components/modules/colegio/home/AnillosProteccion.test.tsx",
    "src/components/modules/colegio/home/CursosQueMerecenMirada.test.tsx",
    "src/components/modules/colegio/home/EmbudoEstado.test.tsx",
    "src/components/modules/colegio/home/EmptyStateColegio.test.tsx",
    "src/components/modules/colegio/home/FranjaVigilancia.test.tsx",
    "src/components/modules/colegio/home/HeroEstado.test.tsx",
    "src/components/modules/colegio/home/HomeRectorPage.test.tsx",
    // SPEC-353 (A-69 · C6): tarjeta de la frase accionable.
    "src/components/modules/colegio/home/QueHacerHoyCard.test.tsx",
    "src/components/modules/colegio/home/TendenciaReportes.test.tsx",
    "src/components/modules/colegio/seguimiento/BitacoraCaso.test.tsx",
    "src/components/modules/colegio/seguimiento/PendientesCaso.test.tsx",
    "src/components/modules/colegio/seguimiento/TimelineCaso.test.tsx",
    "src/components/modules/colegio/unificado/ImportExcel.test.tsx",
    "src/components/modules/colegio/unificado/SeccionCurso.test.tsx",
    "src/components/modules/colegio/unificado/SeccionIdentificadores.test.tsx",
    "src/components/modules/colegio/unificado/TablaEstudiantes.test.tsx",
    "src/components/modules/colegio/unificado/WizardUnificado.test.tsx",
    "src/components/modules/ia/IaModelSelector.test.tsx",
    "src/components/modules/ia/simulacion/TablaResultadosSimulacion.test.tsx",
    "src/components/modules/monitoreo/LogContextoModal.test.tsx",
    "src/components/modules/monitoreo/LogsTab.test.tsx",
    "src/components/modules/monitoreo/OperacionTableroClient.test.tsx",
    "src/components/modules/monitoreo/SemaforoCard.test.tsx",
    "src/components/modules/operadores/ReasignarModal.test.tsx",
    "src/components/modules/motor/DerivaProdBloque.test.tsx",
    "src/components/modules/nav-logo.test.ts",
    "src/components/providers/SessionPingProvider.test.tsx",
    "src/components/ui/Accordion.test.tsx",
    "src/components/ui/Alerta.test.tsx",
    // SPEC-454 (OLA 1 rediseño): candado de conducta del Button — la re-piel
    // (tokens + firma) no puede romper onClick/disabled/a11y/API de 5 variantes.
    "src/components/ui/Button.test.tsx",
    // SPEC-336 (marca El Guardián): reglas duras del símbolo (hueco del niño, tallas, ámbar).
    "src/components/ui/Guardian.test.tsx",
    "src/components/ui/Anillo.test.tsx",
    "src/components/ui/Cargando.test.tsx",
    "src/components/ui/CiudadSearchSelect.test.tsx",
    "src/components/ui/CommandPalette.test.tsx",
    "src/components/ui/Declaracion.test.tsx",
    "src/components/ui/EmptyState.test.tsx",
    "src/components/ui/ErrorState.test.tsx",
    "src/components/ui/LuzAmbiental.test.tsx",
    "src/components/ui/Modal.test.tsx",
    "src/components/ui/PanelVidrio.test.tsx",
    "src/components/ui/Tabla.test.tsx",
    "src/components/ui/TarjetaMetrica.test.tsx",
    "src/components/ui/Textarea.test.tsx",
    "src/components/ui/Tooltip.test.tsx",
    "src/components/ui/use-fetch-json.test.tsx",
    "src/lib/ai/anonimizador.test.ts",
    "src/lib/ai/classifier-votos.test.ts",
    "src/lib/ai/classifier.test.ts",
    "src/lib/ai/eval-runner.test.ts",
    "src/lib/ai/guardas-decision.test.ts",
    "src/lib/ai/keywords-riesgo.test.ts",
    "src/lib/ai/ollama-config.test.ts",
    "src/lib/ai/pii-patterns.test.ts",
    "src/lib/ai/rubrica-config.test.ts",
    "src/lib/ai/rubrica.test.ts",
    // SPEC-220: helpers puros de períodos Bogotá del dominio Análisis.
    "src/lib/analisis/periodos.test.ts",
    // SPEC-221 (002-PI-122): validador SQL y renderer de plantillas del motor de reglas (puros).
    "src/lib/analisis/reglas/ejecutor-sql.test.ts",
    "src/lib/analisis/reglas/plantilla.test.ts",
    // SPEC-223: ventana semanal Bogotá/ISO y contenido puro del digest (sin BD).
    "src/lib/analisis/semana.test.ts",
    "src/lib/analisis/digest-contenido.test.ts",
    // SPEC-225 (002-PI-126): ventanas Bogotá, comparativa semanal y puntualidad del detector (puros).
    "src/lib/analisis/anomalias/ventanas.test.ts",
    "src/lib/analisis/anomalias/comparativas.test.ts",
    "src/lib/analisis/anomalias/puntualidad.test.ts",
    // SPEC-225 (002-PI-126): fail-open de alertas al CEO (Motor Notif mockeado, sin BD).
    "src/lib/analisis/anomalias/alertas.test.ts",
    // SPEC-220: card presentacional del score de valor (sin BD).
    "src/components/modules/pagos/ScoreClienteCard.test.tsx",
    // SPEC-355: la tarjeta freemium del colegio en el selector de planes.
    "src/components/modules/pagos/PlanesSelector.test.tsx",
    // SPEC-245 (002-PI-148): modal de activación / autorización manual (sin BD).
    "src/components/modules/pagos/ActivarSuscripcionManual.test.tsx",
    // 002-PI-068: fuente-reporte-salt.test.ts importa fuente-reporte.ts que carga
    // repositorios Prisma al evaluarse; lo movemos a integration.
    "src/lib/api-handler.test.ts",
    "src/lib/auth.test.ts",
    // SPEC-310 (002-PI-211): whitelist de returnTo del puente PI→BI — función pura, sin BD.
    "src/lib/auth/validar-return-to.test.ts",
    // SPEC-319 (002-PI-219 · I-212): fuente única rol→home — función pura, sin BD.
    "src/lib/auth/home-para-rol.test.ts",
    "src/lib/colegio/alertas-prioridad.test.ts",
    // 002-PI-068: parser.test.ts importa parser.ts que carga repositorios Prisma.
    "src/lib/colegio/carga/validator.test.ts",
    // SPEC-352 (hotfix): guard del resetDatabase — jamás truncar una BD sin "test".
    "src/lib/validar-bd-de-test.test.ts",
    // SPEC-344 (A-69 · C1): test-candado de la plantilla de profesores.
    "src/lib/colegio/carga-profesores/plantilla-autoconsistente.test.ts",
    // SPEC-344 (FR-026-ter · cierra I-245): test-candado de la plantilla de alumnos.
    "src/app/api/colegio/carga/plantilla/plantilla-alumnos-autoconsistente.test.ts",
    "src/lib/dal/repositories/analytics-colegio-helpers.test.ts",
    "src/lib/colegio/fechas-humano.test.ts",
    "src/lib/colegio/normalizacion.test.ts",
    "src/lib/colegio/periodo.test.ts",
    // SPEC-361 (A-70 · F7/F8): documento por tipo y edad del menor.
    "src/lib/padre/documento-menor.test.ts",
    "src/lib/profesional/dto.test.ts",
    "src/lib/profesional/autorizacion-storage.test.ts",
    "src/lib/profesional/cita/dto.test.ts",
    // SPEC-353 (A-69 · C6): reglas puras de la frase "qué hacer hoy" del rector.
    "src/lib/colegio/que-hacer-hoy.test.ts",
    "src/lib/colegio/seguimiento.test.ts",
    "src/lib/colegio/semaforo.test.ts",
    "src/lib/config-cache.test.ts",
    "src/lib/credenciales-literal.test.ts",
    "src/lib/design-tokens.test.ts",
    "src/lib/docs/indice.test.ts",
    "src/lib/errors.test.ts",
    "src/lib/expediente/analisis-interno.test.ts",
    "src/lib/expediente/expediente-forense.test.ts",
    // SPEC-236: whitelist pura de la máquina de estados (sin BD).
    "src/lib/expediente/estados/transiciones.test.ts",
    "src/lib/expediente/mensaje-padre.test.ts",
    // SPEC-236: helpers puros de fechas del motor (America/Bogota, sin BD).
    "src/lib/expediente/motor/fechas-motor.test.ts",
    "src/lib/expediente/pdf-denuncia.test.ts",
    "src/lib/fetch-retry.test.ts",
    "src/lib/format/fecha.test.ts",
    "src/lib/ai/sandbox.test.ts",
    "src/lib/monitoreo/worker-logger.test.ts",
    "src/lib/monitoreo/tick-vida.test.ts",
    "src/lib/servicios/docker-adapter.test.ts",
    "src/lib/servicios/compose.ratchet.test.ts",
    "src/lib/servicios/tick-vida.ratchet.test.ts",
    "src/lib/servicios/api-guard.ratchet.test.ts",
    "src/lib/dal/services/session-log.unit.test.ts",
    "src/hooks/useSessionPing.test.ts",
    "src/lib/session-log/ip-hash.test.ts",
    "src/lib/nav-items.test.ts",
    "src/lib/normalizar.test.ts",
    "src/lib/notificaciones/offset.test.ts",
    "src/lib/notificaciones/quiet-hours.test.ts",
    "src/lib/notificaciones/renderer.test.ts",
    // SPEC-302 (002-PI-208): logger estructurado del motor — todo mockeado, sin BD.
    "src/lib/notificaciones/motor-logger.test.ts",
    "src/lib/param-encryption.test.ts",
    "src/lib/pagos/api-helpers.test.ts",
    "src/lib/pagos/bono-aplicacion.service.test.ts",
    "src/lib/pagos/pagos-calculos.service.test.ts",
    "src/lib/pagos/tasas.test.ts",
    // SPEC-213 (002-PI-113): motor de vigencia de pagos.
    "src/lib/pagos/vigencia.service.test.ts",
    // SPEC-211 (002-PI-111): vistas de cliente del módulo de pagos.
    "src/lib/pagos/renovacion-calculos.test.ts",
    // SPEC-215 (002-PI-115): generador puro de códigos de referido (sin BD).
    "src/lib/utils/referido-codigo.test.ts",
    "src/lib/pagos/comprobante-storage.test.ts",
    "src/components/modules/cliente/suscripcion/SuscripcionResumen.test.tsx",
    // SPEC-218 (002-PI-118): analítica dinero-vs-valor (cálculos puros, servicio con repo doble y componentes).
    "src/lib/pagos/analitica-calculos.test.ts",
    "src/lib/pagos/analitica.service.test.ts",
    "src/components/modules/admin/pagos/analitica/KpiPagosCards.test.tsx",
    "src/components/modules/admin/pagos/analitica/WidgetsAccion.test.tsx",
    "src/components/modules/admin/pagos/analitica/WidgetCrecimientoPaisCiudad.test.tsx",
    // SPEC-217 (002-PI-117): freemium 30 días (cálculos puros y servicio con dependencias mockeadas, sin BD).
    "src/lib/pagos/freemium-calculos.test.ts",
    "src/lib/pagos/freemium.service.test.ts",
    "src/lib/plataforma.test.ts",
    "src/lib/proxy.test.ts",
    "src/lib/queue.test.ts",
    "src/lib/reportar-handoff.test.ts",
    "src/lib/reporte-aprobado.test.ts",
    "src/lib/reporte-estados-usuario.test.ts",
    "src/lib/reportes-acceso.test.ts",
    "src/lib/riesgo-consulta.test.ts",
    // 002-PI-068: role-visibility.test.tsx importa proxy.ts que carga repositorios Prisma.
    "src/lib/schemas/index.test.ts",
    "src/lib/schemas/pagos.test.ts",
    "src/lib/schemas/unificado.test.ts",
    "src/lib/simulacion/executor.test.ts",
    "src/lib/simulacion/metricas.test.ts",
    "src/lib/simulacion/parser.test.ts",
    "src/lib/simulacion/progreso.test.ts",
    "src/lib/specs-discipline.test.ts",
    "src/lib/texto-reporte-cifrado.test.ts",
    "src/lib/texto-reporte-frontera.test.ts",
    "src/lib/url-privacy.test.ts",
    "src/lib/validation.test.ts",
    "src/lib/validators.test.ts",
    "src/lib/version.test.ts",
    "src/lib/worker-auth.test.ts",
    "src/lib/worker-heartbeat.test.ts",
    "src/proxy-csp.test.ts",
    // SPEC-237: bandeja comité CONSOLIDACION + aprobación multi-miembro
    "src/lib/comite/sla.test.ts",
    "src/components/modules/comite/consolidacion/ConsolidacionAcciones.test.tsx",
    // SPEC-222: helpers puros y schemas Zod del panel Dinero vs Valor.
    "src/lib/analisis/panel-calculos.test.ts",
    "src/lib/schemas/analisis-panel.test.ts",
    // SPEC-238: helpers puros del SLA de aclaración y schemas Zod (sin BD).
    "src/lib/expediente/motor/sla-aclaracion.test.ts",
    "src/lib/schemas/aclaracion.test.ts",
    // SPEC-222: bloque Top 5 decisiones del panel (sin BD).
    "src/app/dashboard/admin/estadisticas/dinero-vs-valor/components/TopDecisiones.test.tsx",
    // SPEC-239: schemas Zod de contactos de emergencia y botón de emergencia del comité (sin BD).
    "src/lib/schemas/contacto-emergencia.test.ts",
    "src/components/modules/comite/consolidacion/BotonActivarEmergencia.test.tsx",
    // SPEC-227: filtros Zod + pseudonimización + CSV + vista del historial (sin BD).
    "src/lib/analisis/filtros-historial.test.ts",
    "src/lib/analisis/pseudonimizar.test.ts",
    "src/lib/analisis/historial-csv.test.ts",
    "src/app/dashboard/admin/analisis/recomendaciones/components/HistorialRecomendaciones.test.tsx",
    // SPEC-224: validador estático SQL, helpers del test-sql, versionado y schemas Zod (sin BD).
    "src/lib/analisis/reglas/validar-sql.test.ts",
    "src/lib/analisis/reglas/test-sql.test.ts",
    "src/lib/analisis/reglas/versionado.test.ts",
    "src/lib/schemas/analisis-reglas.test.ts",
    // SPEC-224: diálogo de confirmación fuerte del cambio de modo (fetch mockeado, sin BD).
    "src/components/modules/analisis/ReglaModoDialog.test.tsx",
    // SPEC-226: schemas Zod de acciones + helpers puros de handlers (vigencia Bogotá, nombre bono, destinatarios alerta, menor_carga).
    "src/lib/analisis/acciones/schemas.test.ts",
    "src/lib/analisis/acciones/handlers/crear-bono.test.ts",
    "src/lib/analisis/acciones/handlers/crear-alerta.test.ts",
    "src/lib/analisis/acciones/handlers/asignar-operador.test.ts",
    // SPEC-240 (002-PI-143): pre-registro simplificado de colegio (sin BD).
    "src/app/dashboard/admin/colegios/nuevo/NuevoColegioPageClient.test.tsx",
    "src/components/modules/InvitacionEnviadaModal.test.tsx",
    // SPEC-367 (A-73): los 3 estados del círculo de confianza (fetch mockeado, sin BD).
    "src/components/modules/padre/circulo/CirculoConfianzaClient.test.tsx",
    // SPEC-440 P2 (Jelkin 04-09): el círculo pinta 4 con 5+ personas; candado
    // valida el conteo de puestos con 0/3/4/5/10/20 (tope brief).
    "src/components/modules/padre/circulo/IlustracionCirculo.test.tsx",
    // SPEC-440 P5 (Jelkin 04-09): el form persiste presentación en el perfil
    // para no volver a pedirla en cada ingreso.
    "src/components/modules/padre/profesionales/PresentacionUrgenciaForm.test.tsx",
    // SPEC-440 P3 (Jelkin 04-09): /mis-reportes trae el mismo shell del área
    // del padre (PadreSideNav + PadreNavMovil).
    "src/app/mis-reportes/layout.candado.test.ts",
    // SPEC-370 (I-264/I-265): nombre y bloque "Dónde" en el detalle del círculo.
    "src/components/modules/padre/circulo/DetallePersona.test.tsx",
    // SPEC-368 (A-74 · P1): control amable de la fecha del hecho (candados de B1).
    "src/components/modules/FechaHoraIncidente.test.tsx",
    // SPEC-368 (A-74): candado de la plantilla del camino guiado (autoconsistente con su validador).
    "src/app/api/colegio/cursos/unificado/plantilla/plantilla-lista-autoconsistente.test.ts",
    // SPEC-369: candados del poblador demo v2.
    "scripts/demo/demo-v2.test.ts",
    "scripts/demo/demo-v3.test.ts",
    // SPEC-382: candados del poblador demo v4 (5000 reportes, +11 países).
    "scripts/demo/demo-v4.test.ts",
    // SPEC-412 (BRIEF A-76 · I-292): el poblador v5 no fabrica llaves primarias,
    // marca en `demo_marcado`, y el validador NO se ablanda para los ids viejos.
    "scripts/demo/demo-v5.test.ts",
    // SPEC-420: el borrado va por lotes — PostgreSQL admite 32.767 parámetros
    // por sentencia y producción tenía 37.176 marcas.
    "scripts/demo/lotes.test.ts",
    // SPEC-378: Inicio del administrador (server component + tarjetas ámbar).
    "src/app/dashboard/admin/inicio/page.test.tsx",
    // SPEC-379: membrete institucional compartido + candado UI materia-profesor.
    "src/lib/colegio/membrete-pdf.test.ts",
    "src/components/modules/colegio/curso/SeccionMateriasCurso.test.tsx",
    "src/components/modules/colegio/CargaProfesoresExcel.test.tsx",
    // SPEC-401 (I-283): helper puro para resumir/sanitizar el motivo real del proveedor de correo.
    "src/lib/notificaciones/motivo-error.test.ts",
    // SPEC-408 (A-75 · brief §9): reader parametrizable + candado H-2 de la
    // vista del profesional (nunca expone resultado/checklist) + candado
    // permanente del emisor (solo APROBADO o MAS_INFORMACION — orden Jelkin).
    "src/lib/profesionales/verificador/requisitos.test.ts",
    "src/lib/profesionales/verificador/vista-profesional.test.ts",
    "src/lib/profesionales/verificador/service.candado.test.ts",
    // SPEC-425 (A-75 · L5): el panel del profesional no pinta botones sin motor,
    // el marcador respeta el brief §3 y el porcentaje sale de un solo lugar.
    "src/lib/profesional/panel/panel.candado.test.ts",
    // SPEC-447 (I-311): la hora de Bogotá en un solo lugar — el camino inverso
    // (hora de pared → instante guardado) que necesita el calendario.
    "src/lib/fechas/formato-bogota.test.ts",
    // SPEC-447 (I-311): la API de franjas estuvo sin pantalla desde SPEC-395.
    // Este candado falla si vuelve a quedarse sin consumidor en la interfaz.
    "src/lib/profesional/calendario.candado.test.ts",
    // SPEC-437 (punto 5): el panel decía «Hola, ¡Hola!» — el saludo usa el
    // nombre, no el campo libre de la ficha.
    "src/lib/profesional/panel/saludo.test.ts",
    // SPEC-437 (I-299): el menú del profesional no promete pantallas muertas
    // ni pinta items ajenos, y sale de la misma lista que el desplegable.
    "src/lib/profesional/menu.candado.test.ts",
    // SPEC-403 (I-288): la comisión es parámetro, no constante — y el seed no
    // le pisa al admin el valor que ajustó.
    "src/lib/profesional/cita/comision.test.ts",
    // SPEC-418 (I-295): el Verificador no vuelve a mandar el aviso por su cuenta;
    // se encola en el motor DENTRO de la transacción de la decisión.
    "src/lib/profesionales/verificador/service.aviso.test.ts",
    // SPEC-419 (I-296): los dos correos de la puerta del profesional tienen su
    // regla y su plantilla en el seed. Sin ellas nadie puede registrarse.
    "src/lib/email-profesional.candado.test.ts",
    // SPEC-415 (tras I-294): los 8 sitios que dejaron de tragarse el error no
    // pueden volver a enmudecer — 5 avisos de cambio de clave + 3 pantallas que
    // confundían "no hay nada" con "no pude mirar".
    "src/lib/errores-no-mudos.test.ts",
    // SPEC-432: prueba con DOS RAMAS DE VERDAD que los generados dejaron de
    // ser terreno de conflicto, con contraprueba sin .gitattributes.
    "scripts/specs/merge-sin-conflicto.candado.test.ts",
    // SPEC-432b: lo mismo para los artefactos de arquitectura, con la matriz
    // que demuestra que aflojar el orden no aflojó el contenido.
    "scripts/arch/artefactos-sin-conflicto.candado.test.ts",
    "src/components/modules/NotificacionesInbox.test.tsx",
    // SPEC-436 (I-303): la función que descifra el documento no puede volver a
    // quedar sin llamador, y el enlace no puede volver a ser el id crudo.
    "src/lib/profesional/documentos.candado.test.ts",
    // SPEC-444 (I-310): los ids de PI son cuid. Validarlos con uuid() dejaba
    // `POST /api/padre/citas` en 400 permanente. Candado de caso + de clase.
    "src/app/api/padre/citas/identificadores-cuid.test.ts",
    "src/lib/schemas/identificadores.candado.test.ts",
    // SPEC-438 (I-305): el sistema no puede volver a inventar la hora del hecho.
    "src/lib/reportes/fecha-hecho.candado.test.ts",
    "src/lib/reportes/franja-aproximada.test.ts",
    // SPEC-439: el aviso al padre. El defecto era código MUERTO (SPEC-135/308
    // construido y sin llamador), así que el candado mira el CABLEADO.
    "src/lib/dal/services/corroboracion-padre.candado.test.ts",
];
