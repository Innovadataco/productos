# Índice maestro de especificaciones

> Última actualización: **2026-08-29** (radicación A-50 · Home Padre Proactivo: SPEC-304/305/306/307/308 planeadas).
> Cruce con el ESTADO-SPECS de gestión (snapshot 2026-07-29: 72/26/9/3): la lectura directa de headers da **62/36/11/1**.
> Deltas explicados: (a) 053 y 017 pasaron de Planeada a Implementada (002-PI-046); (b) las 10 specs del clúster
> 085–095, que el snapshot contó como CERRADA, tienen header literal `FINALIZADO (pendiente ACTA-VALIDACION de ZEUS → CERRADA)`
> — se reporta la divergencia a ZEUS; manda el header del repo.

## Resumen

> **Los contadores no viven acá (SPEC-432).** Un total commiteado es un número
> que dos ramas pisan sin avisar: las dos suman uno sobre la misma base, escriben
> el mismo valor, git las funde sin conflicto y queda **una spec de menos** en la
> cuenta. Se piden cuando se quieren:
>
> ```
> npx tsx scripts/specs/generar-readme.ts --resumen
> ```
## Backlog activo (no cerradas)

<!-- SPEC-413:BEGIN tabla -->
<!-- Generado por `npx tsx scripts/specs/generar-readme.ts`. NO editar a mano — el CI de `verificaciones` compara con el generado y falla si difiere. -->

