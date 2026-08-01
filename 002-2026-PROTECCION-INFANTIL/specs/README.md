# Índice maestro de especificaciones

> Última actualización: **2026-07-30** (002-PI-047: regenerada leyendo el `Status`/`Estado` de las `spec.md`, una por una; 002-PI-051: +129 PLANEADO).
> Cruce con el ESTADO-SPECS de gestión (snapshot 2026-07-29: 72/26/9/3): la lectura directa de headers da **62/36/11/1**.
> Deltas explicados: (a) 053 y 017 pasaron de Planeada a Implementada (002-PI-046); (b) las 10 specs del clúster
> 085–095, que el snapshot contó como CERRADA, tienen header literal `FINALIZADO (pendiente ACTA-VALIDACION de ZEUS → CERRADA)`
> — se reporta la divergencia a ZEUS; manda el header del repo.

## Resumen

| Métrica | Valor |
|---------|-------|
| **Total de specs** | **111** |
| **Cerradas (CERRADA)** | **62** |
| **Finalizadas (FINALIZADO)** | **36** |
| **Implementadas (IMPLEMENTADO)** | **12** |
| **Pendientes (PLANEADO)** | **1** |

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
| [110](110-apelacion-identificador/spec.md) | SPEC-110 — Apelación del identificador reportado | 🟢 Implementada |
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

## Tabla completa (111 specs)

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
| [110](110-apelacion-identificador/spec.md) | SPEC-110 — Apelación del identificador reportado | 🟢 Implementada |
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

## Incidencias de calidad de datos

- **Colisión 050 resuelta (spec 087):** `050-pendientes-afinamiento` renombrada a `088-pendientes-afinamiento`; referencias actualizadas.
- **Saltos de numeración:** faltan `032`, el rango `055-069` y `081`.
- **Numeración duplicada:** existen `02-reportes-comunitarios` y la serie `0NN` estándar (conviven por historia del repo).
- **Clúster 085–095:** headers `FINALIZADO (pendiente ACTA → CERRADA)`; el snapshot de gestión (2026-07-29) las contó como CERRADA. Divergencia reportada a ZEUS en 002-PI-047.

## Convención de archivos por spec

Cada spec cerrada debe contener al menos: `spec.md` (alcance), `plan.md` (plan) y `reporte-cierre.md`/`cierre.md` (evidencia de cierre, en la carpeta de la spec o en `docs/cierre-NNN.md`).
