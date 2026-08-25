# Índice maestro de especificaciones

> Última actualización: **2026-08-24** (mega-lote 002-PI: SPEC-211/213/215/217/218/220-227/233/236-239 planeadas; ver `specs/233-busqueda-por-identificador/`, `specs/220-modelo-analisis-score/` y `specs/236-motor-estados-worker-eventos/`).
> Cruce con el ESTADO-SPECS de gestión (snapshot 2026-07-29: 72/26/9/3): la lectura directa de headers da **62/36/11/1**.
> Deltas explicados: (a) 053 y 017 pasaron de Planeada a Implementada (002-PI-046); (b) las 10 specs del clúster
> 085–095, que el snapshot contó como CERRADA, tienen header literal `FINALIZADO (pendiente ACTA-VALIDACION de ZEUS → CERRADA)`
> — se reporta la divergencia a ZEUS; manda el header del repo.

## Resumen

| Métrica | Valor |
|---------|-------|
| **Total de specs** | **215** |
| **Cerradas (CERRADA)** | **62** |
| **Finalizadas (FINALIZADO)** | **37** |
| **Implementadas (IMPLEMENTADO)** | **51** |
| **Pendientes (PLANEADO)** | **32** |
## Backlog activo (no cerradas)

| Nº | Nombre | Estado |
|----|--------|--------|
| [006](006-paginas-legales/spec.md) | Páginas Legales y Footer | 🟢 Finalizada (pendiente ACTA) |
| [007](007-alertas-email/spec.md) | Alertas por Email | 🟢 Finalizada (pendiente ACTA) |
| [017](017-documentacion/spec.md) | Spec 017 — Módulo de documentación navegable | 🟢 Implementada (2026-07-30, cola nocturna 002-PI-046) |
| [019](019-permisos-modulos/spec.md) | Spec 019 — Gestor de permisos de módulos por ROL | 🟢 Finalizada (pendiente ACTA) |
| [053](053-capa-datos-servicios/spec.md) | Capa de datos / servicios (DAL) | 🟢 Implementada |
| [085](085-evaluacion-error-silencioso/spec.md) | Spec 085 — Evaluación por error silencioso y modelo por defecto | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [086](086-navegacion-gobernada-permisos/spec.md) | Spec 086 — Navegación y páginas gobernadas por permisos | 🟢 Finalizada (pendiente validación funcional del CEO + ACTA-VALIDACION de ZEUS → |
| [087](087-saneamiento-speckit-fase2/spec.md) | Spec 087 — Saneamiento Spec Kit, fase 2 | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [088](088-pendientes-afinamiento/spec.md) | Spec 088 — Pendientes de afinamiento (registro vivo) | 🔵 Planeado |
| [089](089-presentacion-usuario/spec.md) | Spec 089 — Presentación al usuario: estados, categorías y consulta pública | 🟢 Finalizada (pendiente validación del CEO + ACTA-VALIDACION de ZEUS → CERRADA) |
| [090](090-clasificacion-rubrica-multimodelo/spec.md) | Spec 090 — Clasificación por rúbrica multi-etiqueta + multi-modelo + "Mis re | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA; validación banco 200  |
| [091](091-ux-privacidad-consulta-seguimiento/spec.md) | Spec 091 — UX y privacidad de la consulta + seguimiento | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [092](092-motor-logica-corregida/spec.md) | Spec 092 — Motor: lógica corregida y validada | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [093](093-coherencia-padre/spec.md) | Spec 093 — Coherencia del padre autenticado | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [094](094-deuda-tecnica-documentacion/spec.md) | Spec 094 — Deuda técnica y documentación | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [095](095-default-seguro-jwt-banco/spec.md) | Spec 095 — Default seguro, JWT parametrizado y banco gobernado | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [096](096-expediente-reporte/spec.md) | Spec 096 — Expediente del reporte: traza del modelo (rol Admin) | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS) |
| [097](097-despliegue-hibrido-produccion/spec.md) | Despliegue híbrido a producción (VPS + cerebro en la Mac) | 🟢 Finalizada (pendiente ACTA) |
| [098](098-afinamiento-motor/spec.md) | Afinamiento del motor (rúbrica) — targeting, principal por gravedad y métric | 🟢 Finalizada (pendiente ACTA) |
| [099](099-rotacion-claves-i22/spec.md) | Rotación de claves filtradas + regla no-secretos (I-22) | 🟢 Finalizada (pendiente ACTA) |
| [100](100-correcciones-colegios/spec.md) | Correcciones módulo Colegios (+ Comité) | 🟢 Finalizada (pendiente ACTA) |
| [101](101-app-publica-entorno/spec.md) | App pública y entorno (I-23 / I-24 / A-2) | 🟢 Finalizada (pendiente ACTA) |
| [102](102-sello-version/spec.md) | Sello de versión (dev y prod) | 🟢 Finalizada (pendiente ACTA) |
| [103](103-fix-fuga-pii-seguimiento/spec.md) | Fix fuga de PII en seguimiento público (I-28, Crítica) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [104](104-motor-indices-rubrica/spec.md) | Motor de rúbrica — votación por índices (adiós al match verbatim) | 🟢 Finalizada (implementada; medición de reproducibilidad = B5 de la cola 002-PI-02 |
| [105](105-seed-admin-seguro/spec.md) | Seed del admin inicial sin credencial literal (I-31) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [106](106-logout-cookie-secure/spec.md) | Cerrar sesión de verdad (cookie `__Host-` y enrutado público del logo) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [107](107-gate-antirrecaidas/spec.md) | SPEC-107 — El gate que evita recaídas | 🟢 Finalizada |
| [108](108-higiene-seguridad-ux/spec.md) | SPEC-108 — Higiene de seguridad y UX | 🟢 Finalizada |
| [109](109-eliminar-modulo-apelacion/spec.md) | SPEC-109 — Eliminar el módulo de apelación actual (D-34) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [110](110-apelacion-identificador/spec.md) | Spec 110 — Apelación del identificador reportado | 🟢 Implementada |
| [111](111-motor-rubrica-default/spec.md) | SPEC-111 — D-28: el motor de rúbrica pasa a ser el predeterminado | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [113](113-colegio-atrapado-menu-rol/spec.md) | SPEC-113 — El colegio atrapado (I-35/I-35b) y menú por rol (I-36) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [114](114-suite-e2e-por-rol/spec.md) | SPEC-114 — Suite E2E por rol y estabilización por ciclos | 🟢 Finalizada (6 ciclos verdes; ver cierre.md y docs/ciclos-estabilizacion-114.md) |
| [115](115-catalogo-geografico-latam/spec.md) | Catálogo geográfico real LATAM y Centroamérica (SPEC-115, bloque B1 cola 002- | 🟢 Implementada (sin push ni despliegue; verificación quickstart pendiente del deploy |
| [116](116-vista-padre-sin-tecnico/spec.md) | Vista del padre sin traza técnica del motor | 🟢 Finalizada (SIN push ni desplegar; release lo gatea ZEUS) |
| [117](117-gestion-padres-admin/spec.md) | Gestión de credenciales de padres desde admin (I-37) | 🟢 Implementada (SIN push ni deploy; el coordinador de la cola empuja en serie y ZEUS  |
| [118](118-clics-muertos-colegio/spec.md) | Clics muertos del colegio (D-37) | 🟢 Implementada (SIN desplegar — commit sin push; el coordinador de la cola 002-PI-0 |
| [119](119-vigencia-servicio-cliente/spec.md) | Vigencia del servicio por cliente (padres y colegios) | 🟢 Implementada (SIN push ni deploy; el coordinador de la cola empuja en serie y ZEUS  |
| [120](120-smoke-prod-safe/spec.md) | SPEC-120 — Smoke prod-safe por rol | 🟢 Finalizada (ver cierre.md) |
| [121](121-error-wrapper-ollama-timeout/spec.md) | SPEC-121 — Sobre de error único (R2) + timeout de Ollama | 🟢 Finalizada (ver cierre.md) |
| [122](122-capa-datos-reportes/spec.md) | SPEC-122 — Capa de datos: predicados centrales de acceso a reportes | 🟢 Finalizada |
| [123](123-motor-tipos-muerto-guardas/spec.md) | Spec 123 — Motor: tipos desde Prisma, código muerto y guardas unificadas | 🟢 Finalizada |
| [124](124-primitivas-ui-compartidas/spec.md) | SPEC-124 — Primitivas UI compartidas (R7) | 🟢 Finalizada (ver cierre.md) |
| [125](125-validacion-unificada-api/spec.md) | SPEC-125 — API: una sola forma de validar | 🟢 Implementada |
| [126](126-linea-base-arquitectura/spec.md) | SPEC-126 — Línea base de arquitectura generada desde el código | 🟢 Implementada |
| [127](127-home-padre/spec.md) | SPEC-127 — Home del padre (PARENT → /dashboard) | 🟢 Implementada |
| [128](128-reconciliacion-grants-comite/spec.md) | SPEC-128 — Reconciliación de grants del comité | 🟢 Implementada |
| [129](129-rediseno-ux-colegio/spec.md) | SPEC-129 — Rediseño de UX del panel del colegio (002-PI-051B) | 🟢 Implementada |
| [130](130-cifrado-reposo-texto-reporte/spec.md) | SPEC-130 — Cifrado en reposo del texto del reporte (BL-4) | 🟢 Implementada (migración de datos en prod pendiente de BL-2) |
| [131](131-visibilidad-solo-aprobados/spec.md) | SPEC-131 — Visibilidad pública solo por reportes aprobados (BL-5) | 🟢 Implementada |
| [132](132-seguridad-carga-colegio/spec.md) | SPEC-132 — Seguridad de la carga masiva del colegio (S-3 exceljs + S-4 roster server-side) | 🟢 Implementada |
| [133](133-journeys-e2e-gate-cobertura-roles/spec.md) | SPEC-133 — Journeys E2E por rol: gate de merge + cobertura completa (Q-1) | 🟢 Implementada |
| [134](134-dal-colegio-tenant-obligatorio/spec.md) | SPEC-134 — DAL del módulo colegio con tenant obligatorio (E-1) | 🟢 Implementada |
| [135](135-circulo-confianza-god-module-n1/spec.md) | SPEC-135 — circulo-confianza: romper god-module + matar N+1 (E-2) | 🟢 Implementada |
| [136](136-tipado-estricto-casts-guards-tsconfig/spec.md) | SPEC-136 — Tipado estricto: casts, guards y tsconfig maximal viable (E-3) | 🟢 Implementada |
| [137](137-creacion-reporte-atomica/spec.md) | SPEC-137 — Creación de reporte atómica (E-5) | 🟢 Implementada |
| [138](138-eval-sandbox-rubrica-posible-agresor-par/spec.md) | SPEC-138 — Eval/sandbox alineados con la rúbrica + posibleAgresorPar (E-7) | 🟢 Implementada |
| [139](139-evento-match/spec.md) | SPEC-139 — Métrica del match: segundo reporte independiente (F5) | 🟢 Implementada |
| [140](140-denuncia-formal/spec.md) | SPEC-140 — Denuncia formal: PDF determinista + panel forense (F2+N-4) | 🟢 Implementada |
| [141](141-admin-solo-lectura-padres-colegios/spec.md) | SPEC-141 — Admin solo lectura: círculo de padres + cursos/alumnos (N-1) | 🟢 Implementada |
| [142](142-patrones-institucionales/spec.md) | SPEC-142 — Patrones institucionales con k-anonimato k=3 (F6) | 🟢 Implementada |
| [143](143-home-rector/spec.md) | SPEC-143 — Home operativo del rector (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [144](144-modelo-estudiante/spec.md) | SPEC-144 — Modelo Estudiante expandido (rename desde Alumno) (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [145](145-modelo-profesor/spec.md) | SPEC-145 — Modelo Profesor mínimo (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [146](146-wizard-curso-unificado/spec.md) | SPEC-146 — Wizard unificado curso + estudiantes + identificadores (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [147](147-vista-curso/spec.md) | SPEC-147 — Vista de curso: escritorio con acudientes clicables (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [148](148-profesores-buscador/spec.md) | SPEC-148 — Profesores + buscador global ⌘K (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [149](149-avisos-email/spec.md) | SPEC-149 — Avisos por email configurables del colegio (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [150](150-observacion-especial/spec.md) | SPEC-150 — Observación especial de estudiantes (002-PI-058) | 🟢 Implementada (002-PI-058; ver cierre.md) |
| [151](151-informe-pdf-mensual/spec.md) | SPEC-151 — Informe PDF mensual determinístico (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [152](152-duplicar-curso/spec.md) | SPEC-152 — Duplicar curso al año siguiente (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [153](153-comparativa-cursos/spec.md) | SPEC-153 — Comparativa entre cursos (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [154](154-confianza-transparencia/spec.md) | SPEC-154 — Confianza: transparencia, protocolo e historial (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [155](155-timeline-ver-proceso/spec.md) | SPEC-155 — Timeline "Ver proceso" para ADMIN (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [156](156-panel-monitoreo-worker/spec.md) | SPEC-156 — Panel de monitoreo del worker para ADMIN (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [159](159-seguimiento-caso/spec.md) | SPEC-159 — Seguimiento del caso con bitácora: línea de tiempo, pendientes y notas inmutables (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [158](158-tablero-colegio/spec.md) | SPEC-158 — Tablero de control del colegio: embudo, reloj 24h, ritmo y barras (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [157](157-sistema-diseno/spec.md) | SPEC-157 — Sistema de diseño de Protección Infantil: tokens, tipografía y primitivos (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [160](160-dataset-demo-produccion/spec.md) | SPEC-160 — Dataset demo de producción (002-PI-059) | 🔵 Planeada |
| [162](162-materia-configurable/spec.md) | SPEC-162 — Materia configurable en cursos (002-PI-061) | 🟢 Implementada |
| [163](163-acudiente-completo/spec.md) | SPEC-163 — Acudiente completo: identificadores + edición post-alta (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [164](164-identificadores-profesor/spec.md) | SPEC-164 — Identificadores de profesor + estadísticas (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [165](165-alertas-extendidas/spec.md) | SPEC-165 — Alertas extendidas: profesor/acudiente (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [166](166-alertas-nivel-dios/spec.md) | SPEC-166 — Alertas nivel dios: bandeja de prioridad (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [167](167-rediseno-3-a-2/spec.md) | SPEC-167 — Rediseño 3→2: Inicio + Estadísticas (002-PI-062) | 🟢 Implementada |
| [168](168-comite-convivencia/spec.md) | SPEC-168 — Comité de Convivencia por colegio (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [169](169-onboarding-cobertura/spec.md) | SPEC-169 — Onboarding + cobertura + notificaciones in-app (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [170](170-limpieza-centro-control-ia/spec.md) | SPEC-170 — Limpieza del Centro de Control IA (002-PI-068) | 🔵 Planeada |
| [175](175-hotfix-permisos-comite/spec.md) | SPEC-175 — Hotfix I-57: permiso padre del comité de convivencia (002-PI-072) | 🟢 Implementada (ver cierre.md) |
| [176](176-cursos-reactivar/spec.md) | SPEC-176 — Cursos: ver y reactivar desactivados (002-PI-073) | 🟢 Implementada (ver cierre.md) |
| [177](177-estadisticas-comite/spec.md) | SPEC-177 — Estadísticas del comité más útiles (002-PI-074) | 🟢 Implementada (ver cierre.md) |
| [173](173-restructura-nav-colegio/spec.md) | SPEC-173 — Módulo Colegio: restructura nav por rol + fixes H01-H06 (002-PI-071) | 🟢 Implementada (ver cierre.md) |
| [171](171-tablero-operativo/spec.md) | SPEC-171 — Pilar B · Tablero Operativo: 6 semáforos + incidentes (nocturno 2026-08-17) | 🟢 Implementada (ver cierre.md) |
| [172](172-deriva-motor-prod/spec.md) | SPEC-172 — Pilar D.5 · Deriva del motor en producción (nocturno 2026-08-17) | 🟢 Implementada (ver cierre.md) |
| [174](174-aislamiento-tests-strict/spec.md) | SPEC-174 — Aislamiento estricto de tests, fix I-55 (nocturno 2026-08-17) | 🟢 Implementada (ver cierre.md) |
| [178](178-monitor-arranque-prod/spec.md) | SPEC-178 — Hotfix I-58: el monitor de infra arranca en prod (auditoría PR #55) | 🟢 Implementada (ver cierre.md) |
| [179](179-subnav-estadisticas-admin/spec.md) | SPEC-179 — Sub-nav del área Estadísticas del admin (I-59) | 🟢 Implementada (ver cierre.md) |
| [180](180-fixes-visuales-admin/spec.md) | SPEC-180 — Fixes visuales del admin: tabs duplicados, texto invisible, monitoreo redundante, propósito Dataset | 🟢 Implementada (ver cierre.md) |
| [181](181-filtros-bandejas-admin/spec.md) | SPEC-181 — Filtros, búsqueda y orden en las bandejas del admin | 🟢 Implementada (ver cierre.md) |
| [182](182-reconciliacion-huerfanos/spec.md) | SPEC-182 — Reconciliación de reportes huérfanos (I-60) | 🟢 Implementada (ver cierre.md) |
| [183](183-zeus-readonly-tailscale/spec.md) | SPEC-183 — Acceso lectura ZEUS a BD prod por Tailscale (002-PI-078) | 🟢 Implementada (ver cierre.md) |
| [184](184-anti-abuso-operativo-simulador/spec.md) | SPEC-184 — Anti-abuso operativo + simulador de abusos (002-PI-079) | 🟢 Finalizada (ver cierre.md) |
| [185](185-simulador-historial/spec.md) | SPEC-185 — Historial y sugerencias del simulador de abusos (002-PI-080) | 🟢 Implementada (ver cierre.md) |
| [186](186-smoke-inteligente-ollama/spec.md) | SPEC-186 — Smoke inteligente del monitor Ollama (002-PI-081) | 🟢 Implementada (ver cierre.md) |
| [187](187-override-modelo-smoke-ollama/spec.md) | SPEC-187 — Override de modelo para smoke Ollama (002-PI-082) | 🟢 Implementada (ver cierre.md) |
| [188](188-visibilidad-operador-bandeja/spec.md) | SPEC-188 — Visibilidad del operador en la bandeja (002-PI-083) | 🟢 Implementada (ver cierre.md) |
| [189](189-vista-operador-metricas/spec.md) | SPEC-189 — Vista de operador con métricas (002-PI-084) | 🟢 Implementada |
| [193](193-panel-logs-mantenimiento-reasignar/spec.md) | SPEC-193 — Panel de Logs + Mantenimiento + Reasignar Operador (002-PI-087) | 🔵 Planeada |
| [190](190-deploy-seed-idempotente/spec.md) | SPEC-190 — Deploy ejecuta seed idempotente (002-PI-085) | 🟢 Implementada (ver cierre.md) |
| [192](192-ux-simulador-anti-abuso/spec.md) | SPEC-192 — UX del simulador anti-abuso (002-PI-086) | 🟢 Implementada (ver cierre.md) |
| [195](195-motor-spam-aprendizaje-operativo/spec.md) | SPEC-195 — Motor SPAM + Aprendizaje operativo (002-PI-089) | 🔵 Planeado |
| [196](196-parche-ui-anti-abuso/spec.md) | SPEC-196 — Parche UI Anti-abuso (002-PI-090) | 🟢 Implementada |
| [194](194-analitica-colegios/spec.md) | SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT (002-PI-088) | 🟢 Implementada |
| [206](206-infra-session-log/spec.md) | SPEC-206 — Infra: session log (002-PI-120) | 🟢 Implementado |
| [207](207-parche-motor-spam-dominancia/spec.md) | SPEC-207 — Parche motor SPAM dominancia (002-PI-140) | 🔵 Planeado |
| [208](208-fechacorta-central/spec.md) | SPEC-208 — fechaCorta helper central (002-PI-141) | 🔵 Planeado |
| [209](209-log-modal-contraste/spec.md) | SPEC-209 — LogContextoModal contraste (002-PI-142) | 🔵 Planeado |
| [212](212-panel-admin-pagos/spec.md) | SPEC-212 — Panel admin de pagos (002-PI-112) | 🟢 Implementado |
| [214](214-multi-moneda-pagos/spec.md) | SPEC-214 — Multi-moneda pagos (002-PI-113) | 🟢 Implementado |
| [230](230-padre-v2-modelos-expediente-evento/spec.md) | SPEC-230 — Padre v2: modelos Expediente y EventoExpediente (002-PI-130) | 🟢 Implementado |
| [231](231-sidebar-padre-rutas-base/spec.md) | SPEC-231 — Sidebar padre + rutas base (002-PI-131) | 🔵 Planeado |
| [232](232-vista-padre-expedientes/spec.md) | SPEC-232 — Vista padre expedientes (lista + detalle + agregar evento) (002-PI-132) | 🔵 Planeado |
| [234](234-padre-v2-compilacion-tecnica-senal-patrones-kit-evidencia/spec.md) | SPEC-234 — Padre v2: compilación técnica + señal + patrones + kit evidencia (002-PI-134) | 🟢 Implementado |
| [205](205-usuarios-vista-consolidada/spec.md) | SPEC-205 — Usuarios · Vista consolidada por rol (002-PI-102) | 🟢 Implementado |
| [235](235-guias-accion-parametrizables/spec.md) | SPEC-235 — Guías de acción parametrizables | 🟢 Implementado |
| [200](200-infra-timezone-bogota/spec.md) | SPEC-200 — INFRA · Timezone Bogotá (002-PI-097) | 🔵 Planeado |
| [201](201-motor-notificaciones-nucleo/spec.md) | SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098) | 🔵 Planeado |
| [202](202-panel-admin-motor-notificaciones/spec.md) | SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099) | 🟢 Implementado |
| [203](203-preferencias-notificaciones-usuario/spec.md) | SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100) | 🔵 Planeado |
| [204](204-piloto-bienvenida-colegio/spec.md) | SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101) | 🔵 Planeado |
| [211](211-vistas-cliente-pagos/spec.md) | SPEC-211 — Vistas cliente pagos Rector + Padre (002-PI-111) | 🔵 Planeado |
| [213](213-motor-vigencia-pagos/spec.md) | SPEC-213 — Motor vigencia + estados pagos (002-PI-113) | 🔵 Planeado |
| [215](215-referidos-pagos/spec.md) | SPEC-215 — Código de referido (002-PI-115) | 🔵 Planeado |
| [217](217-freemium-pagos/spec.md) | SPEC-217 — Freemium 30 días (002-PI-117) | 🔵 Planeado |
| [218](218-analitica-dinero-vs-valor-pagos/spec.md) | SPEC-218 — Analítica dinero-vs-valor pagos (002-PI-118) | 🔵 Planeado |
| [220](220-modelo-analisis-score/spec.md) | SPEC-220 — Modelo Análisis + score de valor de cliente (002-PI-121) | 🔵 Planeado |
| [221](221-motor-reglas-recomendacion/spec.md) | SPEC-221 — Motor de reglas de recomendación (002-PI-122) | 🔵 Planeado |
| [222](222-panel-principal-analisis/spec.md) | SPEC-222 — Panel principal Análisis Dinero vs Valor (002-PI-123) | 🔵 Planeado |
| [223](223-digest-semanal/spec.md) | SPEC-223 — Digest semanal al CEO (002-PI-124) | 🔵 Planeado |
| [224](224-panel-reglas-configurables/spec.md) | SPEC-224 — Panel de reglas configurables (002-PI-125) | 🔵 Planeado |
| [225](225-deteccion-anomalias/spec.md) | SPEC-225 — Detección de anomalías dinero-vs-valor (002-PI-126) | 🔵 Planeado |
| [226](226-ejecucion-acciones-automaticas/spec.md) | SPEC-226 — Ejecución de acciones automáticas reglas EJECUTA (002-PI-127) | 🔵 Planeado |
| [227](227-historial-recomendaciones/spec.md) | SPEC-227 — Historial de recomendaciones y métricas de tuning (002-PI-128) | 🔵 Planeado |
| [233](233-busqueda-por-identificador/spec.md) | SPEC-233 — Vista búsqueda por identificador padre + admin (002-PI-133) | 🔵 Planeado |
| [236](236-motor-estados-worker-eventos/spec.md) | SPEC-236 · Motor de estados + worker + eventos Motor Notif (002-PI-136) | 🔵 Planeado |
| [237](237-bandeja-comite-consolidacion/spec.md) | SPEC-237 · Bandeja comité CONSOLIDACION + aprobación multi-miembro (002-PI-137) | 🔵 Planeado |
| [238](238-aclaracion-padre-comite/spec.md) | SPEC-238 · Aclaración padre-comité (002-PI-138) | 🔵 Planeado |
| [239](239-escalacion-rojo-contacto-emergencia/spec.md) | SPEC-239 · Escalación ROJO + SLA 12h + Contacto emergencia (002-PI-139) | 🔵 Planeado |
| [240](240-registro-colegio-activar/spec.md) | SPEC-240 · Registro público colegio + /activar + fix BUG-01 (002-PI-143) | 🔵 Planeado |
| [242](242-middleware-vigencia/spec.md) | SPEC-242 · Middleware de vigencia + guardas por layout + banner ámbar EN_GRACIA (002-PI-145) | 🟢 Implementado |
| [248](248-categorias-ley-2564/spec.md) | SPEC-248 · Categorías Ley 2564 completas + Definiciones legales editables (002-PI-151) | 🟡 Pendiente de prueba |

## Tabla completa (217 specs)

| Nº | Nombre | Estado |
|----|--------|--------|
| [001](001-multi-role-auth-config/spec.md) | Autenticación Multi-Rol y Parámetros de Configuración | 🟢 Cerrada |
| [003](003-frontend-publico/spec.md) | 003-frontend-publico | 🟢 Cerrada |
| [004](004-panel-admin/spec.md) | Panel de Administración | 🟢 Cerrada |
| [005](005-password-reset/spec.md) | Restablecimiento de Contraseña | 🟢 Cerrada |
| [006](006-paginas-legales/spec.md) | Páginas Legales y Footer | 🟢 Finalizada (pendiente ACTA) |
| [007](007-alertas-email/spec.md) | Alertas por Email | 🟢 Finalizada (pendiente ACTA) |
| [008](008-seo/spec.md) | SEO y Metadatos | 🟢 Cerrada |
| [009](009-dashboard-publico/spec.md) | Dashboard Público | 🟢 Cerrada |
| [010](010-rediseño-clasificador-ia/spec.md) | Rediseño del Clasificador IA | 🟢 Cerrada |
| [011](011-centro-control-ia/spec.md) | Spec 011 — Centro de Control IA | 🟢 Cerrada |
| [012](012-baja-reportes/spec.md) | Spec 012 — Baja/Desactivación de reportes | 🟢 Cerrada |
| [013](013-admin-motor-ia/spec.md) | Spec 013 — Administración del Motor IA desde el Panel | 🟢 Cerrada |
| [014](014-laboratorio-ia/spec.md) | Spec 014 — Laboratorio de Experimentos IA | 🟢 Cerrada |
| [015](015-anti-abuso/spec.md) | Spec 015 — Defensas anti-abuso | 🟢 Cerrada |
| [016](016-circulo-confianza/spec.md) | Spec 016 — Círculo de Confianza | 🟢 Cerrada |
| [017](017-documentacion/spec.md) | Spec 017 — Módulo de documentación navegable | 🟢 Implementada (2026-07-30, cola nocturna 002-PI-046) |
| [018](018-operadores-casos/spec.md) | Spec 018 — Operadores de casos (revisión humana) | 🟢 Cerrada |
| [019](019-permisos-modulos/spec.md) | Spec 019 — Gestor de permisos de módulos por ROL | 🟢 Finalizada (pendiente ACTA) |
| [02](02-reportes-comunitarios/spec.md) | Módulo de Reportes Comunitarios | 🟢 Cerrada |
| [020](020-reorganizacion-monitoreo/spec.md) | Spec 020 — Reorganización de módulos + Tablero de monitoreo | 🟢 Cerrada |
| [021](021-reporte-anonimo-interno/spec.md) | Spec 021 — Reporte anónimo con sesión interna abierta | 🟢 Cerrada |
| [022](022-expediente-transiciones/spec.md) | Spec 022 — Expediente interno de transiciones | 🟢 Cerrada |
| [023](023-estados-usuario-sla/spec.md) | Spec 023 — Estados de cara al usuario + SLA visible | 🟢 Cerrada |
| [024](024-comite-validacion/spec.md) | Spec 024 — Rol Comité de Validación + gestión de cuenta e integrantes | 🟢 Cerrada |
| [025](025-anonimizacion-reforzada/spec.md) | Spec 025 — Anonimización reforzada + encriptación del original | 🟢 Cerrada |
| [026](026-pipeline-spam-prioridad/spec.md) | Spec 026 — Pipeline de spam | 🟢 Cerrada |
| [027](027-motor-encolamiento/spec.md) | 027-motor-encolamiento | 🟢 Cerrada |
| [028](028-redisenio-home/spec.md) | Rediseño completo del Home (Landing) | 🟢 Cerrada |
| [029](029-redisenio-consulta-panel-usuario/spec.md) | Feature Specification 029 · Rediseño de la consulta pública + panel del usuar | 🟢 Cerrada |
| [030](030-circulo-confianza-multiples-identificadores/spec.md) | Spec 030 — Rediseño del Círculo de Confianza: contacto = persona con múltip | 🟢 Cerrada |
| [031](031-mejoras-ui-agrupacion-categorias/spec.md) | Spec 031 — Mejoras de UI: agrupación de categorías, terminología, círculo  | 🟢 Cerrada |
| [033](033-correcciones-vistas-roles/spec.md) | Correcciones de vistas y roles | 🟢 Cerrada |
| [034](034-config-guardado-mapa-comite/spec.md) | Configuración, guardado y mapa del Comité | 🟢 Cerrada |
| [035](035-correcciones-034-blindaje-critico/spec.md) | Correcciones del 034 + blindaje crítico | 🟢 Cerrada |
| [036](036-consistencia-limpieza/spec.md) | Consistencia y limpieza | 🟢 Cerrada |
| [037](037-seguridad-limpieza/spec.md) | Fixes de seguridad y limpieza | 🟢 Cerrada |
| [038](038-auditoria-operadores-comite/spec.md) | Auditoría de Operadores y Comité | 🟢 Cerrada |
| [039](039-middleware-perimetral-real/spec.md) | Middleware perimetral real | 🟢 Cerrada |
| [040](040-aislamiento-comite-bandeja/spec.md) | Aislamiento del comité a su Bandeja | 🟢 Cerrada |
| [041](041-cierre-blindaje-saneamiento/spec.md) | Cierre de blindaje + saneamiento | 🟢 Cerrada |
| [042](042-operador-corrije-clasificacion/spec.md) | Operador corrige la clasificación | 🟢 Cerrada |
| [043](043-ux-comite-nav-padre/spec.md) | UX del comité y navegación del padre | 🟢 Cerrada |
| [044](044-disciplina-spec-kit/spec.md) | Disciplina y reconciliación Spec-Kit | 🟢 Cerrada |
| [045](045-seguridad-fase-1/spec.md) | Seguridad Fase 1 — Saneamiento de Auth | 🟢 Cerrada |
| [046](046-endurecimiento-seguridad/spec.md) | Endurecimiento de Seguridad (Spec 046) | 🟢 Cerrada |
| [047](047-tests-rol-arquitectura/spec.md) | Tests de rol + documentación de arquitectura | 🟢 Cerrada |
| [048](048-validacion-uniforme/spec.md) | Validación uniforme (zod) | 🟢 Cerrada |
| [049](049-accesibilidad-wcag/spec.md) | Accesibilidad (WCAG 2.2) | 🟢 Cerrada |
| [050](050-mejora-prompt-clasificador/spec.md) | Mejora del prompt del clasificador (Spec 050) | 🟢 Cerrada |
| [051](051-claridad-estados/spec.md) | Claridad y estados | 🟢 Cerrada |
| [052](052-dividir-archivos-grandes/spec.md) | Dividir archivos grandes | 🟢 Cerrada |
| [053](053-capa-datos-servicios/spec.md) | Capa de datos / servicios (DAL) | 🟢 Implementada |
| [054](054-correccion-049-051-accesibilidad-ui/spec.md) | Corrección post-cierre 049 y 051 — Accesibilidad y UI | 🟢 Cerrada |
| [070](070-simulacion-carga-modelos/spec.md) | Simulación de carga y comparación de modelos (Spec 070) | 🟢 Cerrada |
| [071](071-correccion-fidelidad-simulacion-070/spec.md) | Corrección de fidelidad de la simulación (Spec 071) | 🟢 Cerrada |
| [072](072-simulacion-ver-detalle-reporte/spec.md) | Simulación — Ver detalle del reporte (Spec 072) | 🟢 Cerrada |
| [073](073-ubicacion-departamentos/spec.md) | Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spe | 🟢 Cerrada |
| [074](074-colegios-fundacion/spec.md) | Módulo Colegios — Fase 1: Fundación (Colegio + creación por admin + login i | 🟢 Cerrada |
| [075](075-colegios-cursos-alumnos/spec.md) | Colegios · Fase 2 — Cursos, Alumnos e Identificadores | 🟢 Cerrada |
| [076](076-colegios-carga-excel/spec.md) | Colegios · Fase 3 — Carga masiva por Excel/CSV | 🟢 Cerrada |
| [077](077-colegios-alertas-consulta/spec.md) | Colegios · Fase 4 — Alertas y Consulta anonimizada | 🟢 Cerrada |
| [078](078-colegios-estadisticas-pdf/spec.md) | Colegios · Fase 5 — Estadísticas e informe PDF institucional | 🟢 Cerrada |
| [079](079-colegio-acceso-auditoria/spec.md) | Spec 079 — Módulo Colegios: acceso institucional y auditoría del colegio | 🟢 Cerrada |
| [080](080-orden-migraciones-colegio/spec.md) | Spec 080 — Corrección del orden de migraciones (incidencia I-04) | 🟢 Cerrada |
| [082](082-fusion-playground-modelos/spec.md) | Spec 082 — Fusión de tabs "Playground" + "Modelos" en admin/ia (y corrección | 🟢 Cerrada |
| [083](083-simulacion-completitud-multimodelo/spec.md) | Spec 083 — Simulación: completitud/métricas + selección multi-modelo (I-06) | 🟢 Cerrada |
| [084](084-fix-timeout-multimodelo/spec.md) | Spec 084 — Fix timeout multi-modelo de simulación (I-07) | 🟢 Cerrada |
| [085](085-evaluacion-error-silencioso/spec.md) | Spec 085 — Evaluación por error silencioso y modelo por defecto | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [086](086-navegacion-gobernada-permisos/spec.md) | Spec 086 — Navegación y páginas gobernadas por permisos | 🟢 Finalizada (pendiente validación funcional del CEO + ACTA-VALIDACION de ZEUS → |
| [087](087-saneamiento-speckit-fase2/spec.md) | Spec 087 — Saneamiento Spec Kit, fase 2 | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [088](088-pendientes-afinamiento/spec.md) | Spec 088 — Pendientes de afinamiento (registro vivo) | 🔵 Planeado |
| [089](089-presentacion-usuario/spec.md) | Spec 089 — Presentación al usuario: estados, categorías y consulta pública | 🟢 Finalizada (pendiente validación del CEO + ACTA-VALIDACION de ZEUS → CERRADA) |
| [090](090-clasificacion-rubrica-multimodelo/spec.md) | Spec 090 — Clasificación por rúbrica multi-etiqueta + multi-modelo + "Mis re | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA; validación banco 200  |
| [091](091-ux-privacidad-consulta-seguimiento/spec.md) | Spec 091 — UX y privacidad de la consulta + seguimiento | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [092](092-motor-logica-corregida/spec.md) | Spec 092 — Motor: lógica corregida y validada | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [093](093-coherencia-padre/spec.md) | Spec 093 — Coherencia del padre autenticado | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [094](094-deuda-tecnica-documentacion/spec.md) | Spec 094 — Deuda técnica y documentación | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [095](095-default-seguro-jwt-banco/spec.md) | Spec 095 — Default seguro, JWT parametrizado y banco gobernado | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS → CERRADA) |
| [096](096-expediente-reporte/spec.md) | Spec 096 — Expediente del reporte: traza del modelo (rol Admin) | 🟢 Finalizada (pendiente ACTA-VALIDACION de ZEUS) |
| [097](097-despliegue-hibrido-produccion/spec.md) | Despliegue híbrido a producción (VPS + cerebro en la Mac) | 🟢 Finalizada (pendiente ACTA) |
| [098](098-afinamiento-motor/spec.md) | Afinamiento del motor (rúbrica) — targeting, principal por gravedad y métric | 🟢 Finalizada (pendiente ACTA) |
| [099](099-rotacion-claves-i22/spec.md) | Rotación de claves filtradas + regla no-secretos (I-22) | 🟢 Finalizada (pendiente ACTA) |
| [100](100-correcciones-colegios/spec.md) | Correcciones módulo Colegios (+ Comité) | 🟢 Finalizada (pendiente ACTA) |
| [101](101-app-publica-entorno/spec.md) | App pública y entorno (I-23 / I-24 / A-2) | 🟢 Finalizada (pendiente ACTA) |
| [102](102-sello-version/spec.md) | Sello de versión (dev y prod) | 🟢 Finalizada (pendiente ACTA) |
| [103](103-fix-fuga-pii-seguimiento/spec.md) | Fix fuga de PII en seguimiento público (I-28, Crítica) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [104](104-motor-indices-rubrica/spec.md) | Motor de rúbrica — votación por índices (adiós al match verbatim) | 🟢 Finalizada (implementada; medición de reproducibilidad = B5 de la cola 002-PI-02 |
| [105](105-seed-admin-seguro/spec.md) | Seed del admin inicial sin credencial literal (I-31) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [106](106-logout-cookie-secure/spec.md) | Cerrar sesión de verdad (cookie `__Host-` y enrutado público del logo) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [107](107-gate-antirrecaidas/spec.md) | SPEC-107 — El gate que evita recaídas | 🟢 Finalizada |
| [108](108-higiene-seguridad-ux/spec.md) | SPEC-108 — Higiene de seguridad y UX | 🟢 Finalizada |
| [109](109-eliminar-modulo-apelacion/spec.md) | SPEC-109 — Eliminar el módulo de apelación actual (D-34) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [110](110-apelacion-identificador/spec.md) | Spec 110 — Apelación del identificador reportado | 🟢 Implementada |
| [111](111-motor-rubrica-default/spec.md) | SPEC-111 — D-28: el motor de rúbrica pasa a ser el predeterminado | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [113](113-colegio-atrapado-menu-rol/spec.md) | SPEC-113 — El colegio atrapado (I-35/I-35b) y menú por rol (I-36) | 🟢 Finalizada (SIN desplegar, pendiente release + ACTA) |
| [114](114-suite-e2e-por-rol/spec.md) | SPEC-114 — Suite E2E por rol y estabilización por ciclos | 🟢 Finalizada (6 ciclos verdes; ver cierre.md y docs/ciclos-estabilizacion-114.md) |
| [115](115-catalogo-geografico-latam/spec.md) | Catálogo geográfico real LATAM y Centroamérica (SPEC-115, bloque B1 cola 002- | 🟢 Implementada (sin push ni despliegue; verificación quickstart pendiente del deploy |
| [116](116-vista-padre-sin-tecnico/spec.md) | Vista del padre sin traza técnica del motor | 🟢 Finalizada (SIN push ni desplegar; release lo gatea ZEUS) |
| [117](117-gestion-padres-admin/spec.md) | Gestión de credenciales de padres desde admin (I-37) | 🟢 Implementada (SIN push ni deploy; el coordinador de la cola empuja en serie y ZEUS  |
| [118](118-clics-muertos-colegio/spec.md) | Clics muertos del colegio (D-37) | 🟢 Implementada (SIN desplegar — commit sin push; el coordinador de la cola 002-PI-0 |
| [119](119-vigencia-servicio-cliente/spec.md) | Vigencia del servicio por cliente (padres y colegios) | 🟢 Implementada (SIN push ni deploy; el coordinador de la cola empuja en serie y ZEUS  |
| [120](120-smoke-prod-safe/spec.md) | SPEC-120 — Smoke prod-safe por rol | 🟢 Finalizada (ver cierre.md) |
| [121](121-error-wrapper-ollama-timeout/spec.md) | SPEC-121 — Sobre de error único (R2) + timeout de Ollama | 🟢 Finalizada (ver cierre.md) |
| [122](122-capa-datos-reportes/spec.md) | SPEC-122 — Capa de datos: predicados centrales de acceso a reportes | 🟢 Finalizada |
| [123](123-motor-tipos-muerto-guardas/spec.md) | Spec 123 — Motor: tipos desde Prisma, código muerto y guardas unificadas | 🟢 Finalizada |
| [124](124-primitivas-ui-compartidas/spec.md) | SPEC-124 — Primitivas UI compartidas (R7) | 🟢 Finalizada (ver cierre.md) |
| [125](125-validacion-unificada-api/spec.md) | SPEC-125 — API: una sola forma de validar | 🟢 Implementada |
| [126](126-linea-base-arquitectura/spec.md) | SPEC-126 — Línea base de arquitectura generada desde el código | 🟢 Implementada |
| [127](127-home-padre/spec.md) | SPEC-127 — Home del padre (PARENT → /dashboard) | 🟢 Implementada |
| [128](128-reconciliacion-grants-comite/spec.md) | SPEC-128 — Reconciliación de grants del comité | 🟢 Implementada |
| [129](129-rediseno-ux-colegio/spec.md) | SPEC-129 — Rediseño de UX del panel del colegio (002-PI-051B) | 🟢 Implementada |
| [130](130-cifrado-reposo-texto-reporte/spec.md) | SPEC-130 — Cifrado en reposo del texto del reporte (BL-4) | 🟢 Implementada (migración de datos en prod pendiente de BL-2) |
| [131](131-visibilidad-solo-aprobados/spec.md) | SPEC-131 — Visibilidad pública solo por reportes aprobados (BL-5) | 🟢 Implementada |
| [132](132-seguridad-carga-colegio/spec.md) | SPEC-132 — Seguridad de la carga masiva del colegio (S-3 exceljs + S-4 roster server-side) | 🟢 Implementada |
| [133](133-journeys-e2e-gate-cobertura-roles/spec.md) | SPEC-133 — Journeys E2E por rol: gate de merge + cobertura completa (Q-1) | 🟢 Implementada |
| [134](134-dal-colegio-tenant-obligatorio/spec.md) | SPEC-134 — DAL del módulo colegio con tenant obligatorio (E-1) | 🟢 Implementada |
| [135](135-circulo-confianza-god-module-n1/spec.md) | SPEC-135 — circulo-confianza: romper god-module + matar N+1 (E-2) | 🟢 Implementada |
| [136](136-tipado-estricto-casts-guards-tsconfig/spec.md) | SPEC-136 — Tipado estricto: casts, guards y tsconfig maximal viable (E-3) | 🟢 Implementada |
| [137](137-creacion-reporte-atomica/spec.md) | SPEC-137 — Creación de reporte atómica (E-5) | 🟢 Implementada |
| [138](138-eval-sandbox-rubrica-posible-agresor-par/spec.md) | SPEC-138 — Eval/sandbox alineados con la rúbrica + posibleAgresorPar (E-7) | 🟢 Implementada |
| [139](139-evento-match/spec.md) | SPEC-139 — Métrica del match: segundo reporte independiente (F5) | 🟢 Implementada |
| [140](140-denuncia-formal/spec.md) | SPEC-140 — Denuncia formal: PDF determinista + panel forense (F2+N-4) | 🟢 Implementada |
| [141](141-admin-solo-lectura-padres-colegios/spec.md) | SPEC-141 — Admin solo lectura: círculo de padres + cursos/alumnos (N-1) | 🟢 Implementada |
| [142](142-patrones-institucionales/spec.md) | SPEC-142 — Patrones institucionales con k-anonimato k=3 (F6) | 🟢 Implementada |
| [143](143-home-rector/spec.md) | SPEC-143 — Home operativo del rector (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [144](144-modelo-estudiante/spec.md) | SPEC-144 — Modelo Estudiante expandido (rename desde Alumno) (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [145](145-modelo-profesor/spec.md) | SPEC-145 — Modelo Profesor mínimo (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [146](146-wizard-curso-unificado/spec.md) | SPEC-146 — Wizard unificado curso + estudiantes + identificadores (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [147](147-vista-curso/spec.md) | SPEC-147 — Vista de curso: escritorio con acudientes clicables (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [148](148-profesores-buscador/spec.md) | SPEC-148 — Profesores + buscador global ⌘K (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [149](149-avisos-email/spec.md) | SPEC-149 — Avisos por email configurables del colegio (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [150](150-observacion-especial/spec.md) | SPEC-150 — Observación especial de estudiantes (002-PI-058) | 🟢 Implementada (002-PI-058; ver cierre.md) |
| [151](151-informe-pdf-mensual/spec.md) | SPEC-151 — Informe PDF mensual determinístico (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [152](152-duplicar-curso/spec.md) | SPEC-152 — Duplicar curso al año siguiente (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [153](153-comparativa-cursos/spec.md) | SPEC-153 — Comparativa entre cursos (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [154](154-confianza-transparencia/spec.md) | SPEC-154 — Confianza: transparencia, protocolo e historial (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [155](155-timeline-ver-proceso/spec.md) | SPEC-155 — Timeline "Ver proceso" para ADMIN (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [156](156-panel-monitoreo-worker/spec.md) | SPEC-156 — Panel de monitoreo del worker para ADMIN (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [159](159-seguimiento-caso/spec.md) | SPEC-159 — Seguimiento del caso con bitácora: línea de tiempo, pendientes y notas inmutables (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [158](158-tablero-colegio/spec.md) | SPEC-158 — Tablero de control del colegio: embudo, reloj 24h, ritmo y barras (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [157](157-sistema-diseno/spec.md) | SPEC-157 — Sistema de diseño de Protección Infantil: tokens, tipografía y primitivos (002-PI-058) | 🟢 Implementada (ver cierre.md) |
| [160](160-dataset-demo-produccion/spec.md) | SPEC-160 — Dataset demo de producción (002-PI-059) | 🔵 Planeada |
| [162](162-materia-configurable/spec.md) | SPEC-162 — Materia configurable en cursos (002-PI-061) | 🟢 Implementada |
| [163](163-acudiente-completo/spec.md) | SPEC-163 — Acudiente completo: identificadores + edición post-alta (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [164](164-identificadores-profesor/spec.md) | SPEC-164 — Identificadores de profesor + estadísticas (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [165](165-alertas-extendidas/spec.md) | SPEC-165 — Alertas extendidas: profesor/acudiente (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [166](166-alertas-nivel-dios/spec.md) | SPEC-166 — Alertas nivel dios: bandeja de prioridad (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [167](167-rediseno-3-a-2/spec.md) | SPEC-167 — Rediseño 3→2: Inicio + Estadísticas (002-PI-062) | 🟢 Implementada |
| [168](168-comite-convivencia/spec.md) | SPEC-168 — Comité de Convivencia por colegio (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [169](169-onboarding-cobertura/spec.md) | SPEC-169 — Onboarding + cobertura + notificaciones in-app (002-PI-062) | 🟢 Implementada (ver cierre.md) |
| [170](170-limpieza-centro-control-ia/spec.md) | SPEC-170 — Limpieza del Centro de Control IA (002-PI-068) | 🔵 Planeada |
| [175](175-hotfix-permisos-comite/spec.md) | SPEC-175 — Hotfix I-57: permiso padre del comité de convivencia (002-PI-072) | 🟢 Implementada (ver cierre.md) |
| [176](176-cursos-reactivar/spec.md) | SPEC-176 — Cursos: ver y reactivar desactivados (002-PI-073) | 🟢 Implementada (ver cierre.md) |
| [177](177-estadisticas-comite/spec.md) | SPEC-177 — Estadísticas del comité más útiles (002-PI-074) | 🟢 Implementada (ver cierre.md) |
| [173](173-restructura-nav-colegio/spec.md) | SPEC-173 — Módulo Colegio: restructura nav por rol + fixes H01-H06 (002-PI-071) | 🟢 Implementada (ver cierre.md) |
| [171](171-tablero-operativo/spec.md) | SPEC-171 — Pilar B · Tablero Operativo: 6 semáforos + incidentes (nocturno 2026-08-17) | 🟢 Implementada (ver cierre.md) |
| [172](172-deriva-motor-prod/spec.md) | SPEC-172 — Pilar D.5 · Deriva del motor en producción (nocturno 2026-08-17) | 🟢 Implementada (ver cierre.md) |
| [174](174-aislamiento-tests-strict/spec.md) | SPEC-174 — Aislamiento estricto de tests, fix I-55 (nocturno 2026-08-17) | 🟢 Implementada (ver cierre.md) |
| [178](178-monitor-arranque-prod/spec.md) | SPEC-178 — Hotfix I-58: el monitor de infra arranca en prod (auditoría PR #55) | 🟢 Implementada (ver cierre.md) |
| [179](179-subnav-estadisticas-admin/spec.md) | SPEC-179 — Sub-nav del área Estadísticas del admin (I-59) | 🟢 Implementada (ver cierre.md) |
| [180](180-fixes-visuales-admin/spec.md) | SPEC-180 — Fixes visuales del admin: tabs duplicados, texto invisible, monitoreo redundante, propósito Dataset | 🟢 Implementada (ver cierre.md) |
| [181](181-filtros-bandejas-admin/spec.md) | SPEC-181 — Filtros, búsqueda y orden en las bandejas del admin | 🟢 Implementada (ver cierre.md) |
| [182](182-reconciliacion-huerfanos/spec.md) | SPEC-182 — Reconciliación de reportes huérfanos (I-60) | 🟢 Implementada (ver cierre.md) |
| [183](183-zeus-readonly-tailscale/spec.md) | SPEC-183 — Acceso lectura ZEUS a BD prod por Tailscale (002-PI-078) | 🟢 Implementada (ver cierre.md) |
| [184](184-anti-abuso-operativo-simulador/spec.md) | SPEC-184 — Anti-abuso operativo + simulador de abusos (002-PI-079) | 🟢 Finalizada (ver cierre.md) |
| [185](185-simulador-historial/spec.md) | SPEC-185 — Historial y sugerencias del simulador de abusos (002-PI-080) | 🟢 Implementada (ver cierre.md) |
| [186](186-smoke-inteligente-ollama/spec.md) | SPEC-186 — Smoke inteligente del monitor Ollama (002-PI-081) | 🟢 Implementada (ver cierre.md) |
| [187](187-override-modelo-smoke-ollama/spec.md) | SPEC-187 — Override de modelo para smoke Ollama (002-PI-082) | 🟢 Implementada (ver cierre.md) |
| [188](188-visibilidad-operador-bandeja/spec.md) | SPEC-188 — Visibilidad del operador en la bandeja (002-PI-083) | 🟢 Implementada (ver cierre.md) |
| [189](189-vista-operador-metricas/spec.md) | SPEC-189 — Vista de operador con métricas (002-PI-084) | 🟢 Implementada |
| [193](193-panel-logs-mantenimiento-reasignar/spec.md) | SPEC-193 — Panel de Logs + Mantenimiento + Reasignar Operador (002-PI-087) | 🔵 Planeada |
| [190](190-deploy-seed-idempotente/spec.md) | SPEC-190 — Deploy ejecuta seed idempotente (002-PI-085) | 🟢 Implementada (ver cierre.md) |
| [192](192-ux-simulador-anti-abuso/spec.md) | SPEC-192 — UX del simulador anti-abuso (002-PI-086) | 🟢 Implementada (ver cierre.md) |
| [195](195-motor-spam-aprendizaje-operativo/spec.md) | SPEC-195 — Motor SPAM + Aprendizaje operativo (002-PI-089) | 🔵 Planeado |
| [196](196-parche-ui-anti-abuso/spec.md) | SPEC-196 — Parche UI Anti-abuso (002-PI-090) | 🟢 Implementada |
| [194](194-analitica-colegios/spec.md) | SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT (002-PI-088) | 🟢 Implementada |
| [197](197-fixes-operadores-usuarios/spec.md) | SPEC-197 — Fixes operadores + usuarios (002-PI-094) | 🟢 Implementada |
| [199](199-parche-motor-spam/spec.md) | SPEC-199 — Parche motor SPAM (002-PI-093) | 🔵 Planeado |
| [206](206-infra-session-log/spec.md) | SPEC-206 — Infra: session log (002-PI-120) | 🟢 Implementado |
| [207](207-parche-motor-spam-dominancia/spec.md) | SPEC-207 — Parche motor SPAM dominancia (002-PI-140) | 🔵 Planeado |
| [208](208-fechacorta-central/spec.md) | SPEC-208 — fechaCorta helper central (002-PI-141) | 🔵 Planeado |
| [209](209-log-modal-contraste/spec.md) | SPEC-209 — LogContextoModal contraste (002-PI-142) | 🔵 Planeado |
| [212](212-panel-admin-pagos/spec.md) | SPEC-212 — Panel admin de pagos (002-PI-112) | 🟢 Implementado |
| [214](214-multi-moneda-pagos/spec.md) | SPEC-214 — Multi-moneda pagos (002-PI-113) | 🟢 Implementado |
| [230](230-padre-v2-modelos-expediente-evento/spec.md) | SPEC-230 — Padre v2: modelos Expediente y EventoExpediente (002-PI-130) | 🟢 Implementado |
| [231](231-sidebar-padre-rutas-base/spec.md) | SPEC-231 — Sidebar padre + rutas base (002-PI-131) | 🔵 Planeado |
| [232](232-vista-padre-expedientes/spec.md) | SPEC-232 — Vista padre expedientes (lista + detalle + agregar evento) (002-PI-132) | 🔵 Planeado |
| [234](234-padre-v2-compilacion-tecnica-senal-patrones-kit-evidencia/spec.md) | SPEC-234 — Padre v2: compilación técnica + señal + patrones + kit evidencia (002-PI-134) | 🟢 Implementado |
| [205](205-usuarios-vista-consolidada/spec.md) | SPEC-205 — Usuarios · Vista consolidada por rol (002-PI-102) | 🟢 Implementado |
| [210](210-modelos-base-pagos/spec.md) | SPEC-210 · Modelos base Pagos (002-PI-110) | 🔵 Planeado |
| [235](235-guias-accion-parametrizables/spec.md) | SPEC-235 · Guías de acción parametrizables (002-PI-135) | 🟢 Implementado |
| [236](236-motor-estados-worker-eventos/spec.md) | SPEC-236 · Motor de estados + worker + eventos Motor Notif (002-PI-136) | 🔵 Planeado |
| [237](237-bandeja-comite-consolidacion/spec.md) | SPEC-237 · Bandeja comité CONSOLIDACION + aprobación multi-miembro (002-PI-137) | 🔵 Planeado |
| [238](238-aclaracion-padre-comite/spec.md) | SPEC-238 · Aclaración padre-comité (002-PI-138) | 🔵 Planeado |
| [239](239-escalacion-rojo-contacto-emergencia/spec.md) | SPEC-239 · Escalación ROJO + SLA 12h + Contacto emergencia (002-PI-139) | 🔵 Planeado |
| [240](240-registro-colegio-activar/spec.md) | SPEC-240 · Registro público colegio + /activar + fix BUG-01 (002-PI-143) | 🔵 Planeado |
| [242](242-middleware-vigencia/spec.md) | SPEC-242 · Middleware de vigencia + guardas por layout + banner ámbar EN_GRACIA (002-PI-145) | 🟢 Implementado |
| [248](248-categorias-ley-2564/spec.md) | SPEC-248 · Categorías Ley 2564 completas + Definiciones legales editables (002-PI-151) | 🟡 Pendiente de prueba |
| [200](200-infra-timezone-bogota/spec.md) | SPEC-200 — INFRA · Timezone Bogotá (002-PI-097) | 🔵 Planeado |
| [201](201-motor-notificaciones-nucleo/spec.md) | SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098) | 🔵 Planeado |
| [202](202-panel-admin-motor-notificaciones/spec.md) | SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099) | 🟢 Implementado |
| [203](203-preferencias-notificaciones-usuario/spec.md) | SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100) | 🔵 Planeado |
| [204](204-piloto-bienvenida-colegio/spec.md) | SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101) | 🔵 Planeado |
| [211](211-vistas-cliente-pagos/spec.md) | SPEC-211 — Vistas cliente pagos Rector + Padre (002-PI-111) | 🔵 Planeado |
| [213](213-motor-vigencia-pagos/spec.md) | SPEC-213 — Motor vigencia + estados pagos (002-PI-113) | 🔵 Planeado |
| [215](215-referidos-pagos/spec.md) | SPEC-215 — Código de referido (002-PI-115) | 🔵 Planeado |
| [217](217-freemium-pagos/spec.md) | SPEC-217 — Freemium 30 días (002-PI-117) | 🔵 Planeado |
| [218](218-analitica-dinero-vs-valor-pagos/spec.md) | SPEC-218 — Analítica dinero-vs-valor pagos (002-PI-118) | 🔵 Planeado |
| [220](220-modelo-analisis-score/spec.md) | SPEC-220 — Modelo Análisis + score de valor de cliente (002-PI-121) | 🔵 Planeado |
| [221](221-motor-reglas-recomendacion/spec.md) | SPEC-221 — Motor de reglas de recomendación (002-PI-122) | 🔵 Planeado |
| [222](222-panel-principal-analisis/spec.md) | SPEC-222 — Panel principal Análisis Dinero vs Valor (002-PI-123) | 🔵 Planeado |
| [223](223-digest-semanal/spec.md) | SPEC-223 — Digest semanal al CEO (002-PI-124) | 🔵 Planeado |
| [224](224-panel-reglas-configurables/spec.md) | SPEC-224 — Panel de reglas configurables (002-PI-125) | 🔵 Planeado |
| [225](225-deteccion-anomalias/spec.md) | SPEC-225 — Detección de anomalías dinero-vs-valor (002-PI-126) | 🔵 Planeado |
| [226](226-ejecucion-acciones-automaticas/spec.md) | SPEC-226 — Ejecución de acciones automáticas reglas EJECUTA (002-PI-127) | 🔵 Planeado |
| [227](227-historial-recomendaciones/spec.md) | SPEC-227 — Historial de recomendaciones y métricas de tuning (002-PI-128) | 🔵 Planeado |
| [233](233-busqueda-por-identificador/spec.md) | SPEC-233 — Vista búsqueda por identificador padre + admin (002-PI-133) | 🔵 Planeado |

## Incidencias de calidad de datos

- **Colisión 050 resuelta (spec 087):** `050-pendientes-afinamiento` renombrada a `088-pendientes-afinamiento`; referencias actualizadas.
- **Saltos de numeración:** faltan `032`, el rango `055-069` y `081`.
- **Numeración duplicada:** existen `02-reportes-comunitarios` y la serie `0NN` estándar (conviven por historia del repo).
- **Clúster 085–095:** headers `FINALIZADO (pendiente ACTA → CERRADA)`; el snapshot de gestión (2026-07-29) las contó como CERRADA. Divergencia reportada a ZEUS en 002-PI-047.

## Convención de archivos por spec

Cada spec cerrada debe contener al menos: `spec.md` (alcance), `plan.md` (plan) y `reporte-cierre.md`/`cierre.md` (evidencia de cierre, en la carpeta de la spec o en `docs/cierre-NNN.md`).