| Nº | Nombre | Estado |
|----|--------|--------|
| [001](001-multi-role-auth-config/spec.md) | Feature Specification: Autenticación Multi-Rol y Parámetros de Configuración | 📁 CERRADA |
| [002](02-reportes-comunitarios/spec.md) | Feature Specification: Módulo de Reportes Comunitarios | 📁 CERRADA |
| [003](003-frontend-publico/spec.md) | 003-frontend-publico | 📁 CERRADA |
| [004](004-panel-admin/spec.md) | Feature Specification: Panel de Administración | 📁 CERRADA |
| [005](005-password-reset/spec.md) | Feature Specification: Restablecimiento de Contraseña | 📁 CERRADA |
| [006](006-paginas-legales/spec.md) | Feature Specification: Páginas Legales y Footer | ✅ FINALIZADO |
| [007](007-alertas-email/spec.md) | Feature Specification: Alertas por Email | ✅ FINALIZADO |
| [008](008-seo/spec.md) | Feature Specification: SEO y Metadatos | 📁 CERRADA |
| [009](009-dashboard-publico/spec.md) | Feature Specification: Dashboard Público | 📁 CERRADA |
| [010](010-rediseño-clasificador-ia/spec.md) | Feature Specification: Rediseño del Clasificador IA | 📁 CERRADA |
| [011](011-centro-control-ia/spec.md) | Spec 011 — Centro de Control IA | 📁 CERRADA |
| [012](012-baja-reportes/spec.md) | Spec 012 — Baja/Desactivación de reportes | 📁 CERRADA |
| [013](013-admin-motor-ia/spec.md) | Spec 013 — Administración del Motor IA desde el Panel | 📁 CERRADA |
| [014](014-laboratorio-ia/spec.md) | Spec 014 — Laboratorio de Experimentos IA | 📁 CERRADA |
| [015](015-anti-abuso/spec.md) | Spec 015 — Defensas anti-abuso | 📁 CERRADA |
| [016](016-circulo-confianza/spec.md) | Spec 016 — Círculo de Confianza | 📁 CERRADA |
| [017](017-documentacion/spec.md) | Spec 017 — Módulo de documentación navegable | 🟢 IMPLEMENTADO |
| [018](018-operadores-casos/spec.md) | Spec 018 — Operadores de casos (revisión humana) | 📁 CERRADA |
| [019](019-permisos-modulos/spec.md) | Spec 019 — Gestor de permisos de módulos por ROL | ✅ FINALIZADO |
| [020](020-reorganizacion-monitoreo/spec.md) | Spec 020 — Reorganización de módulos + Tablero de monitoreo | 📁 CERRADA |
| [021](021-reporte-anonimo-interno/spec.md) | Spec 021 — Reporte anónimo con sesión interna abierta | 📁 CERRADA |
| [022](022-expediente-transiciones/spec.md) | Spec 022 — Expediente interno de transiciones | 📁 CERRADA |
| [023](023-estados-usuario-sla/spec.md) | Spec 023 — Estados de cara al usuario + SLA visible | 📁 CERRADA |
| [024](024-comite-validacion/spec.md) | Spec 024 — Rol Comité de Validación + gestión de cuenta e integrantes | 📁 CERRADA |
| [025](025-anonimizacion-reforzada/spec.md) | Spec 025 — Anonimización reforzada + encriptación del original | 📁 CERRADA |
| [026](026-pipeline-spam-prioridad/spec.md) | Spec 026 — Pipeline de spam | 📁 CERRADA |
| [027](027-motor-encolamiento/spec.md) | 027-motor-encolamiento | 📁 CERRADA |
| [028](028-redisenio-home/spec.md) | Feature Specification: Rediseño completo del Home (Landing) | 📁 CERRADA |
| [029](029-redisenio-consulta-panel-usuario/spec.md) | Feature Specification 029 · Rediseño de la consulta pública + panel del usuario autenticado | 📁 CERRADA |
| [030](030-circulo-confianza-multiples-identificadores/spec.md) | Spec 030 — Rediseño del Círculo de Confianza: contacto = persona con múltiples identificadores | 📁 CERRADA |
| [031](031-mejoras-ui-agrupacion-categorias/spec.md) | Spec 031 — Mejoras de UI: agrupación de categorías, terminología, círculo de confianza, dashboard público, notificaciones y logout | 📁 CERRADA |
| [033](033-correcciones-vistas-roles/spec.md) | Feature Specification: Correcciones de vistas y roles | 📁 CERRADA |
| [034](034-config-guardado-mapa-comite/spec.md) | Feature Specification: Configuración, guardado y mapa del Comité | 📁 CERRADA |
| [035](035-correcciones-034-blindaje-critico/spec.md) | Feature Specification: Correcciones del 034 + blindaje crítico | 📁 CERRADA |
| [036](036-consistencia-limpieza/spec.md) | Feature Specification: Consistencia y limpieza | 📁 CERRADA |
| [037](037-seguridad-limpieza/spec.md) | Feature Specification: Fixes de seguridad y limpieza | 📁 CERRADA |
| [038](038-auditoria-operadores-comite/spec.md) | Feature Specification: Auditoría de Operadores y Comité | 📁 CERRADA |
| [039](039-middleware-perimetral-real/spec.md) | Feature Specification: Middleware perimetral real | 📁 CERRADA |
| [040](040-aislamiento-comite-bandeja/spec.md) | Feature Specification: Aislamiento del comité a su Bandeja | 📁 CERRADA |
| [041](041-cierre-blindaje-saneamiento/spec.md) | Feature Specification: Cierre de blindaje + saneamiento | 📁 CERRADA |
| [042](042-operador-corrije-clasificacion/spec.md) | Feature Specification: Operador corrige la clasificación | 📁 CERRADA |
| [043](043-ux-comite-nav-padre/spec.md) | Feature Specification: UX del comité y navegación del padre | 📁 CERRADA |
| [044](044-disciplina-spec-kit/spec.md) | Feature Specification: Disciplina y reconciliación Spec-Kit | 📁 CERRADA |
| [045](045-seguridad-fase-1/spec.md) | Feature Specification: Seguridad Fase 1 — Saneamiento de Auth | 📁 CERRADA |
| [046](046-endurecimiento-seguridad/spec.md) | Feature Specification: Endurecimiento de Seguridad (Spec 046) | 📁 CERRADA |
| [047](047-tests-rol-arquitectura/spec.md) | Feature Specification: Tests de rol + documentación de arquitectura | 📁 CERRADA |
| [048](048-validacion-uniforme/spec.md) | Feature Specification: Validación uniforme (zod) | 📁 CERRADA |
| [049](049-accesibilidad-wcag/spec.md) | Feature Specification: Accesibilidad (WCAG 2.2) | 📁 CERRADA |
| [050](050-mejora-prompt-clasificador/spec.md) | Feature Specification: Mejora del prompt del clasificador (Spec 050) | 📁 CERRADA |
| [051](051-claridad-estados/spec.md) | Feature Specification: Claridad y estados | 📁 CERRADA |
| [052](052-dividir-archivos-grandes/spec.md) | Feature Specification: Dividir archivos grandes | 📁 CERRADA |
| [053](053-capa-datos-servicios/spec.md) | Feature Specification: Capa de datos / servicios (DAL) | 🟢 IMPLEMENTADO |
| [054](054-correccion-049-051-accesibilidad-ui/spec.md) | Feature Specification: Corrección post-cierre 049 y 051 — Accesibilidad y UI | 📁 CERRADA |
| [070](070-simulacion-carga-modelos/spec.md) | Feature Specification: Simulación de carga y comparación de modelos (Spec 070) | 📁 CERRADA |
| [071](071-correccion-fidelidad-simulacion-070/spec.md) | Feature Specification: Corrección de fidelidad de la simulación (Spec 071) | 📁 CERRADA |
| [072](072-simulacion-ver-detalle-reporte/spec.md) | Feature Specification: Simulación — Ver detalle del reporte (Spec 072) | 📁 CERRADA |
| [073](073-ubicacion-departamentos/spec.md) | Feature Specification: Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spec 073) | 📁 CERRADA |
| [074](074-colegios-fundacion/spec.md) | Feature Specification: Módulo Colegios — Fase 1: Fundación (Colegio + creación por admin + login institucional) (Spec 074) | 📁 CERRADA |
| [075](075-colegios-cursos-alumnos/spec.md) | Feature Specification: Colegios · Fase 2 — Cursos, Alumnos e Identificadores | 📁 CERRADA |
| [076](076-colegios-carga-excel/spec.md) | Feature Specification: Colegios · Fase 3 — Carga masiva por Excel/CSV | 📁 CERRADA |
| [077](077-colegios-alertas-consulta/spec.md) | Feature Specification: Colegios · Fase 4 — Alertas y Consulta anonimizada | 📁 CERRADA |
| [078](078-colegios-estadisticas-pdf/spec.md) | Feature Specification: Colegios · Fase 5 — Estadísticas e informe PDF institucional | 📁 CERRADA |
| [079](079-colegio-acceso-auditoria/spec.md) | Spec 079 — Módulo Colegios: acceso institucional y auditoría del colegio | 📁 CERRADA |
| [080](080-orden-migraciones-colegio/spec.md) | Spec 080 — Corrección del orden de migraciones (incidencia I-04) | 📁 CERRADA |
| [082](082-fusion-playground-modelos/spec.md) | Spec 082 — Fusión de tabs "Playground" + "Modelos" en admin/ia (y corrección I-05) | 📁 CERRADA |
| [083](083-simulacion-completitud-multimodelo/spec.md) | Spec 083 — Simulación: completitud/métricas + selección multi-modelo (I-06) | 📁 CERRADA |
| [084](084-fix-timeout-multimodelo/spec.md) | Spec 084 — Fix timeout multi-modelo de simulación (I-07) | 📁 CERRADA |
| [085](085-evaluacion-error-silencioso/spec.md) | Spec 085 — Evaluación por error silencioso y modelo por defecto | ✅ FINALIZADO |
| [086](086-navegacion-gobernada-permisos/spec.md) | Spec 086 — Navegación y páginas gobernadas por permisos | ✅ FINALIZADO |
| [087](087-saneamiento-speckit-fase2/spec.md) | Spec 087 — Saneamiento Spec Kit, fase 2 | ✅ FINALIZADO |
| [088](088-pendientes-afinamiento/spec.md) | Spec 088 — Pendientes de afinamiento (registro vivo) | 🔵 PLANEADO |
| [089](089-presentacion-usuario/spec.md) | Spec 089 — Presentación al usuario: estados, categorías y consulta pública | ✅ FINALIZADO |
| [090](090-clasificacion-rubrica-multimodelo/spec.md) | Spec 090 — Clasificación por rúbrica multi-etiqueta + multi-modelo + "Mis reportes" | ✅ FINALIZADO |
| [091](091-ux-privacidad-consulta-seguimiento/spec.md) | Spec 091 — UX y privacidad de la consulta + seguimiento | ✅ FINALIZADO |
| [092](092-motor-logica-corregida/spec.md) | Spec 092 — Motor: lógica corregida y validada | ✅ FINALIZADO |
| [093](093-coherencia-padre/spec.md) | Spec 093 — Coherencia del padre autenticado | ✅ FINALIZADO |
| [094](094-deuda-tecnica-documentacion/spec.md) | Spec 094 — Deuda técnica y documentación | ✅ FINALIZADO |
| [095](095-default-seguro-jwt-banco/spec.md) | Spec 095 — Default seguro, JWT parametrizado y banco gobernado | ✅ FINALIZADO |
| [096](096-expediente-reporte/spec.md) | Spec 096 — Expediente del reporte: traza del modelo (rol Admin) | ✅ FINALIZADO |
| [097](097-despliegue-hibrido-produccion/spec.md) | Feature Specification: Despliegue híbrido a producción (VPS + cerebro en la Mac) | ✅ FINALIZADO |
| [098](098-afinamiento-motor/spec.md) | Feature Specification: Afinamiento del motor (rúbrica) — targeting, principal por gravedad y métrica | ✅ FINALIZADO |
| [099](099-rotacion-claves-i22/spec.md) | Feature Specification: Rotación de claves filtradas + regla no-secretos (I-22) | ✅ FINALIZADO |
| [100](100-correcciones-colegios/spec.md) | Feature Specification: Correcciones módulo Colegios (+ Comité) | ✅ FINALIZADO |
| [101](101-app-publica-entorno/spec.md) | Feature Specification: App pública y entorno (I-23 / I-24 / A-2) | ✅ FINALIZADO |
| [102](102-sello-version/spec.md) | Feature Specification: Sello de versión (dev y prod) | ✅ FINALIZADO |
| [103](103-fix-fuga-pii-seguimiento/spec.md) | Feature Specification: Fix fuga de PII en seguimiento público (I-28, Crítica) | ✅ FINALIZADO |
| [104](104-motor-indices-rubrica/spec.md) | Feature Specification: Motor de rúbrica — votación por índices (adiós al match verbatim) | ✅ FINALIZADO |
| [105](105-seed-admin-seguro/spec.md) | Feature Specification: Seed del admin inicial sin credencial literal (I-31) | ✅ FINALIZADO |
| [106](106-logout-cookie-secure/spec.md) | Feature Specification: Cerrar sesión de verdad (cookie `__Host-` y enrutado público del logo) | ✅ FINALIZADO |
| [107](107-gate-antirrecaidas/spec.md) | Feature Specification: SPEC-107 — El gate que evita recaídas | ✅ FINALIZADO |
| [108](108-higiene-seguridad-ux/spec.md) | Feature Specification: SPEC-108 — Higiene de seguridad y UX | ✅ FINALIZADO |
| [109](109-eliminar-modulo-apelacion/spec.md) | Feature Specification: SPEC-109 — Eliminar el módulo de apelación actual (D-34) | ✅ FINALIZADO |
| [110](110-apelacion-identificador/spec.md) | Feature Specification: SPEC-110 — Apelación del identificador reportado | 🟢 IMPLEMENTADO |
| [111](111-motor-rubrica-default/spec.md) | Feature Specification: SPEC-111 — D-28: el motor de rúbrica pasa a ser el predeterminado | ✅ FINALIZADO |
| [113](113-colegio-atrapado-menu-rol/spec.md) | Feature Specification: SPEC-113 — El colegio atrapado (I-35/I-35b) y menú por rol (I-36) | ✅ FINALIZADO |
| [114](114-suite-e2e-por-rol/spec.md) | Feature Specification: SPEC-114 — Suite E2E por rol y estabilización por ciclos | ✅ FINALIZADO |
| [115](115-catalogo-geografico-latam/spec.md) | Feature Specification: Catálogo geográfico real LATAM y Centroamérica (SPEC-115, bloque B1 cola 002-PI-041) | 🟢 IMPLEMENTADO |
| [116](116-vista-padre-sin-tecnico/spec.md) | Feature Specification: Vista del padre sin traza técnica del motor | ✅ FINALIZADO |
| [117](117-gestion-padres-admin/spec.md) | Feature Specification: Gestión de credenciales de padres desde admin (I-37) | 🟢 IMPLEMENTADO |
| [118](118-clics-muertos-colegio/spec.md) | Feature Specification: Clics muertos del colegio (D-37) | 🟢 IMPLEMENTADO |
| [119](119-vigencia-servicio-cliente/spec.md) | Feature Specification: Vigencia del servicio por cliente (padres y colegios) | 🟢 IMPLEMENTADO |
| [120](120-smoke-prod-safe/spec.md) | Feature Specification: SPEC-120 — Smoke prod-safe por rol | ✅ FINALIZADO |
| [121](121-error-wrapper-ollama-timeout/spec.md) | Feature Specification: SPEC-121 — Sobre de error único (R2) + timeout de Ollama | ✅ FINALIZADO |
| [122](122-capa-datos-reportes/spec.md) | SPEC-122 — Capa de datos: predicados centrales de acceso a reportes | ✅ FINALIZADO |
| [123](123-motor-tipos-muerto-guardas/spec.md) | Spec 123 — Motor: tipos desde Prisma, código muerto y guardas unificadas | ✅ FINALIZADO |
| [124](124-primitivas-ui-compartidas/spec.md) | Feature Specification: SPEC-124 — Primitivas UI compartidas (R7) | ✅ FINALIZADO |
| [125](125-validacion-unificada-api/spec.md) | SPEC-125 — API: una sola forma de validar | 🟢 IMPLEMENTADO |
| [126](126-linea-base-arquitectura/spec.md) | Feature Specification: SPEC-126 — Línea base de arquitectura generada desde el código | 🟢 IMPLEMENTADO |
| [127](127-home-padre/spec.md) | Feature Specification: SPEC-127 — Home del padre (PARENT → /dashboard) | 🟢 IMPLEMENTADO |
| [128](128-reconciliacion-grants-comite/spec.md) | Feature Specification: SPEC-128 — Reconciliación de grants del comité | 🟢 IMPLEMENTADO |
| [129](129-rediseno-ux-colegio/spec.md) | Feature Specification: SPEC-129 — Rediseño de UX del panel del colegio | 🟢 IMPLEMENTADO |
| [130](130-cifrado-reposo-texto-reporte/spec.md) | Feature Specification: SPEC-130 — Cifrado en reposo del texto del reporte (BL-4) | 🟢 IMPLEMENTADO |
| [131](131-visibilidad-solo-aprobados/spec.md) | Feature Specification: SPEC-131 — Visibilidad pública solo por reportes aprobados (BL-5) | 🟢 IMPLEMENTADO |
| [132](132-seguridad-carga-colegio/spec.md) | Feature Specification: SPEC-132 — Seguridad de la carga masiva del colegio (S-3 exceljs + S-4 roster server-side) | 🟢 IMPLEMENTADO |
| [133](133-journeys-e2e-gate-cobertura-roles/spec.md) | Feature Specification: SPEC-133 — Journeys E2E por rol como gate de merge + cobertura completa por rol (Q-1) | 🟢 IMPLEMENTADO |
| [134](134-dal-colegio-tenant-obligatorio/spec.md) | Feature Specification: SPEC-134 — DAL del módulo colegio con tenant obligatorio (E-1) | 🟢 IMPLEMENTADO |
| [135](135-circulo-confianza-god-module-n1/spec.md) | Feature Specification: SPEC-135 — Romper el god-module circulo-confianza + matar el N+1 (E-2) | 🟢 IMPLEMENTADO |
| [136](136-tipado-estricto-casts-guards-tsconfig/spec.md) | Feature Specification: SPEC-136 — Tipado estricto: `as unknown as` ×29, `!.` ×15, tsconfig maximal viable (E-3) | 🟢 IMPLEMENTADO |
| [137](137-creacion-reporte-atomica/spec.md) | Feature Specification: SPEC-137 — Creación de reporte ATÓMICA (E-5) | 🟢 IMPLEMENTADO |
| [138](138-eval-sandbox-rubrica-posible-agresor-par/spec.md) | Feature Specification: SPEC-138 — Eval/sandbox alineados con la rúbrica de prod + `posibleAgresorPar` calculado (E-7) | 🟢 IMPLEMENTADO |
| [139](139-evento-match/spec.md) | Feature Specification: SPEC-139 — Evento de match: segundo reporte independiente del mismo identificador (F5) | 🟢 IMPLEMENTADO |
| [140](140-denuncia-formal/spec.md) | Feature Specification: SPEC-140 — Botón "Llevar a denuncia formal" + panel forense para autoridades (F2 + N-4) | 🟢 IMPLEMENTADO |
| [141](141-admin-solo-lectura-padres-colegios/spec.md) | Feature Specification: SPEC-141 — Admin ve (solo lectura) círculo de confianza de padres + cursos/alumnos de colegios (N-1) | 🟢 IMPLEMENTADO |
| [142](142-patrones-institucionales/spec.md) | Feature Specification: SPEC-142 — Patrones institucionales para colegios (F6) | 🟢 IMPLEMENTADO |
| [143](143-home-rector/spec.md) | Feature Specification: SPEC-143 — Home operativo del rector | 🟢 IMPLEMENTADO |
| [144](144-modelo-estudiante/spec.md) | Feature Specification: SPEC-144 — Modelo `Estudiante` expandido (rename desde `Alumno`) | 🟢 IMPLEMENTADO |
| [145](145-modelo-profesor/spec.md) | Feature Specification: SPEC-145 — Modelo `Profesor` mínimo | 🟢 IMPLEMENTADO |
| [146](146-wizard-curso-unificado/spec.md) | Feature Specification: SPEC-146 — Wizard unificado curso + estudiantes + identificadores | 🟢 IMPLEMENTADO |
| [147](147-vista-curso/spec.md) | Feature Specification: SPEC-147 — Vista de curso (escritorio del curso) | 🟢 IMPLEMENTADO |
| [148](148-profesores-buscador/spec.md) | Feature Specification: SPEC-148 — Profesores + buscador global ⌘K | 🟢 IMPLEMENTADO |
| [149](149-avisos-email/spec.md) | Feature Specification: SPEC-149 — Avisos por email configurables | 🟢 IMPLEMENTADO |
| [150](150-observacion-especial/spec.md) | Feature Specification: SPEC-150 — Observación especial de estudiantes | 🟢 IMPLEMENTADO |
| [151](151-informe-pdf-mensual/spec.md) | Feature Specification: SPEC-151 — Informe PDF mensual determinístico | 🟢 IMPLEMENTADO |
| [152](152-duplicar-curso/spec.md) | Feature Specification: SPEC-152 — Duplicar curso al año siguiente | 🟡 DESARROLLO |
| [153](153-comparativa-cursos/spec.md) | Feature Specification: SPEC-153 — Comparativa entre cursos | 🟢 IMPLEMENTADO |
| [154](154-confianza-transparencia/spec.md) | Feature Specification: SPEC-154 — Confianza: transparencia, protocolo e historial | 🟢 IMPLEMENTADO |
| [155](155-timeline-ver-proceso/spec.md) | Feature Specification: SPEC-155 — Timeline "Ver proceso" para ADMIN | 🟢 IMPLEMENTADO |
| [156](156-panel-monitoreo-worker/spec.md) | Feature Specification: SPEC-156 — Panel de monitoreo del worker (ADMIN, solo lectura) | 🟢 IMPLEMENTADO |
| [157](157-sistema-diseno/spec.md) | Feature Specification: SPEC-157 — Sistema de diseño de Protección Infantil: tokens, tipografía y primitivos | 🟢 IMPLEMENTADO |
| [158](158-tablero-colegio/spec.md) | Feature Specification: SPEC-158 — Tablero de control del colegio | 🟢 IMPLEMENTADO |
| [159](159-seguimiento-caso/spec.md) | Feature Specification: SPEC-159 — Seguimiento del caso con bitácora | 🟢 IMPLEMENTADO |
| [160](160-dataset-demo-produccion/spec.md) | Feature Specification: SPEC-160 — Dataset demo de producción (002-PI-059) | 🔵 PLANEADO |
| [162](162-materia-configurable/spec.md) | Feature Specification: SPEC-162 — Materia configurable en cursos | 🟢 IMPLEMENTADO |
| [163](163-acudiente-completo/spec.md) | Feature Specification: SPEC-163 — Acudiente completo: identificadores + edición post-alta + conteo | 🟢 IMPLEMENTADO |
| [164](164-identificadores-profesor/spec.md) | Feature Specification: SPEC-164 — Identificadores de profesor + profesores en estadísticas | 🟢 IMPLEMENTADO |
| [165](165-alertas-extendidas/spec.md) | Feature Specification: SPEC-165 — Alertas extendidas: matching sobre profesor/acudiente + tipo de sujeto | 🟢 IMPLEMENTADO |
| [166](166-alertas-nivel-dios/spec.md) | Feature Specification: SPEC-166 — Alertas nivel dios: bandeja de prioridad, filtros, lote, SLA | 🟢 IMPLEMENTADO |
| [167](167-rediseno-3-a-2/spec.md) | Feature Specification: SPEC-167 — Rediseño 3→2: Inicio + Estadísticas, eliminar Tablero | 🟢 IMPLEMENTADO |
| [168](168-comite-convivencia/spec.md) | Feature Specification: SPEC-168 — Comité de Convivencia por colegio | 🟢 IMPLEMENTADO |
| [169](169-onboarding-cobertura/spec.md) | Feature Specification: SPEC-169 — Onboarding + cobertura + notificaciones in-app | 🟢 IMPLEMENTADO |
| [170](170-limpieza-centro-control-ia/spec.md) | Feature Specification: SPEC-170 — Limpieza del Centro de Control IA | 🔵 PLANEADO |
| [171](171-tablero-operativo/spec.md) | Feature Specification: SPEC-171 — Pilar B · Tablero Operativo | 🟢 IMPLEMENTADO |
| [172](172-deriva-motor-prod/spec.md) | Feature Specification: SPEC-172 — Pilar D.5 · Deriva del motor en producción | 🟢 IMPLEMENTADO |
| [173](173-restructura-nav-colegio/spec.md) | Feature Specification: SPEC-173 — Módulo Colegio: restructura de navegación por rol + fixes H01-H06 | 🟢 IMPLEMENTADO |
| [174](174-aislamiento-tests-strict/spec.md) | Feature Specification: SPEC-174 — Aislamiento estricto de tests (fix I-55) | 🟢 IMPLEMENTADO |
| [175](175-hotfix-permisos-comite/spec.md) | Feature Specification: SPEC-175 — Hotfix I-57: permiso padre faltante del rol Comité de Convivencia | 🟢 IMPLEMENTADO |
| [176](176-cursos-reactivar/spec.md) | Feature Specification: SPEC-176 — Cursos: ver y reactivar desactivados | 🟢 IMPLEMENTADO |
| [177](177-estadisticas-comite/spec.md) | Feature Specification: SPEC-177 — Estadísticas del comité de convivencia más útiles | 🟢 IMPLEMENTADO |
| [178](178-monitor-arranque-prod/spec.md) | Feature Specification: SPEC-178 — Hotfix I-58: el monitor de infraestructura arranca en producción | 🟢 IMPLEMENTADO |
| [179](179-subnav-estadisticas-admin/spec.md) | Feature Specification: SPEC-179 — Sub-nav del área Estadísticas del admin (I-59) | 🟢 IMPLEMENTADO |
| [180](180-fixes-visuales-admin/spec.md) | Feature Specification: SPEC-180 — Fixes visuales del admin (tabs duplicados, texto invisible, monitoreo redundante, propósito de Dataset) | 🟢 IMPLEMENTADO |
| [181](181-filtros-bandejas-admin/spec.md) | Feature Specification: SPEC-181 — Filtros, búsqueda y orden en las bandejas del admin | 🟢 IMPLEMENTADO |
| [182](182-reconciliacion-huerfanos/spec.md) | Feature Specification: SPEC-182 — Reconciliación de reportes huérfanos (I-60) | 🟢 IMPLEMENTADO |
| [183](183-zeus-readonly-tailscale/spec.md) | Feature Specification: SPEC-183 — Acceso lectura ZEUS a BD prod por Tailscale (002-PI-078) | 🟢 IMPLEMENTADO |
| [184](184-anti-abuso-operativo-simulador/spec.md) | Feature Specification: SPEC-184 — Anti-abuso operativo + simulador de abusos | ✅ FINALIZADO |
| [185](185-simulador-historial/spec.md) | Feature Specification: SPEC-185 — Historial y sugerencias del simulador de abusos | 🟢 IMPLEMENTADO |
| [186](186-smoke-inteligente-ollama/spec.md) | Feature Specification: SPEC-186 — Smoke inteligente del monitor Ollama (002-PI-081) | 🟢 IMPLEMENTADO |
| [187](187-override-modelo-smoke-ollama/spec.md) | Feature Specification: SPEC-187 — Override de modelo para smoke Ollama (002-PI-082) | 🟢 IMPLEMENTADO |
| [188](188-visibilidad-operador-bandeja/spec.md) | Feature Specification: SPEC-188 — Visibilidad del operador en la bandeja (002-PI-083) | 🟢 IMPLEMENTADO |
| [189](189-vista-operador-metricas/spec.md) | Feature Specification: SPEC-189 — Vista de operador con métricas (002-PI-084) | 🟢 IMPLEMENTADO |
| [190](190-deploy-seed-idempotente/spec.md) | Feature Specification: SPEC-190 — Deploy ejecuta seed idempotente (002-PI-085) | 🟢 IMPLEMENTADO |
| [192](192-ux-simulador-anti-abuso/spec.md) | Feature Specification: SPEC-192 — UX del simulador anti-abuso (002-PI-086) | 🟢 IMPLEMENTADO |
| [193](193-panel-logs-mantenimiento-reasignar/spec.md) | Feature Specification: Panel de Logs + Mantenimiento + Reasignar Operador | 🔵 PLANEADO |
| [194](194-analitica-colegios/spec.md) | Feature Specification: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT (002-PI-088) | 🟢 IMPLEMENTADO |
| [195](195-motor-spam-aprendizaje-operativo/spec.md) | Feature Specification: SPEC-195 — Motor SPAM + Aprendizaje operativo (002-PI-089) | 🔵 PLANEADO |
| [196](196-parche-ui-anti-abuso/spec.md) | SPEC-196 — Parche UI Anti-abuso (002-PI-090) | 🟢 IMPLEMENTADO |
| [197](197-fixes-operadores-usuarios/spec.md) | SPEC-197 — Fixes operadores + usuarios (002-PI-094) | 🟢 IMPLEMENTADO |
| [199](199-parche-motor-spam/spec.md) | Feature Specification: SPEC-199 — Parche motor SPAM (002-PI-093) | 🔵 PLANEADO |
| [200](200-infra-timezone-bogota/spec.md) | Feature Specification: SPEC-200 — INFRA · Timezone Bogotá (002-PI-097) | 🔵 PLANEADO |
| [201](201-motor-notificaciones-nucleo/spec.md) | Feature Specification: SPEC-201 — Motor de Notificaciones · Núcleo (002-PI-098) | 🔵 PLANEADO |
| [202](202-panel-admin-motor-notificaciones/spec.md) | Feature Specification: SPEC-202 — Panel Admin del Motor de Notificaciones (002-PI-099) | 🟢 IMPLEMENTADO |
| [203](203-preferencias-notificaciones-usuario/spec.md) | Feature Specification: SPEC-203 — Preferencias de Notificaciones del Usuario (002-PI-100) | 🔵 PLANEADO |
| [204](204-piloto-bienvenida-colegio/spec.md) | Feature Specification: SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101) | 🔵 PLANEADO |
| [205](205-usuarios-vista-consolidada/spec.md) | SPEC-205 — Usuarios · Vista consolidada por rol (002-PI-102) | 🔵 PLANEADO |
| [206](206-infra-session-log/spec.md) | SPEC-206 — Infra · Session Log (002-PI-120) | 🟢 IMPLEMENTADO |
| [207](207-parche-motor-spam-dominancia/spec.md) | SPEC-207 — Parche motor SPAM dominancia (002-PI-140) | 🔵 PLANEADO |
| [208](208-fechacorta-central/spec.md) | SPEC-208 — fechaCorta helper central + timezone Bogotá (002-PI-141) | 🔵 PLANEADO |
| [209](209-log-modal-contraste/spec.md) | SPEC-209 — LogContextoModal contraste (002-PI-142) | 🔵 PLANEADO |
| [210](210-modelos-base-pagos/spec.md) | SPEC-210 · Modelos base Pagos (002-PI-110) | 🔵 PLANEADO |
| [211](211-vistas-cliente-pagos/spec.md) | SPEC-211 · Vistas cliente (Rector + Padre) (002-PI-111) | 🔵 PLANEADO |
| [212](212-panel-admin-pagos/spec.md) | SPEC-212 · Panel admin Pagos (002-PI-112) | 🟢 IMPLEMENTADO |
| [213](213-motor-vigencia-pagos/spec.md) | SPEC-213 · Motor vigencia + estados (002-PI-113) | 🔵 PLANEADO |
| [214](214-multi-moneda-pagos/spec.md) | SPEC-214 · Multi-moneda + API tasas (002-PI-114) | 🟢 IMPLEMENTADO |
| [215](215-referidos-pagos/spec.md) | SPEC-215 · Código de referido (002-PI-115) | 🟢 IMPLEMENTADO |
| [217](217-freemium-pagos/spec.md) | SPEC-217 · Freemium 30 días (002-PI-117) | 🟢 IMPLEMENTADO |
| [218](218-analitica-dinero-vs-valor-pagos/spec.md) | SPEC-218 · Analítica dinero-vs-valor (002-PI-118) | 🔵 PLANEADO |
| [220](220-modelo-analisis-score/spec.md) | Feature Specification: SPEC-220 — Modelo Análisis + score de valor de cliente | 🔵 PLANEADO |
| [221](221-motor-reglas-recomendacion/spec.md) | Feature Specification: SPEC-221 — Motor de reglas de recomendación | 🔵 PLANEADO |
| [222](222-panel-principal-analisis/spec.md) | Feature Specification: SPEC-222 — Panel principal Análisis (Dinero vs Valor) | 🟢 IMPLEMENTADO |
| [223](223-digest-semanal/spec.md) | Feature Specification: SPEC-223 — Digest semanal al CEO (Análisis dinero-vs-valor) | 🔵 PLANEADO |
| [224](224-panel-reglas-configurables/spec.md) | Feature Specification: SPEC-224 — Panel de reglas configurables (Análisis dinero-vs-valor) | 🟢 IMPLEMENTADO |
| [225](225-deteccion-anomalias/spec.md) | Feature Specification: SPEC-225 — Detección de anomalías dinero-vs-valor | 🔵 PLANEADO |
| [226](226-ejecucion-acciones-automaticas/spec.md) | Feature Specification: SPEC-226 — Ejecución de acciones automáticas (reglas modo EJECUTA) | 🟢 IMPLEMENTADO |
| [227](227-historial-recomendaciones/spec.md) | Feature Specification: SPEC-227 — Historial de recomendaciones y métricas de tuning | 🟢 IMPLEMENTADO |
| [230](230-padre-v2-modelos-expediente-evento/spec.md) | Feature Specification: Padre v2 · Modelos Expediente + Evento | 🟢 IMPLEMENTADO |
| [231](231-sidebar-padre-rutas-base/spec.md) | SPEC-231 · Sidebar padre + rutas base (002-PI-131) | 🔵 PLANEADO |
| [232](232-vista-padre-expedientes/spec.md) | SPEC-232 · Vista padre expedientes (lista + detalle + agregar evento) (002-PI-132) | 🔵 PLANEADO |
| [233](233-busqueda-por-identificador/spec.md) | Feature Specification: SPEC-233 — Vista búsqueda por identificador (padre + admin) | 🔵 PLANEADO |
| [234](234-padre-v2-compilacion-tecnica-senal-patrones-kit-evidencia/spec.md) | Feature Specification: SPEC-234 — Padre v2 · Compilación técnica + Señal + Patrones N1 + Kit evidencia | 🟢 IMPLEMENTADO |
| [235](235-guias-accion-parametrizables/spec.md) | Feature Specification: SPEC-235 — Guías de acción parametrizables | 🟢 IMPLEMENTADO |
| [236](236-motor-estados-worker-eventos/spec.md) | Feature Specification: SPEC-236 — Motor de estados + worker + 11 eventos Motor Notif | 🔵 PLANEADO |
| [237](237-bandeja-comite-consolidacion/spec.md) | Feature Specification: SPEC-237 — Bandeja comité CONSOLIDACION + vista + aprobación multi-miembro | 🔵 PLANEADO |
| [238](238-aclaracion-padre-comite/spec.md) | Feature Specification: SPEC-238 — Aclaración padre-comité (1 iteración máx) | 🔵 PLANEADO |
| [239](239-escalacion-rojo-contacto-emergencia/spec.md) | Feature Specification: SPEC-239 — Escalación ROJO + SLA 12h + Contacto emergencia | 🟢 IMPLEMENTADO |
| [240](240-registro-colegio-activar/spec.md) | Feature Specification: Registro público de colegio + /activar por token + rediseño admin pre-registro (fix BUG-01) | 🔵 PLANEADO |
| [241](241-consentimiento-modal-audit/spec.md) | Feature Specification: Middleware consentimiento + modal legal + AuditConsentimiento | 🟢 IMPLEMENTADO |
| [242](242-middleware-vigencia/spec.md) | Feature Specification: Middleware de vigencia + guardas por layout + banner ámbar EN_GRACIA | 🟢 IMPLEMENTADO |
| [243](243-crud-admin-planes/spec.md) | Feature Specification: CRUD admin de Planes + parámetros IVA/freemium desde UI + seed 4 planes por rol | 🟢 IMPLEMENTADO |
| [244](244-suscripcion-vista-planes/spec.md) | Feature Specification: Vista `/suscripcion` enriquecida + PlanesSelector + ConfirmarPagoManual + endpoints solicitar-plan/freemium | 🔵 PLANEADO |
| [245](245-admin-activar-manual/spec.md) | Feature Specification: Admin activar suscripción manual + captura pago manual + tab "Sin suscripción" | 🔵 PLANEADO |
| [246](246-bonos-recompensa/spec.md) | Feature Specification: Extensión `BonoPromocional` recompensa + cupones transferibles + MisCuponesCard | 🔵 PLANEADO |
| [247](247-refresh-dedup-arch/spec.md) | Feature Specification: Refresh silencioso + dedup reglas notif + deprecar campos legacy + regenerar arch | 🔵 PLANEADO |
| [248](248-categorias-ley-2564/spec.md) | Feature Specification: SPEC-248 — Categorías Ley 2564 completas + Definiciones legales editables | 🔵 PLANEADO |
| [249](249-hotfix-public-routes-registro-colegio-activar/spec.md) | Feature Specification: Hotfix — PUBLIC_ROUTES debe incluir /registro-colegio y /activar | 🟡 DESARROLLO |
| [250](250-consentimiento-loop-hotfix/spec.md) | Feature Specification: Hotfix — evitar loop infinito en /consentimiento | 🟡 DESARROLLO |
| [251](251-guardian-indices-i49/spec.md) | Feature Specification: Guardián de índices (cierra I-49) | ✅ FINALIZADO |
| [254](254-contrato-precio-cop/spec.md) | Feature Specification: SPEC-254 — Contrato de precio en COP (I-126) | 🔵 PLANEADO |
| [255](255-scroll-highlight-plan-edit/spec.md) | Feature Specification: SPEC-255 — Scroll y resaltado al editar plan (I-123) | 🔵 PLANEADO |
| [256](256-pagos-server-dal/spec.md) | Feature Specification: SPEC-256 — Pantallas Pagos leen del DAL, con errores visibles (I-127) | 🔵 PLANEADO |
| [257](257-bonos-filtro-cliente/spec.md) | Feature Specification: SPEC-257 — Filtro de bonos a componente cliente (I-125) | 🔵 PLANEADO |
| [258](258-plantillas-onboarding-colegio/spec.md) | Feature Specification: SPEC-258 — Plantillas de correo del onboarding de colegio (I-124) | 🔵 PLANEADO |
| [259](259-puerta-entrada-familia-colegio/spec.md) | Feature Specification: SPEC-259 — Puerta de entrada: selección familia / colegio (I-117) | 🔵 PLANEADO |
| [260](260-tests-humo-pagos/spec.md) | Feature Specification: SPEC-260 — Tests de humo de las 4 pantallas de Pagos (SC-010) | 🔵 PLANEADO |
| [261](261-ciclo-operador-estados/spec.md) | Feature Specification: Estados de carga del operador — `ESTADOS_CARGA_OPERADOR` | 🟡 DESARROLLO |
| [262](262-panel-spam-motivo/spec.md) | Feature Specification: Panel de spam — confianza real + motivo de ingreso | 🟡 DESARROLLO |
| [263](263-permisos-operador/spec.md) | Feature Specification: Barrido de permisos — operador limpio, revelación auditada | 🟡 DESARROLLO |
| [264](264-sla-spam/spec.md) | Feature Specification: SLA de spam — 48 h configurable con aviso al ADMIN | 🟡 DESARROLLO |
| [265](265-scripts-limpieza/spec.md) | SPEC-265 — Scripts reutilizables de limpieza de data de prueba | 🟢 IMPLEMENTADO |
| [266](266-hotfix-grants-comite/spec.md) | SPEC-266 — Hotfix grants COMITE_VALIDACION | 🟢 IMPLEMENTADO |
| [280](280-resumen-legible-ci/spec.md) | Feature Specification: SPEC-280 — Resumen legible al final de cada corrida de CI (SC-007) | 🔵 PLANEADO |
| [281](281-reparto-shards-por-peso/spec.md) | Feature Specification: SPEC-281 — Reparto de las 4 partes por peso medido (SC-002) | 🔵 PLANEADO |
| [282](282-reset-selectivo-tablas/spec.md) | Feature Specification: SPEC-282 — `resetDatabase()` selectivo por tablas (SC-004) | 🔵 PLANEADO |
| [283](283-migrar-archivos-caros-beforeall/spec.md) | Feature Specification: SPEC-283 — Migrar los 8 archivos más caros a `beforeAll` + reset selectivo (SC-001, SC-003, SC-004, SC-009) | 🔵 PLANEADO |
| [284](284-ids-advisory-lock-i130-i137/spec.md) | Feature Specification: IDs de advisory lock únicos (cierra I-130, I-137) | 🔵 PLANEADO |
| [285](285-borrar-modulos-muertos/spec.md) | SPEC-285 — Borrar 3 módulos muertos + revocación explícita | 🟢 IMPLEMENTADO |
| [286](286-quitar-consulta-public-routes/spec.md) | Feature Specification: Quitar `/consulta` de PUBLIC_ROUTES (cierra I-136) | 🔵 PLANEADO |
| [287](287-ratchet-vigencia-middleware/spec.md) | Feature Specification: Ratchet estructural — guardián de vigencia en `middleware.ts` (cierra I-25, I-111, I-141) | 🔵 PLANEADO |
| [288](288-seed-e2e-multi-tenant/spec.md) | SPEC-288 — Seed E2E multi-tenant | 🟢 IMPLEMENTADO |
| [289](289-cop-fuente-unica-fase-1/spec.md) | Feature Specification: Peso colombiano como fuente única de precio (Fase 1) — desbloquea cobro real (cierra I-126) | 🔵 PLANEADO |
| [290](290-levantar-worker-sesiones/spec.md) | Feature Specification: SPEC-290 — Levantar `worker-sesiones` como servicio del stack (SC-A28) | 🔵 PLANEADO |
| [291](291-instrumentacion-acciones-servicios/spec.md) | SPEC-291 — Instrumentación de vida + acciones admin sobre servicios | 🟢 IMPLEMENTADO |
| [292](292-fix-emails-suscripcion-quiethours/spec.md) | Feature Specification: Fix worker de notificaciones — polling silenciado (cierra I-147) | 🔵 PLANEADO |
| [293](293-fix-seed-freemium-padre-colegio/spec.md) | Feature Specification: SPEC-293 — Fix seed freemium PADRE+COLEGIO (I-156) | 🔵 PLANEADO |
| [294](294-deploy-lento/spec.md) | SPEC-294 — Deploy lento · reducir 9m30s → <5min | 🟢 IMPLEMENTADO |
| [295](295-padre-autenticado-reportar/spec.md) | Feature Specification: Padre autenticado puede reportar (cierra I-146) | 🔵 PLANEADO |
| [296](296-email-ts-al-motor-notificaciones/spec.md) | Feature Specification: SPEC-296 — Migrar `email.ts` al Motor de Notificaciones (I-152) | 🔵 PLANEADO |
| [297](297-fix-panel-admin-ia-simulacion/spec.md) | SPEC 297 — Fix Panel Admin IA + Simulación (002-PI-300) | 🟡 DESARROLLO |
| [298](298-fix-i163-rubrica-modelo/spec.md) | SPEC 298 — Fix I-163: rúbrica respeta `modeloClasificacion` (002-PI-201) | 🟢 IMPLEMENTADO |
| [299](299-sentinels-ci-multi-producto/spec.md) | Feature Specification: Sentinels CI multi-producto | 🟢 IMPLEMENTADO |
| [300](300-fix-sentinel-cross-producto/spec.md) | Feature Specification: Fix sentinel CI cross-producto (SPEC-300) | 🔵 PLANEADO |
| [302](302-deuda-motor-notificaciones/spec.md) | Feature Specification: Deuda motor notificaciones (métrica + ratchet + logger) | 🟢 IMPLEMENTADO |
| [303](303-ficha-colegio-cimiento/spec.md) | Feature Specification: Ficha colegio admin · Fase 1 · Cimiento de datos + semáforo declarado (SPEC-303) | 🔵 PLANEADO |
| [305](305-semaforo-circulo-confianza/spec.md) | Feature Specification: Semáforo por hijo/familiar del círculo de confianza | 🟢 IMPLEMENTADO |
| [306](306-timeline-eventos-circulo/spec.md) | Feature Specification: Timeline de eventos del círculo de confianza | 🟢 IMPLEMENTADO |
| [307](307-sugerencia-proactiva-padre/spec.md) | Feature Specification: Sugerencia proactiva para el área del padre | 🟢 IMPLEMENTADO |
| [308](308-notificacion-enriquecida-circulo/spec.md) | Feature Specification: Notificación enriquecida de Círculo de Confianza | 🔵 PLANEADO |
| [309](309-home-padre-proactivo/spec.md) | Feature Specification: Home dashboard proactivo del área padre | 🟢 IMPLEMENTADO |
| [310](310-puente-sesion-bi-link/spec.md) | Feature Specification: Puente de sesión PI→BI (endpoint /api/auth/link-bi) | 🟢 IMPLEMENTADO |
| [311](311-ficha-colegio-rediseno/spec.md) | Feature Specification: Ficha colegio admin · Fase 2 · Rediseño 4 bloques A→D (SPEC-311) | 🔵 PLANEADO |
| [312](312-quiet-hours-skip-email/spec.md) | Feature Specification: Quiet hours no aplica a EMAIL ni IN_APP | 🟢 IMPLEMENTADO |
| [313](313-hotfix-link-bi-host/spec.md) | Feature Specification: Hotfix — link-bi redirect usa host público real | 🟢 IMPLEMENTADO |
| [315](315-fix-reset-password-flag/spec.md) | Feature Specification: Fix reset password no limpia `debeCambiarPassword` (SPEC-315) | 🔵 PLANEADO |
| [317](317-unificar-area-padre/spec.md) | SPEC-317 · Unificar el área del padre (002-PI-217) | 🟡 DESARROLLO |
| [318](318-tres-porteros-apagados/spec.md) | SPEC-318 · Los tres porteros apagados | 🟡 DESARROLLO |
| [319](319-comite-convivencia-operativo/spec.md) | Feature Specification: El comité de convivencia, operativo | 🟡 DESARROLLO |
| [320](320-identificadores-integridad-identidad/spec.md) | Feature Specification: Identificadores — integridad + identidad (A-58 · SPEC-A) | 🟢 IMPLEMENTADO |
| [321](321-profesores-pulido/spec.md) | SPEC-321 · Pulido de la pantalla de profesores (SPEC-B de A-58) · 002-PI-221 | 🟢 IMPLEMENTADO |
| [322](322-aviso-cambio-contrasena/spec.md) | SPEC-322 · Aviso por correo cuando cambia la contraseña | 🟡 DESARROLLO |
| [323](323-expediente-padre-nucleo/spec.md) | Feature Specification: El expediente del padre · NÚCLEO | 🟡 DESARROLLO |
| [325](325-protejo-vigilo-nucleo/spec.md) | SPEC-325 · A quién protejo, a quién vigilo · NÚCLEO | 🟡 DESARROLLO |
| [326](326-lenguaje-padre/spec.md) | Feature Specification: Cómo le habla PI al padre (parte independiente) | 🟡 DESARROLLO |
| [329](329-middleware-api-json-guardias/spec.md) | Feature Specification: Middleware — JSON 403 en guardianes de estado para /api/ (SPEC-329) | 🟢 IMPLEMENTADO |
| [330](330-rol-reglas-notificacion-enum/spec.md) | SPEC-330 · Rol de reglas de notificación = enum RolUsuario (padre) · 002-PI-230 | 🟢 IMPLEMENTADO |
| [331](331-vigencia-colegio-cookie/spec.md) | SPEC-331 · Hotfix vigencia cookie sesion_estado — derivación por rol | 🟡 DESARROLLO |
| [333](333-identidad-regla-notificacion-rol/spec.md) | SPEC-333 · La regla de notificación distingue el rol (I-223) · 002-PI-233 · A-63 | 🟢 IMPLEMENTADO |
| [334](334-perfil-padre-datos/spec.md) | Feature Specification: El padre registra los datos de su perfil | 🟡 DESARROLLO |
| [336](336-marca-el-guardian/spec.md) | SPEC-336 · La marca "El Guardián" en el header + favicon | 🟢 IMPLEMENTADO |
| [337](337-cookie-vigencia-freemium/spec.md) | SPEC-337 · Activar freemium re-sella `sesion_estado` (I-227) · 002-PI | 🟢 IMPLEMENTADO |
| [338](338-registro-email-existe/spec.md) | SPEC-338 · Registro avisa "ya tenés una cuenta" (I-226) | 🟢 IMPLEMENTADO |
| [339](339-camino-guiado-padre/spec.md) | SPEC-339 · El camino guiado del padre (A-67 · Fase 1) | 🟡 DESARROLLO |
| [340](340-mis-reportes-expediente/spec.md) | SPEC-340 · Mis reportes y el expediente · el hilo (A-68 · Fase 1) | 🟢 IMPLEMENTADO |
| [341](341-inteligencia-expediente/spec.md) | Feature Specification: SPEC-341 · La inteligencia del expediente (análisis IA en fila) | 🟡 DESARROLLO |
| [343](343-documentos-legales-publicos/spec.md) | Feature Specification: Documentos legales públicos limpios | 🟢 IMPLEMENTADO |
| [344](344-camino-guiado-colegio/spec.md) | SPEC-344 · El camino guiado del colegio (A-69 · Fase C1) | 🟢 IMPLEMENTADO |
| [350](350-caso-colegio/spec.md) | Feature Specification: SPEC-350 · El caso del colegio estilo expediente + análisis IA compartido (A-69 · C3) | 🟡 DESARROLLO |
| [351](351-informe-firmado-rector/spec.md) | Feature Specification: SPEC-351 · El informe firmado del rector (A-69 · C5) | 🟡 DESARROLLO |
| [353](353-puesto-mando-colegio/spec.md) | SPEC-353 · El puesto de mando del rector (A-69 · Fase C6) | 🟢 IMPLEMENTADO |
| [354](354-should-skip-analisis/spec.md) | SPEC-354 · Análisis del "verde falso" en PRs (should-skip / checks ausentes) | 📁 CERRADA |
| [357](357-salida-colegio-vencido/spec.md) | SPEC-357 · El colegio que vence a mitad del camino no queda encerrado (I-254) | 🟢 IMPLEMENTADO |
| [358](358-b3-consentimiento-no-avanza/spec.md) | SPEC-358 · B3 · "Acepto" del consentimiento no avanza (A-70 · tanda 1) | 🟢 IMPLEMENTADO |
| [360](360-analisis-real-bitacora/spec.md) | SPEC-360 · A-70 tanda 2 — Análisis real, bitácora del menor y detalles del expediente | 🟢 IMPLEMENTADO |
| [361](361-camino-validaciones-mensajes/spec.md) | SPEC-361 · A-70 tanda 2 · Formularios del camino: mensajes, cupo y validaciones (F4–F9) | 🟢 IMPLEMENTADO |
| [362](362-forma-planes-listo-menu-pie/spec.md) | SPEC-362 · A-70 tanda 2 · Forma y guía (G13–G17, G21) + I-256 + voseo | 🟢 IMPLEMENTADO |
| [363](363-hijos-estado-cupo-bitacora/spec.md) | SPEC-363 · El PATCH de estado del menor pasa por cambiarEstadoHijo (BUG1 + BUG2) | 🟢 IMPLEMENTADO |
| [364](364-rafaga-por-origen/spec.md) | SPEC-364 · A-72 — La ráfaga cuenta por ORIGEN, no por la cuenta reportada | 🟢 IMPLEMENTADO |
| [365](365-fuente-reporte-prisma/spec.md) | SPEC-365 · I-263 — La señal de fuente anti-abuso nunca se guardaba en producción | 🟢 IMPLEMENTADO |
| [366](366-duplicado-hereda-clasificacion/spec.md) | SPEC-366 · A-71 — El duplicado refleja el estado VIVO del original | 🟢 IMPLEMENTADO |
| [367](367-circulo-confianza-redisenio/spec.md) | SPEC-367 · A-73 — Tu círculo de confianza (rediseño G12) | 🟢 IMPLEMENTADO |
| [368](368-pulido-pendientes/spec.md) | SPEC-368 · A-74 — Lote de pulido (pendientes chicos) | 🟢 IMPLEMENTADO |
| [369](369-poblador-demo-v2/spec.md) | SPEC-369 · Poblador demo v2 — volumen con variedad real para BI | 🟢 IMPLEMENTADO |
| [370](370-circulo-detalle/spec.md) | SPEC-370 · Círculo — el nombre y el mapa dentro de la persona | 🟢 IMPLEMENTADO |
| [371](371-poblador-demo-v3/spec.md) | SPEC-371 · Poblador demo v3 — capa de gestión humana para BI | 🟢 IMPLEMENTADO |
| [373](373-guardianes-alertas-informes/spec.md) | SPEC-373 · Guardianes desalineados · alertas del colegio (I-251) e informes del rector (I-266) | 🟢 IMPLEMENTADO |
| [374](374-ci-skip-bi-only/spec.md) | SPEC-374 · CI de PI salta cuando el PR no lo toca | 🟢 IMPLEMENTADO |
| [375](375-shard-integracion-colgado/spec.md) | SPEC-375 · El shard de integración se cuelga 40 min | 🟢 IMPLEMENTADO |
| [378](378-inicio-administrador/spec.md) | SPEC-378 · Inicio del administrador | 🟢 IMPLEMENTADO |
| [379](379-decisiones-colegio-medias-a/spec.md) | SPEC-379 (PR A) · Decisiones del colegio a medias — quick wins | 🟢 IMPLEMENTADO |
| [380](380-comite-analisis-recomendacion/spec.md) | SPEC-380 (PR A · C4) · Análisis del comité + recomendación de emitir informe | 🟢 IMPLEMENTADO |
| [381](381-inicio-admin-rutas-y-comite/spec.md) | SPEC-381 · Rutas del Inicio del admin (I-269) + candado del menú honesto + log defensivo del comité (I-270) | 🟢 IMPLEMENTADO |
| [383](383-i277-enum-accion-audit-alertas/spec.md) | SPEC-383 · I-277 · enum AccionAudit con COLEGIO_ALERTA_ASIGNADA + quitar los `as AccionAudit` que silenciaban al compilador | 🟢 IMPLEMENTADO |
| [384](384-comite-abrir-caso-guardia/spec.md) | SPEC-384 · El comité no puede abrir NINGÚN caso (I-278 · I-279) | 🟢 IMPLEMENTADO |
| [387](387-candado-alerta-revision-spam/spec.md) | SPEC-387 · I-280 · Candado de repetición en el correo de SLA de spam | 🟢 IMPLEMENTADO |
| [388](388a-red-profesionales-modelo/spec.md) | SPEC-388a · Red de Profesionales · L1a — solo modelo y migración | 🟢 IMPLEMENTADO |
| [389](389-red-profesionales-l2-verificacion-idc/spec.md) | SPEC-389 · Red de Profesionales · L2 — IDC verifica | 🟡 DESARROLLO |
| [390](390-comite-integrantes-monitor/spec.md) | SPEC-390 (PR B de SPEC-380 · C4/D-100) · Integrantes del comité monitoreados | 🟢 IMPLEMENTADO |
| [391](391-registro-profesional/spec.md) | SPEC-391 · Red de Profesionales · L1b — el profesional se registra | 🟢 IMPLEMENTADO |
| [392](392-directorio-profesionales-padre/spec.md) | SPEC-392 · L3 · Directorio de profesionales — la vista del padre | 🟢 IMPLEMENTADO |
| [395](395-cita-profesional/spec.md) | SPEC-395 · Red de Profesionales · L4 — la cita (agendar, pagar, confirmar, reprogramar) | 🟢 IMPLEMENTADO |
| [396](396-ci-concurrency/spec.md) | SPEC-396 · `concurrency` en los flujos de CI · causa raíz de I-282 | 🟢 IMPLEMENTADO |
| [401](401-motivo-real-resend/spec.md) | SPEC-401 · I-283 — guardar el motivo real del proveedor de correo | 🟡 DESARROLLO |
| [402](402-webhook-resend-allowlist/spec.md) | SPEC-402 · Webhook de Resend en la allowlist del middleware — cierra I-289 | 🟢 IMPLEMENTADO |
| [403](403-comision-parametrizable/spec.md) | SPEC-403 · La comisión de la red es un parámetro — cierra I-288 | 🟢 IMPLEMENTADO |
| [404](404-bandeja-admin-inalcanzable/spec.md) | SPEC-404 · Bandeja de reportes con URL propia — cierra I-290 | 🟢 IMPLEMENTADO |
| [407](407-shard-no-libera-event-loop/spec.md) | SPEC-407 · I-282 — el shard de test-integration no libera el event loop | 🟡 DESARROLLO |
| [408](408-verificador-red-apoyo/spec.md) | SPEC-408 · Red de Apoyo · el Verificador admite al profesional y atiende incidentes | 🟢 IMPLEMENTADO |
| [412](412-poblador-marca-lo-que-siembra/spec.md) | SPEC-412 · El poblador que marca lo que siembra — cierra I-271, I-292 y el hueco de siembra de A-75 | 🟢 IMPLEMENTADO |
| [413](413-readme-specs-generado/spec.md) | SPEC-413 · Índice de specs generado, no escrito a mano | 🟡 DESARROLLO |
| [414](414-inicio-admin-separa-sembrado/spec.md) | SPEC-414 · El Inicio del admin separa lo sembrado de lo real — cierra I-271 y I-294 | 🟢 IMPLEMENTADO |
| [415](415-errores-que-no-se-tragan/spec.md) | SPEC-415 · Los errores que se tragaban a alguien — 5 avisos de seguridad + 3 pantallas que mentían | 🟢 IMPLEMENTADO |
| [416](416-consentimiento-solo-titulares/spec.md) | SPEC-416 · El consentimiento se le pide solo a titulares del dato — cierra I-118 | 🟢 IMPLEMENTADO |
| [418](418-aviso-devolucion-auditado/spec.md) | SPEC-418 · El aviso de devolución al profesional no se pierde — cierra I-295 | 🟢 IMPLEMENTADO |
| [419](419-reglas-correo-profesional/spec.md) | SPEC-419 · El psicólogo puede recibir su enlace de registro — cierra I-296 | 🟢 IMPLEMENTADO |
| [420](420-borrado-por-lotes/spec.md) | SPEC-420 · El borrado por lotes — PostgreSQL admite 32.767 parámetros, producción tenía 37.176 | 🟢 IMPLEMENTADO |
| [421](421-gestion-profesionales-admin/spec.md) | SPEC-421 · El admin gestiona psicólogos igual que gestiona padres (mirror `/admin/padres`) + reenvía solicitudes de registro cuando el correo se cae | 🟢 IMPLEMENTADO |
| [422](422-registro-profesional-publico/spec.md) | SPEC-422 · «Soy profesional» era un enlace muerto — cierra I-297 | 🟢 IMPLEMENTADO |
| [423](423-credencial-siempre-visible/spec.md) | SPEC-423 · La credencial de respaldo se muestra SIEMPRE — cierra I-298 | 🟢 IMPLEMENTADO |
| [424](424-aterrizaje-profesional/spec.md) | SPEC-424 · El profesional aterriza donde le corresponde y no ve el menú del padre — cierra I-299 | 🟢 IMPLEMENTADO |
| [425](425-panel-profesional/spec.md) | SPEC-425 · El panel del profesional (A-75 · lote L5) | 🟢 IMPLEMENTADO |
| [426](426-proxy-profesional-lista-blanca/spec.md) | SPEC-426 · PROFESIONAL en lista blanca del proxy — candado bidireccional | 🟢 IMPLEMENTADO |
| [428](428-padre-agenda-cita/spec.md) | SPEC-428 · El padre agenda una cita con un profesional — brief A-75 v2.1 §9 | 🟢 IMPLEMENTADO |
| [431](431-franja-nocturna-payload/spec.md) | SPEC-431 · La franja horaria le mentía al modelo — cierra I-247 b | 🟢 IMPLEMENTADO |
| [432](432-generados-sin-conflicto/spec.md) | SPEC-432 · Los archivos generados dejan de ser terreno de conflicto | 🟢 IMPLEMENTADO |
| [432](432b-artefactos-arquitectura-sin-conflicto/spec.md) | SPEC-432b · Los artefactos de arquitectura dejan de ser terreno de conflicto | 🟢 IMPLEMENTADO |
| [434](434-ficha-profesional-usable/spec.md) | SPEC-434 · La ficha del profesional, usable de verdad — cierra I-302 | 🟢 IMPLEMENTADO |
| [435](435-cuentas-verificador/spec.md) | SPEC-435 · Cuentas de VERIFICADOR — el admin las crea con user y pass | 🟢 IMPLEMENTADO |
| [436](436-documentos-del-profesional/spec.md) | SPEC-436 · Los documentos del profesional: se cargan, se guardan y SE PUEDEN LEER | 🟢 IMPLEMENTADO |
| [437](437-menu-y-modulos-del-profesional/spec.md) | SPEC-437 · El profesional trabaja con menú lateral, como el operador | 🟢 IMPLEMENTADO |
| [438](438-fecha-hora-obligatorias/spec.md) | SPEC-438 · La fecha y la hora del hecho son obligatorias, y el sistema nunca las inventa | 🟢 IMPLEMENTADO |
| [439](439-corroboracion-y-aviso-al-padre/spec.md) | SPEC-439 · El aviso al padre cuando alguien más reporta lo mismo | 🟢 IMPLEMENTADO |
| [440](440-area-del-padre/spec.md) | SPEC-440 · Correcciones del área del padre — punto 1 primero (I-306) + puntos 2/4/5 (ola 2) | 🟢 IMPLEMENTADO |
| [441](441-directorio-profesional/spec.md) | SPEC-441 · La tarjeta del profesional presenta a la persona, y el precio deja de estar mal | 🟢 IMPLEMENTADO |
| [442](442-camino-colegio/spec.md) | SPEC-442 · El camino del colegio, sin callejones — cierra I-307 | 🟢 IMPLEMENTADO |
| [444](444-identificadores-cuid/spec.md) | SPEC-444 · Los identificadores del padre se validaban como uuid — cierra I-310 | 🟢 IMPLEMENTADO |
| [447](447-calendario-del-profesional/spec.md) | SPEC-447 · El profesional publica su disponibilidad — cierra I-311 | 🟢 IMPLEMENTADO |
| [449](449-vencimiento-verificacion/spec.md) | SPEC-449 · La verificación vencida saca al profesional del directorio — cierra I-313 | 🟢 IMPLEMENTADO |
| [450](450-shards-y-margen-de-ci/spec.md) | SPEC-450 · El margen de CI contra el techo de 45 minutos — cierra I-282 | 🟢 IMPLEMENTADO |
| [454](454-button-sistema-diseno/spec.md) | SPEC-454 · OLA 1 del rediseño — el Button al Sistema de Diseño | 🟢 IMPLEMENTADO |
| [455](455-dashboard-publico-sin-rojo/spec.md) | SPEC-455 · «Cara» del rediseño: el dashboard público sin alarma | 🟢 IMPLEMENTADO |
| [456](456-portada/spec.md) | SPEC-456 · «Cara» del rediseño: la portada (la puerta de entrada) | 🟢 IMPLEMENTADO |
| [463](463-colegio-voz-usted/spec.md) | SPEC-463 · La voz del colegio a «usted» (D-107 de Jelkin) | 🟢 IMPLEMENTADO |
<!-- SPEC-413:END tabla -->
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
| [243](243-crud-admin-planes/spec.md) | SPEC-243 — CRUD admin de Planes + parámetros IVA/freemium (002-PI-146) | 🟢 Implementado |
| [249](249-hotfix-public-routes-registro-colegio-activar/spec.md) | SPEC-249 — Hotfix PUBLIC_ROUTES /registro-colegio + /activar (002-PI-152) | 🔴 Crítica |
| [250](250-consentimiento-loop-hotfix/spec.md) | SPEC-250 — Hotfix loop /consentimiento (002-PI-153) | 🔴 Crítica |
| [244](244-suscripcion-vista-planes/spec.md) | SPEC-244 — Vista `/suscripcion` + PlanesSelector + ConfirmarPagoManual + freemium (002-PI-147) | 🔵 Planeado |
| [245](245-admin-activar-manual/spec.md) | SPEC-245 — Admin activar suscripción manual + captura pago (002-PI-148) | 🔵 Planeado |
| [246](246-bonos-recompensa/spec.md) | SPEC-246 — Bonos recompensa transferibles + MisCuponesCard (002-PI-149) | 🔵 Planeado |
| [247](247-refresh-dedup-arch/spec.md) | SPEC-247 — Refresh + dedup + deprecar + arch (002-PI-150) | 🔵 Planeado |
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
| [241](241-consentimiento-modal-audit/spec.md) | SPEC-241 · Consentimiento informado + modal legal + AuditConsentimiento (002-PI-144) | 🟢 Implementado |
| [309](309-home-padre-proactivo/spec.md) | SPEC-309 · Home dashboard proactivo del área padre (A-50) | 🔵 Planeado |
| [305](305-semaforo-circulo-confianza/spec.md) | SPEC-305 · Semáforo por hijo/familiar del círculo de confianza (A-50) | 🟢 Implementado |
| [306](306-timeline-eventos-circulo/spec.md) | SPEC-306 · Timeline eventos del círculo de confianza (A-50) | 🟢 Implementado |
| [307](307-sugerencia-proactiva-padre/spec.md) | SPEC-307 · Sugerencia proactiva para padres (A-50) | 🟢 Implementado |
| [308](308-notificacion-enriquecida-circulo/spec.md) | SPEC-308 · Notificación enriquecida del círculo de confianza (A-50) | 🔵 Planeado |
| [311](311-ficha-colegio-rediseno/spec.md) | SPEC-311 · Ficha colegio admin Fase 2 · Rediseño 4 bloques A→D (002-PI-210 · cierra I-98) | 🔵 Planeado |
| [317](317-unificar-area-padre/spec.md) | SPEC-317 · Unificar el área del padre — zona canónica /dashboard/padre (002-PI-217) | 🟡 En desarrollo |
| [318](318-tres-porteros-apagados/spec.md) | SPEC-318 · Los tres porteros apagados — cookie sesion_estado + guardas activos (002-PI-218) | 🟡 En desarrollo |
| [322](322-aviso-cambio-contrasena/spec.md) | SPEC-322 · Aviso por correo cuando cambia la contraseña (002-PI-222) | 🟡 En desarrollo |
| [323](323-expediente-padre-nucleo/spec.md) | SPEC-323 · El expediente del padre · NÚCLEO (002-PI-223) | 🟡 En desarrollo |
| [326](326-lenguaje-padre/spec.md) | SPEC-326 · Cómo le habla PI al padre · notificaciones en frases + perfil/cambio-correo + país-ciudad + menú (002-PI-226 · A-62 · cierra I-220) | 🟡 En desarrollo |
| [334](334-perfil-padre-datos/spec.md) | SPEC-334 · El padre registra los datos de su perfil · 6 campos (nombres/apellidos/fecha nac/país/ciudad/teléfono) + migración Usuario (prioridad CEO directa) | 🟡 En desarrollo |
| [325](325-protejo-vigilo-nucleo/spec.md) | SPEC-325 · A quién protejo, a quién vigilo · núcleo (002-PI-225 · A-61) — modelo Hijo + arreglo ContactoConfianza + mecanismo de monitoreo compartido | 🟡 En desarrollo |
| [339](339-camino-guiado-padre/spec.md) | SPEC-339 · El camino guiado del padre (A-67 · Fase 1) — registro por enlace + camino obligatorio de 4 pasos no salteable + tope de menores parametrizado + un menor por padre + cruce identificador-hijo→aviso | 🟡 En desarrollo |
| [340](340-mis-reportes-expediente/spec.md) | SPEC-340 · Mis reportes y el expediente · el hilo (A-68 · Fase 1) — tarjeta por cadena + evento sin repetir datos + análisis explicado + step-up del texto + expediente por botón (nada se cierra) + mapa con historia + informes con sello | 🟢 Implementado |
| [343](343-documentos-legales-publicos/spec.md) | SPEC-343 · Documentos legales públicos limpios (I-232) — política y convenio v1.0 sin notas internas + render markdown seguro en el modal + borradores fuera de public/ + test-candado | 🟡 En desarrollo |
| [341](341-inteligencia-expediente/spec.md) | SPEC-341 · La inteligencia del expediente · análisis IA en fila (A-68 §4.4 capa 2) — genera al abrir-si-cambió + corte inmutable + Actualizar con cool-down + tubería reutilizable con `alcance` PADRE_COMPLETO / COLEGIO_BLINDADO | 🟢 Implementada |
| [370](370-circulo-detalle/spec.md) | SPEC-370 · Círculo — el detalle mostraba "Sin nombre" (el endpoint no devolvía `nombre`) y faltaba el mapa dentro de la persona (dependía de coordenadas); además el mapa compartido gana paleta sin rojo para el área del padre | 🟡 En desarrollo |
| [371](371-poblador-demo-v3/spec.md) | SPEC-371 · Poblador demo v3 — capa de gestión para BI: operarios del colegio con alertas asignadas (reparto desigual, ~70 %), ciclo de vida transitado con tiempos escalonados y solicitudes al comité abiertas/resueltas; marca `demo3-` disjunta y reversible, cero toque a filas reales | 🟡 En desarrollo |
| [373](373-guardianes-alertas-informes/spec.md) | SPEC-373 · Guardianes desalineados — I-251 (quitar guard de vigencia de los 7 sitios en /api/colegio/alertas: las alertas de menores nunca se bloquean) + I-266 (agregar guard al POST /api/colegio/casos/[id]/informes: un colegio vencido NO puede EMITIR informe forense verificable; lectura y verificación pública siguen abiertas) | 🟡 En desarrollo |
| [367](367-circulo-confianza-redisenio/spec.md) | SPEC-367 · A-73 — rediseño G12 del círculo de confianza sobre el mockup aprobado: "A quién vigilo" + "Tu círculo de confianza", vacío = primer paso, tarjetas verde/ámbar/gris (nunca rojo), agregar en 3 preguntas sin jerga y las estadísticas DENTRO de cada persona | 🟡 En desarrollo |
| [368](368-pulido-pendientes/spec.md) | SPEC-368 · A-74 — lote de pulido: candado de la plantilla del camino guiado, control amable de fecha (día + hora 1-12 + a.m./p.m., sin minutos) conservando los candados de B1, I-261 en el detalle del admin, "Duplicado — sin acción" en la bandeja y borrado de código huérfano | 🟡 En desarrollo |
| [369](369-poblador-demo-v2/spec.md) | SPEC-369 · Poblador demo v2 — ~2.000 reportes con variedad real para BI: fechas repartidas en 2024/2025/2026, países y plataformas variados, relatos creíbles por categoría con las sensibles más pesadas; marca `demo2-` disjunta del v1 y reversible | 🟡 En desarrollo |
| [366](366-duplicado-hereda-clasificacion/spec.md) | SPEC-366 · A-71 — el duplicado refleja el estado VIVO del original (reporteOrigenId) en tiempo de lectura: el reportante ve "Procesado" + la categoría del original, nunca un "en proceso" que no llega; estado sigue DUPLICADO (señal lo excluye igual, 0 migración); invariante anónimo blindada | 🟡 En desarrollo |
| [365](365-fuente-reporte-prisma/spec.md) | SPEC-365 · I-263 — FuenteReporte con 0 filas en prod: `crearFuenteReporte` lanzaba `prisma is not defined` (global sin importar, ausente en producción) tragado por la ruta; se borra la variable muerta `tx ?? prisma`. Destapa toda la señal anti-abuso y activa A-72 | 🟡 En desarrollo |
| [364](364-rafaga-por-origen/spec.md) | SPEC-364 · A-72 — la ráfaga cuenta por ORIGEN (ipHash ya capturado en FuenteReporte), no por el nick reportado: varias personas corroborando la misma cuenta dejan de marcarse como ráfaga; sin migración | 🟡 En desarrollo |
| [363](363-hijos-estado-cupo-bitacora/spec.md) | SPEC-363 · El PATCH de estado del menor pasa por cambiarEstadoHijo — BUG1 (cupo burlable al reactivar → 409) + BUG2 (bitácora anota pausar/reactivar: audita {estado}, no {campos}); tope y texto en una sola fuente | 🟡 En desarrollo |
| [362](362-forma-planes-listo-menu-pie/spec.md) | SPEC-362 · A-70 G13-G17/G21 + I-256 — el 201 del consentimiento ahora mueve la pantalla; planes sin jerga técnica ni tarjetas encimadas; "Listo" con tarjetas; señal de scroll; menú apagado en el camino; verde/gris; pie con versión del build | 🟡 En desarrollo |
| [361](361-camino-validaciones-mensajes/spec.md) | SPEC-361 · A-70 F4-F9 — errores que nombran el campo, tope por menores ACTIVOS (inactivar libera cupo, el sistema nunca inactiva), contador visible, documento validado por tipo y edad en vez de año | 🟡 En desarrollo |
| [358](358-b3-consentimiento-no-avanza/spec.md) | SPEC-358 · A-70 · B3 — "Acepto" del consentimiento no avanzaba: el gate del botón dependía de un IntersectionObserver que no dispara; medida directa del scroll + resguardos, con tests de observer mudo | 🟡 En desarrollo |
| [360](360-analisis-real-bitacora/spec.md) | SPEC-360 · A-70 tanda 2 — análisis real del motor en Mis reportes (F11), bitácora del menor sin modelo nuevo (F10), encuadre del mapa (G18), velocidad de la simulación (G19) y hora en punto del hecho (G20) | 🟡 En desarrollo |
| [357](357-salida-colegio-vencido/spec.md) | SPEC-357 · El colegio que vence a mitad del camino no queda encerrado (I-254) — la caja siempre abierta + criterio único de "vigente" (estado Y fecha) + las 5 familias del camino no se cierran por vigencia mientras quede un paso | 🟡 En desarrollo |
| [354](354-should-skip-analisis/spec.md) | SPEC-354 · Análisis del "verde falso" en PRs — causa raíz: PR CONFLICTING no dispara workflows de pull_request (checks ausentes ≠ checks verdes); cerrada sin cambio de código, control = gate del CEO "checks de PI presentes" | ⚫ Cerrada |
| [350](350-caso-colegio/spec.md) | SPEC-350 · El caso del colegio estilo expediente (A-69 · C3) — mapa+cronología reusadas del padre + capa 1 en vivo + análisis IA con `alcance=COLEGIO_BLINDADO` compartiendo cola pg-boss y worker de 341; voz USTED | 🟡 En desarrollo |
| [344](344-camino-guiado-colegio/spec.md) | SPEC-344 · Camino guiado del colegio (A-69 · Fase C1) — registro por enlace + 5 pasos con guardián compartido con el padre + 11 grados sembrados + D3 candado servidor materia-profesor + puente D2 a Colegio.finServicio + Excel profesores fresco + I-245 plantilla alumnos | 🟡 En desarrollo |
| [351](351-informe-firmado-rector/spec.md) | SPEC-351 · El informe firmado del rector (A-69 · C5) — PDF membreteado con escudo configurable + correlativo INF-AAAA-NNNN serializado + firma del rector + código de verificación pública (reusa sello 234/341) + historial inmutable | 🟡 En desarrollo |
| [353](353-puesto-mando-colegio/spec.md) | SPEC-353 · Puesto de mando del colegio (A-69 · C6) — frase accionable "qué hacer hoy" en la home del rector (cruzado > sin abrir > comité > calma, solo conteos) + Configuración de avisos rediseñada al patrón A-62 (frases + Switch inmediato + umbrales en frase) | 🟡 En desarrollo |
| [374](374-ci-skip-bi-only/spec.md) | SPEC-374 · CI de PI salta cuando el PR no toca 002 ni la raíz compartida — el `should-skip` decide por lógica pura testeada (17 casos), nunca por `on: paths:` (candado I-249) | 🟡 En desarrollo |
| [380](380-comite-analisis-recomendacion/spec.md) | SPEC-380 (PR A · C4) · Análisis persistente del comité + botón "Recomendar generar informe al rector" (aviso in-app y correo por SPEC-201, respeta preferencias); el eslabón que faltaba entre "el comité estudió" y "el rector firma" | 🟡 En desarrollo |
| [390](390-comite-integrantes-monitor/spec.md) | SPEC-390 (PR B de SPEC-380 · C4/D-100) · Integrantes del comité monitoreados — 4º sujeto `INTEGRANTE_COMITE` en alertas, `IdentificadorIntegranteComite` con matching cross-tenant, UI de vigilancia y candado exhaustivo (Record + switch never) para que el enum no se olvide en ninguna rama | 🟡 En desarrollo |
| [375](375-shard-integracion-colgado/spec.md) | SPEC-375 · El shard de `test-integration` colgado — pg-boss singleton sin cierre dejaba handles vivos en el fork de vitest y el shard se quedaba 40+ min hasta cancelación manual; `disposeBoss()` + `afterAll` que lo invoca + `timeout-minutes: 20` como tope duro | 🟡 En desarrollo |
| [378](378-inicio-administrador/spec.md) | SPEC-378 · Inicio del administrador — alarma de la casa: pantalla vacía cuando todo está bien, tarjetas ámbar cuando algo se rompió en silencio (correos, motor IA, huérfanos, workers, vigencias, comité). Nunca rojo (regla dura de Jelkin) | 🟡 En desarrollo |
| [384](384-comite-abrir-caso-guardia/spec.md) | SPEC-384 · P0 — el comité no podía abrir NINGÚN caso: `GET /reportes-revision(/[id])` exigía `bandeja_reportes` (del operador, I-274 los separa) y el `assertModulo` cortaba con 403 antes de llegar a la autorización fina del propio endpoint. Nuevo helper `assertAnyModulo` acepta `bandeja_reportes` O `comite_bandeja` (nunca sustituye). I-279: `ComiteBandeja` muestra el mensaje real del backend en un banner propio (antes lo descartaba y pintaba un texto fijo falso). Candado 26: comité SIGUE 403 en clasificar/confirmar/reasignar. | 🟡 En desarrollo |
| [387](387-candado-alerta-revision-spam/spec.md) | SPEC-387 · I-280 — el job de SLA de spam llamaba a `enviarAlertaRevision` en cada vuelta (cada 15 min) sin recordar si ya avisó: 1.894 correos / 135 casos en 24 h (14× por caso). Copiado el patrón hermano de `tareas-motor.ts` — nuevo enum `SPAM_ALERTA_REVISION_ENVIADA` con migración idempotente + `obtenerUltimoAvisoSlaSpam` en el repo + audit tras éxito. Se avisa una vez y hasta que el reporte cambie (`actualizadoEn` mueve la ventana). | 🟡 En desarrollo |
| [388a](388a-red-profesionales-modelo/spec.md) | SPEC-388a · L1a Red de Profesionales — SOLO modelo y migración (destraba a Dev Infra en L2). Enum `RolUsuario += PROFESIONAL`, `EstadoPerfilProfesional` (con `BORRADOR` inicial), `PerfilProfesional` (reusa `fechaNacimiento`/documento de `Usuario`), `VerificacionProfesional` (historial con `venceEn` = revisadoEn + 4 meses), `FranjaDisponible`, `SolicitudCita` (con `REPROGRAMADA` + `solicitudPreviaId`/`pagoHeredadoDeId` — reprogramación es fila nueva que hereda pago) y `EncuestaPrimeraCita`. Sin UI, sin endpoints. | 🟡 En desarrollo |
| [391](391-registro-profesional/spec.md) | SPEC-391 · L1b Red de Profesionales — el profesional se registra: 3ª tarjeta «Soy profesional» en /registro/inicio, /registro-profesional (reusa RegistroEnlaceService del padre), /perfil-profesional/completar para rellenar + subir autorización firmada (PDF/PNG/JPG, magic bytes, storage cifrado). Transición BORRADOR→EN_REVISION cuando perfil completo + autorización subida. Test candado de reserva enumera 4 campos internos que NUNCA salen por API pública. | 🟡 En desarrollo |
| [395](395-cita-profesional/spec.md) | SPEC-395 · L4 Red de Profesionales — la cita: agendar, pagar, confirmar. `SolicitudCita.pagoAprobadoEn` aditivo + 10 `AccionAudit` `CITA_PROFESIONAL_*` en la misma migración (lección I-277). DTO con `debeExponerContacto` **escrito en código** (contacto del profesional solo si CONFIRMADA o VENCIDA_SIN_RESPUESTA con pago+48h — 10 tests de tabla de verdad). Workers con **candado I-280 desde el día 1** (`ultimoAviso48h.creadoEn ≥ actualizadoEn` → salta), la franja se libera al vencer el plazo del padre (aviso CEO 09:50), suspensión automática a las 3 consecutivas vencidas. Reprogramación como fila nueva (una gratis por dupla padre × profesional) y reasignación con pago heredado. 9 endpoints REST (profesional/padre/publico/admin). 10 unit + 4 integration. | 🟡 En desarrollo |
| [379a](379-decisiones-colegio-medias-a/spec.md) | SPEC-379 (PR A) · Decisiones del colegio a medias (D-100 · quick wins): membrete institucional del colegio en `pdf-informe-mensual` + `pdf-estadisticas`, candado UI "toda materia con profesor" y carga masiva de profesores desde la gestión diaria | 🟡 En desarrollo |
| [381](381-inicio-admin-rutas-y-comite/spec.md) | SPEC-381 · Inicio del admin: la ruta `/notificaciones/salud` mandaba a 404 (redirigida a la pantalla que YA muestra los datos) + candado unit por ruta de `inicio-admin.ts` + log defensivo en el `catch {}` de `ComiteBandeja` (I-269 · I-270 confirmada como corte del deploy, no bug de código) | 🟡 En desarrollo |
| [383](383-i277-enum-accion-audit-alertas/spec.md) | SPEC-383 · I-277 — asignar alerta en el colegio caía 500 porque `logAudit` casteaba `"COLEGIO_ALERTA_ASIGNADA" as AccionAudit` con un valor que no existía en el enum. Se agregan los 2 valores + migración idempotente, se quitan los 7 casts literales (los dinámicos siguen), y se borra la función muerta `escalarAlerta` de lib/colegio/alertas.ts. Test dirigido de asignar. | 🟡 En desarrollo |
| [396](396-ci-concurrency/spec.md) | SPEC-396 · I-282 causa raíz — bloque `concurrency` en los 4 flujos de `.github/workflows/`. Un repush cancela la corrida vieja; en `main` no se cancela. Cierra la cadena shard-cancelado → coverage-sin-blob → pi-gate-rojo-fantasma que culpó a #279 y #298 esta noche. | 🟡 En desarrollo |
| [407](407-shard-no-libera-event-loop/spec.md) | SPEC-407 · I-282 (SPEC-396 fue causa raíz PARCIAL) — instrumentación de medición. Evidencia dura (run 33777723622, shard 1 vs 3): los tests terminan verdes y GHA declara "internal error" a los 16m34s porque el fork de vitest deja handles vivos y `disposeBoss` sólo cierra pg-boss. Este PR entrega SOLO medición (wtfnode + `process._getActiveHandles/Requests` + `beforeExit`) detrás de `VITEST_DEBUG_HANDLES=1` con default OFF, activado por env condicional en `ci.yml` sólo en ramas `work/pi-SPEC-407-*`. El fix va en un PR aparte con la lista real de handles en mano. | 🟡 En desarrollo |
| [392](392-directorio-profesionales-padre/spec.md) | SPEC-392 (L3 · A-75) · Directorio del padre — presentación + urgencia, baraja aleatoria sembrada por sesión, filtros por ciudad/especialidad/modalidad, perfil con la tarifa por delante. Exento del muro de vigencia (padre gratis también lo ve). Barrido de payload H-2 · Ley 2375/2024 en los tres endpoints (test central del PR) | 🟡 En desarrollo |
| [404](404-bandeja-admin-inalcanzable/spec.md) | SPEC-404 (I-290) · Bandeja de reportes con URL propia — pasa de `/dashboard/admin` (raíz-aterrizaje que redirigía a Inicio) a `/dashboard/admin/bandeja`. Actualiza item del menú + 5 callsites "volver" (logo, operadores, identificador, consentimiento, círculo). Nueva aserción `arch:check (d-bis)`: un page.tsx de item de menú no puede `redirect()` a otro item del mismo menú. La aserción, aplicada al código anterior, cazaba I-290. | 🟡 En desarrollo |
| [401](401-motivo-real-resend/spec.md) | SPEC-401 · I-283 — el envío real hacía `throw new Error("Error al enviar notificación por email")` genérico y ese texto era lo único que se persistía en `Notificacion.ultimoError` (~10.500 fallos con el mismo texto). Nuevo helper puro `motivo-error.ts` (resumen `[<name>][<statusCode>] <mensaje>`, PII sanitizada: emails hasheados SHA-256 + tokens `re_/sk_/pk_/whsec_/Bearer` redactados) + `EmailProveedorError` + nueva señal `senalProveedorEmailCaido` (alta) que grita cuando las últimas N EMAIL terminadas son todas `FALLIDA` por razones distintas a cuota (cuota ya la cubre `senalCorreosFallidos.correos_no_salen`). Sin migración; backward-compat de PATRON_CUOTA. | 🟡 En desarrollo |
| [402](402-webhook-resend-allowlist/spec.md) | SPEC-402 (I-289) · Webhook de Resend en `GUARDIAS_ACCESO.publicas` — el middleware venía cortando `POST /api/webhooks/resend` con 401 antes de que el handler pudiera validar la firma HMAC-Svix, así que Resend reintentaba y descartaba entregas/rebotes. Una línea + test candado con 3 casos (POST/GET/firma-inválida). Posible pieza del misterio I-283 del correo caído. | 🟡 En desarrollo |
| [403](403-comision-parametrizable/spec.md) | SPEC-403 (I-288 · A-75 §4) · La comisión de la red es un parámetro — vivía quemada en **15** dentro de `api/padre/citas`, cuando el brief dice **10** y es un número que Jelkin cambia sin desplegar. Baja a `ParametroSistema` `comision.porcentaje`, sembrado con `update: {}` para no pisarle el ajuste al admin, y **falla en cerrado** si no está: es plata, no se cobra con un número inventado. Apilada sobre #330. | 🟢 Implementada |
| [425](425-panel-profesional/spec.md) | SPEC-425 (A-75 · L5) · El panel del profesional — el motor de citas existía desde SPEC-395 **sin una sola pantalla**. Trae su inicio completo (solicitudes con el reloj de 48 h, agenda, casos por cerrar, por cobrar, marcador, verificación, expedientes compartidos), hace cumplir el §3 (las `SIN_CONFIRMAR` no suman) y el §9 (expedientes solo se listan), y apunta los **dos** mapas de aterrizaje al panel. **No pinta los tres controles que no tienen motor** — el cierre es L6. | 🟢 Implementada |
| [426](426-proxy-profesional-lista-blanca/spec.md) | SPEC-426 (A-75 · orden CEO 23:0x) · PROFESIONAL en lista blanca del proxy — molde SPEC-319 (Comité de Convivencia). Cierra el hueco que el barrido regenerado por #332 destapó (~290 rutas permitidas: 84 de `/api/colegio`, 30 de `/api/padre`, `/api/config/parametros`, `/api/interno/**`, `/api/reportes/procesar`). Superficie mínima: `/dashboard/profesional`, `/perfil-profesional/**`, `/api/profesional/**` + sesión + perfil compartido + árbol público D-37. Candado bidireccional en `proxy.test.ts` (lo listado pasa · todo lo demás 403 / redirect al panel). | 🟡 En desarrollo |
| [422](422-registro-profesional-publico/spec.md) | SPEC-422 (I-297) · «Soy profesional» era un enlace muerto — `/registro-profesional` no estaba en `GUARDIAS_ACCESO.publicas` y el middleware la cortaba con 307 → `/login`: nadie podía inscribirse como psicólogo. Causa: `matcheaRuta` es prefijo POR SEGMENTO, así que `/registro` no cubre a las otras puertas. **Tercera aparición de la clase en un día** (I-289, I-290, I-297), así que el candado **descubre las puertas leyendo el disco** y cubre la cuarta que nazca. | 🟢 Implementada |
| [418](418-aviso-devolucion-auditado/spec.md) | SPEC-418 (I-295) · El aviso de devolución al profesional no se pierde — `verificador/service.ts` mandaba el correo directo por Resend, fuera de transacción y con el error tragado: con el proveedor caído el profesional nunca se enteraba y no quedaba rastro, así que el ciclo de admisión se detenía en silencio. Ahora el motor sabe programar **dentro de la transacción** del llamador (`programar(input, { tx })` + `despacharEnvios()` tras el commit) y el aviso viaja atómico con la decisión, con falla en cerrado si no hay regla activa. | 🟢 Implementada |
| [419](419-reglas-correo-profesional/spec.md) | SPEC-419 (I-296 🔴) · El psicólogo puede recibir su enlace de registro — SPEC-391 creó `email-profesional.ts` con dos eventos que fallan en cerrado y **el seed nunca recibió sus reglas ni sus plantillas** (0 filas en producción contra 109 reglas activas). La ruta atrapa el throw y responde 202 «te enviamos un enlace» igual, así que el profesional esperaba un correo que no existía: **no es que no quisieran inscribirse, es que no podían.** Dos bloques de seed. Lo descubrió el guardián `reglas:check` de SPEC-418 en su primer uso. | 🟢 Implementada |
| [415](415-errores-que-no-se-tragan/spec.md) | SPEC-415 (barrido tras I-294) · Los errores que se tragaban a alguien — de 140 coincidencias en `src/`, 34 reales; se arreglan las **8 que hacen que una persona decida mal**: los 5 avisos de cambio de clave que fallaban sin dejar rastro (seguridad, ligado a I-283) y las 3 pantallas que renderizaban un fallo como «no hay nada» (integrantes del comité, historial de informes, badge de notificaciones). Candado estático con contraprueba. C queda con I-236, D después, E no se toca. | 🟢 Implementada |
| [389](389-red-profesionales-l2-verificacion-idc/spec.md) | SPEC-389 (Red de Profesionales · L2 · A-75) · helpers puros de vigencia (`calcularVenceEn`, `sellos`, candado H-2) + cron con candado I-280 + módulo `admin_verificacion_profesionales` (SOLO ADMIN por default). Cherry-picked en SPEC-408 mientras la rama origen no mergea por su cuenta. | 🟡 En desarrollo |
| [408](408-verificador-red-apoyo/spec.md) | SPEC-408 (A-75 · brief v2.0 §9 + §5-bis) · Red de Apoyo · el Verificador admite al profesional y atiende incidentes — rol interno nuevo `VERIFICADOR`, dos colas (solicitudes por revisar + citas SIN_CONFIRMAR) bajo el MISMO módulo, ficha con checklist parametrizable de 4 requisitos (seed idempotente en `ParametroSistema`), aprobar bloqueado si hay NO_CUMPLE, observación obligatoria al devolver, correo al profesional en cada cambio, ciclo sin límite. Reserva legal H-2 (Ley 1918/2018 · 2375/2024): el profesional ve solo la observación por ítem — nada de `resultado`, `checklist`, `revisadoPor` ni URL de autorización. | 🟡 En desarrollo |
| [412](412-poblador-marca-lo-que-siembra/spec.md) | SPEC-412 (BRIEF A-76 · I-271, I-292) · El poblador que marca lo que siembra — el 99 % de producción es sembrado y `demo_marcado` estaba en CERO filas porque la familia `scripts/demo/` metía la etiqueta de demo DENTRO de la llave primaria (`demo3-sol-demo-al-r-00127-E`), lo que deja 254 de 256 casos del comité inabribles. Poblador v5 con `cuid()` de Prisma + marcado por lotes en `demo_marcado`, borrador que solo mira esa tabla (con reporte previo), marcado retroactivo de lo ya sembrado y `reset-piloto --solo-sembrado`. Incluye la forma que BI pidió (reincidencia, asignación desigual, transiciones escalonadas, capa comercial). Ningún validador se ablanda. | 🟢 Implementada |
| [414](414-inicio-admin-separa-sembrado/spec.md) | SPEC-414 (A-76 §3.1-3.2 · I-271, I-294) · El Inicio del admin separa lo sembrado de lo real — las 4 señales de CARGA descuentan `demo_marcado` y por defecto se ve SOLO LO REAL, con el conteo de prueba al lado y `?prueba=1` para traerlo de vuelta; las de SALUD siguen contando todo. Cierra además **I-294**: la única señal que ya descontaba apuntaba a la tabla `"DemoMarcado"` (inexistente: el modelo tiene `@@map`) y `allSettled` se comía el error, así que nunca corrió desde SPEC-378 — ahora una señal que truena se registra y **se ve en pantalla** como degradada. | 🟢 Implementada |
| [416](416-consentimiento-solo-titulares/spec.md) | SPEC-416 (I-118) · Consentimiento se le pide SOLO a titulares del dato (PARENT + SCHOOL_ADMIN). Filtro por rol en el paso 4 del middleware + defensa en profundidad en el emitter de la cookie (los no titulares no reciben el flag en primer lugar). Motivo probatorio: `audit_consentimientos` demuestra que el TITULAR consintió; firmas de empleados internos (ADMIN/OPERADOR/COMITE/VERIFICADOR) o del prestador (PROFESIONAL) contaminan la prueba legal. Candado bi-direccional: PARENT/SCHOOL_ADMIN siguen bloqueados sin consentimiento. Desbloquea al Verificador (SPEC-408). | 🟡 En desarrollo |
| [421](421-gestion-profesionales-admin/spec.md) | SPEC-421 (A-75 · orden Jelkin 20:5x) · Admin gestiona psicólogos como padres — espejo de `/admin/padres` (listar/detalle/desactivar/reactivar/restablecer-password) + tab **Solicitudes pendientes** con reenviar-enlace que muestra la URL en pantalla una sola vez si el correo no salió. Nueva módulo `profesionales_admin` (default: solo ADMIN). Admin NO crea cuentas ni llena perfil (el psicólogo se registra y llena solo — SPEC-391). Destraba la prueba de punta a punta del Verificador con el correo caído. | 🟡 En desarrollo |

## Incidencias de calidad de datos

- **Colisión 050 resuelta (spec 087):** `050-pendientes-afinamiento` renombrada a `088-pendientes-afinamiento`; referencias actualizadas.
- **Saltos de numeración:** faltan `032`, el rango `055-069` y `081`.
- **Numeración duplicada:** existen `02-reportes-comunitarios` y la serie `0NN` estándar (conviven por historia del repo).
- **Clúster 085–095:** headers `FINALIZADO (pendiente ACTA → CERRADA)`; el snapshot de gestión (2026-07-29) las contó como CERRADA. Divergencia reportada a ZEUS en 002-PI-047.

## Convención de archivos por spec

Cada spec cerrada debe contener al menos: `spec.md` (alcance), `plan.md` (plan) y `reporte-cierre.md`/`cierre.md` (evidencia de cierre, en la carpeta de la spec o en `docs/cierre-NNN.md`).
