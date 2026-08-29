> GENERADO por `scripts/arch/generar-roles-capacidades.ts` — no editar a mano.
> Fuentes: `src/lib/proxy.ts`, `src/lib/nav-items.ts`, `src/lib/permisos-catalogo.ts`, `src/components/modules/NavHeader.tsx`, `prisma/seed.ts`, `src/app/**`.
> Regenerar: `npx tsx scripts/arch/generar-roles-capacidades.ts` (o `npm run arch:check` para verificar).

# 02 · Roles y capacidades (puerta y permisos)

Dos ejes documentados **por separado, sin reconciliar** (su reconciliación es
decisión de ZEUS, fuera de SPEC-126):

1. **Eje de rutas (la puerta)**: `proxy()` decide quién pasa; `esDestinoPermitidoPorRol`
   es el MISMO criterio reusable fuera del middleware (lo consume toda la navegación, D-41).
2. **Eje de módulos (la BD)**: `PermisoModulo` decide QUÉ se ofrece dentro de un área
   (los menús filtran por módulo ∧ predicado desde la D-41).

La matriz de abajo ejecuta el código real: `proxy()` con la sesión canónica (usuario
activo, `debeCambiarPassword=false`, vigencia vigente; solo varía el rol) y el predicado.
Alineación D5: permitir ≡ `true`; 401/403/redirect ≡ `false`.

Inventario: 7 roles (5 autenticados + anónimo) × 432 rutas
(árbol `src/app/**` ∪ rutas declaradas en `proxy.ts`) = 3024 combinaciones.

Estado de la aserción A al generar: **VERDE (puerta ≡ predicado)**.

## Matriz rol × ruta (veredicto real)

### ADMIN

| Ruta | Tipo | Puerta (`proxy()`) | Predicado | Alineado |
| --- | --- | --- | --- | --- |
| `/` | página | permitir | permite | sí |
| `//` | página | permitir | permite | sí |
| `/activar` | página | permitir | permite | sí |
| `/api/` | api | permitir | permite | sí |
| `/api/admin` | api | permitir | permite | sí |
| `/api/admin/analisis/anomalias` | api | permitir | permite | sí |
| `/api/admin/analisis/anomalias/[id]` | api | permitir | permite | sí |
| `/api/admin/analisis/dinero-vs-valor` | api | permitir | permite | sí |
| `/api/admin/analisis/dispersion` | api | permitir | permite | sí |
| `/api/admin/analisis/kpis` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/export` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/metricas` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]/historial` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]/modo` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/test-sql` | api | permitir | permite | sí |
| `/api/admin/analisis/top-decisiones` | api | permitir | permite | sí |
| `/api/admin/analytics/colegios` | api | permitir | permite | sí |
| `/api/admin/analytics/colegios/[id]` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/bloquear` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/desbloquear` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simulacion-score` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/[id]` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/sugerencias` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/tablero` | api | permitir | permite | sí |
| `/api/admin/audit-logs` | api | permitir | permite | sí |
| `/api/admin/colegios` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/cursos` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/reenviar-email` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/regenerar-password` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/asignar` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/reasignar` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/comite/aclaracion/[id]/responder` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/documento` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/tomar` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | api | permitir | permite | sí |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion/[id]/aprobar` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion/[id]/rechazar` | api | permitir | permite | sí |
| `/api/admin/comite/integrantes` | api | permitir | permite | sí |
| `/api/admin/comite/integrantes/[id]` | api | permitir | permite | sí |
| `/api/admin/comite/mias` | api | permitir | permite | sí |
| `/api/admin/comite/pendientes` | api | permitir | permite | sí |
| `/api/admin/comite/solicitudes` | api | permitir | permite | sí |
| `/api/admin/correcciones` | api | permitir | permite | sí |
| `/api/admin/dataset-entrenamiento` | api | permitir | permite | sí |
| `/api/admin/estadisticas` | api | permitir | permite | sí |
| `/api/admin/estadisticas/clasificacion` | api | permitir | permite | sí |
| `/api/admin/estadisticas/denuncias-formales` | api | permitir | permite | sí |
| `/api/admin/estadisticas/dinero-vs-valor` | api | permitir | permite | sí |
| `/api/admin/guias-accion` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]/enviar-comite` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]/preview` | api | permitir | permite | sí |
| `/api/admin/ia/modelos` | api | permitir | permite | sí |
| `/api/admin/ia/ollama/probar` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/config` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/definiciones` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/preguntas` | api | permitir | permite | sí |
| `/api/admin/ia/sandbox` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/analisis` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/cancelar` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/export` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/resultados` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/comparar` | api | permitir | permite | sí |
| `/api/admin/matches` | api | permitir | permite | sí |
| `/api/admin/monitoreo/atascados` | api | permitir | permite | sí |
| `/api/admin/monitoreo/estado` | api | permitir | permite | sí |
| `/api/admin/monitoreo/historial` | api | permitir | permite | sí |
| `/api/admin/monitoreo/incidentes` | api | permitir | permite | sí |
| `/api/admin/monitoreo/logs` | api | permitir | permite | sí |
| `/api/admin/motor/deriva` | api | permitir | permite | sí |
| `/api/admin/motor/deriva/recalcular` | api | permitir | permite | sí |
| `/api/admin/notificaciones/bandeja` | api | permitir | permite | sí |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | api | permitir | permite | sí |
| `/api/admin/notificaciones/catalogos` | api | permitir | permite | sí |
| `/api/admin/notificaciones/parametros` | api | permitir | permite | sí |
| `/api/admin/notificaciones/parametros/[clave]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | api | permitir | permite | sí |
| `/api/admin/notificaciones/salud` | api | permitir | permite | sí |
| `/api/admin/operadores` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/casos` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/metricas` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/reenviar-email` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/regenerar-password` | api | permitir | permite | sí |
| `/api/admin/operadores/asignacion` | api | permitir | permite | sí |
| `/api/admin/operadores/modelo` | api | permitir | permite | sí |
| `/api/admin/operadores/reasignar` | api | permitir | permite | sí |
| `/api/admin/padres` | api | permitir | permite | sí |
| `/api/admin/padres/[id]` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/circulo-confianza` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/restablecer-password` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/vigencia` | api | permitir | permite | sí |
| `/api/admin/pagos/activar-manual` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos/[id]/desactivar` | api | permitir | permite | sí |
| `/api/admin/pagos/cliente/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/cliente/[id]/extender` | api | permitir | permite | sí |
| `/api/admin/pagos/mora` | api | permitir | permite | sí |
| `/api/admin/pagos/parametros` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes/[id]/autorizar` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes/[id]/rechazar` | api | permitir | permite | sí |
| `/api/admin/pagos/planes` | api | permitir | permite | sí |
| `/api/admin/pagos/planes/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/reembolsos` | api | permitir | permite | sí |
| `/api/admin/pagos/reembolsos/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/sin-suscripcion` | api | permitir | permite | sí |
| `/api/admin/pagos/solicitudes-pendientes` | api | permitir | permite | sí |
| `/api/admin/pagos/tasas` | api | permitir | permite | sí |
| `/api/admin/pagos/vencimientos` | api | permitir | permite | sí |
| `/api/admin/permisos-modulos` | api | permitir | permite | sí |
| `/api/admin/reportes-revision` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]/confirmar` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]/reasignar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/anonimizar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/baja` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/denuncia-formal` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/escalar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/expediente` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/forense` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/forense/pdf` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/proceso` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/resolver-spam` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/revelar-original` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/transiciones` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/validar-anonimizacion` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/restart` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/start` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/stop` | api | permitir | permite | sí |
| `/api/admin/servicios/estado` | api | permitir | permite | sí |
| `/api/admin/sesiones` | api | permitir | permite | sí |
| `/api/admin/sesiones/[id]/cerrar` | api | permitir | permite | sí |
| `/api/admin/spam/analitica` | api | permitir | permite | sí |
| `/api/admin/spam/banco-sugerencias` | api | permitir | permite | sí |
| `/api/admin/spam/pendientes` | api | permitir | permite | sí |
| `/api/admin/usuarios` | api | permitir | permite | sí |
| `/api/admin/usuarios/[id]` | api | permitir | permite | sí |
| `/api/admin/usuarios/dashboard` | api | permitir | permite | sí |
| `/api/alertas` | api | permitir | permite | sí |
| `/api/alertas/[id]` | api | permitir | permite | sí |
| `/api/alertas/suscribir` | api | permitir | permite | sí |
| `/api/apelaciones` | api | permitir | permite | sí |
| `/api/apelaciones/mias` | api | permitir | permite | sí |
| `/api/auth/activar` | api | permitir | permite | sí |
| `/api/auth/cambiar-password` | api | permitir | permite | sí |
| `/api/auth/login` | api | permitir | permite | sí |
| `/api/auth/logout` | api | permitir | permite | sí |
| `/api/auth/recuperar/restablecer` | api | permitir | permite | sí |
| `/api/auth/recuperar/solicitar` | api | permitir | permite | sí |
| `/api/auth/recuperar/validar` | api | permitir | permite | sí |
| `/api/auth/register` | api | permitir | permite | sí |
| `/api/auth/verificar/completar` | api | permitir | permite | sí |
| `/api/auth/verificar/solicitar` | api | permitir | permite | sí |
| `/api/auth/verificar/validar` | api | permitir | permite | sí |
| `/api/circulo-confianza` | api | permitir | permite | sí |
| `/api/circulo-confianza/[id]` | api | permitir | permite | sí |
| `/api/circulo-confianza/agregado` | api | permitir | permite | sí |
| `/api/circulo-confianza/preferencias` | api | permitir | permite | sí |
| `/api/ciudades` | api | permitir | permite | sí |
| `/api/ciudades/buscar` | api | permitir | permite | sí |
| `/api/colegio` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/asignar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/escalar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/observacion` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa/excel` | api | permitir | permite | sí |
| `/api/colegio/auditoria` | api | permitir | permite | sí |
| `/api/colegio/buscar` | api | permitir | permite | sí |
| `/api/colegio/carga/confirmar` | api | permitir | permite | sí |
| `/api/colegio/carga/plantilla` | api | permitir | permite | sí |
| `/api/colegio/carga/validar` | api | permitir | permite | sí |
| `/api/colegio/cobertura` | api | permitir | permite | sí |
| `/api/colegio/comite` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta/regenerar-password` | api | permitir | permite | sí |
| `/api/colegio/comite/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/resolver` | api | permitir | permite | sí |
| `/api/colegio/confianza/auditoria` | api | permitir | permite | sí |
| `/api/colegio/confianza/documentos` | api | permitir | permite | sí |
| `/api/colegio/confianza/protocolo/pdf` | api | permitir | permite | sí |
| `/api/colegio/cursos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/alumnos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/duplicar` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/plantilla` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/validar` | api | permitir | permite | sí |
| `/api/colegio/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/estadisticas/pdf` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/materias` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/notificaciones` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/marcar-leidas` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/colegio/onboarding` | api | permitir | permite | sí |
| `/api/colegio/patrones` | api | permitir | permite | sí |
| `/api/colegio/preferencias-avisos` | api | permitir | permite | sí |
| `/api/colegio/profesores` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/reportes/pdf` | api | permitir | permite | sí |
| `/api/colegio/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/colegio/usuarios` | api | permitir | permite | sí |
| `/api/config/parametros` | api | permitir | permite | sí |
| `/api/config/parametros/[clave]` | api | permitir | permite | sí |
| `/api/config/parametros/[clave]/revelar` | api | permitir | permite | sí |
| `/api/config/parametros/publicos` | api | permitir | permite | sí |
| `/api/config/parametros/todos` | api | permitir | permite | sí |
| `/api/consentimiento/aceptar` | api | permitir | permite | sí |
| `/api/consulta` | api | permitir | permite | sí |
| `/api/consulta/detalle` | api | permitir | permite | sí |
| `/api/consulta/evento` | api | permitir | permite | sí |
| `/api/departamentos` | api | permitir | permite | sí |
| `/api/docs/indice` | api | permitir | permite | sí |
| `/api/estadisticas-publicas` | api | permitir | permite | sí |
| `/api/health` | api | permitir | permite | sí |
| `/api/health/worker` | api | permitir | permite | sí |
| `/api/interno/expediente/[id]/transicionar` | api | permitir | permite | sí |
| `/api/me` | api | permitir | permite | sí |
| `/api/me/colegio` | api | permitir | permite | sí |
| `/api/monitor/notif` | api | permitir | permite | sí |
| `/api/notificaciones` | api | permitir | permite | sí |
| `/api/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/notificaciones/preferencias` | api | permitir | permite | sí |
| `/api/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/semaforo` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/timeline` | api | permitir | permite | sí |
| `/api/padre/contacto-emergencia` | api | permitir | permite | sí |
| `/api/padre/contacto-emergencia/[id]` | api | permitir | permite | sí |
| `/api/padre/expediente/[id]/cerrar-forzoso` | api | permitir | permite | sí |
| `/api/padre/expediente/[id]/pedir-aclaracion` | api | permitir | permite | sí |
| `/api/padre/expedientes/[id]/eventos` | api | permitir | permite | sí |
| `/api/padre/suscripcion/activar-freemium` | api | permitir | permite | sí |
| `/api/padre/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/pagos` | api | permitir | permite | sí |
| `/api/pagos/aplicar-bono` | api | permitir | permite | sí |
| `/api/pagos/aplicar-referido` | api | permitir | permite | sí |
| `/api/pagos/planes` | api | permitir | permite | sí |
| `/api/pagos/renovacion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/cancelar` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/estado` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/validar-bono` | api | permitir | permite | sí |
| `/api/paises` | api | permitir | permite | sí |
| `/api/plataformas` | api | permitir | permite | sí |
| `/api/publico/guia-accion/categoria/[cat]` | api | permitir | permite | sí |
| `/api/publico/verificar-pdf/[hash]` | api | permitir | permite | sí |
| `/api/reportes` | api | permitir | permite | sí |
| `/api/reportes/fallback` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes/[id]` | api | permitir | permite | sí |
| `/api/reportes/procesar` | api | permitir | permite | sí |
| `/api/reportes/seguimiento` | api | permitir | permite | sí |
| `/api/reportes/seguimiento/[numero]` | api | permitir | permite | sí |
| `/api/session/ping` | api | permitir | permite | sí |
| `/api/vigencia/refresh` | api | permitir | permite | sí |
| `/api/webhooks/resend` | api | permitir | permite | sí |
| `/cambiar-password` | página | permitir | permite | sí |
| `/consentimiento` | página | permitir | permite | sí |
| `/consulta` | página | permitir | permite | sí |
| `/dashboard` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard-publico` | página | permitir | permite | sí |
| `/dashboard/admin` | página | permitir | permite | sí |
| `/dashboard/admin/analisis/recomendaciones` | página | permitir | permite | sí |
| `/dashboard/admin/analisis/reglas` | página | permitir | permite | sí |
| `/dashboard/admin/anti-abuso` | página | permitir | permite | sí |
| `/dashboard/admin/colegios` | página | permitir | permite | sí |
| `/dashboard/admin/colegios/[id]/estructura` | página | permitir | permite | sí |
| `/dashboard/admin/colegios/nuevo` | página | permitir | permite | sí |
| `/dashboard/admin/comite` | página | permitir | permite | sí |
| `/dashboard/admin/comite/aclaracion/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/comite/apelaciones` | página | permitir | permite | sí |
| `/dashboard/admin/comite/auditoria` | página | permitir | permite | sí |
| `/dashboard/admin/comite/consolidacion/[expedienteId]` | página | permitir | permite | sí |
| `/dashboard/admin/comite/gestion` | página | permitir | permite | sí |
| `/dashboard/admin/comite/guias-pendientes` | página | permitir | permite | sí |
| `/dashboard/admin/configuracion` | página | permitir | permite | sí |
| `/dashboard/admin/configuracion/guias-accion` | página | permitir | permite | sí |
| `/dashboard/admin/dataset-entrenamiento` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/clasificacion` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/dinero-vs-valor` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/motor` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/operacion` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/salud-motor` | página | permitir | permite | sí |
| `/dashboard/admin/ia` | página | permitir | permite | sí |
| `/dashboard/admin/identificador/[nick]` | página | permitir | permite | sí |
| `/dashboard/admin/monitoreo/worker` | página | permitir | permite | sí |
| `/dashboard/admin/operadores` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/asignar` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/auditoria` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/gestion` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/modelo` | página | permitir | permite | sí |
| `/dashboard/admin/padres` | página | permitir | permite | sí |
| `/dashboard/admin/padres/[id]/circulo` | página | permitir | permite | sí |
| `/dashboard/admin/pagos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/analitica` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/bonos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/cliente/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/mora` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/pendientes` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/planes` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/reembolsos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/sin-suscripcion` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/vencimientos` | página | permitir | permite | sí |
| `/dashboard/admin/spam` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/admins` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/comite-convivencia` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/comite-validacion` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/operadores` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/rectores` | página | permitir | permite | sí |
| `/dashboard/apelaciones` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/circulo-confianza` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/alertas` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/alertas/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/alumnos/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/analisis/comparativa` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/auditoria` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite/casos` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite/casos/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite/estadisticas` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite/integrantes` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/confianza` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/configuracion` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos/carga` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos/nuevo` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos/unificado` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/estadisticas` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/materias` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/onboarding` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/profesores` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/profesores/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/suscripcion` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/tablero` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/mis-reportes/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/circulo-confianza` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/expedientes` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/expedientes/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/identificador/[nick]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/notificaciones` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/perfil` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/reportar` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/suscripcion` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/perfil` | página | permitir | permite | sí |
| `/dashboard/perfil/notificaciones` | página | permitir | permite | sí |
| `/docs` | página | permitir | permite | sí |
| `/docs/operar` | página | permitir | permite | sí |
| `/docs/tecnico` | página | permitir | permite | sí |
| `/login` | página | permitir | permite | sí |
| `/mis-reportes` | página | redirigir→/dashboard/admin | no permite | sí |
| `/offline` | página | permitir | permite | sí |
| `/privacidad` | página | permitir | permite | sí |
| `/recuperar` | página | permitir | permite | sí |
| `/recuperar/[token]` | página | permitir | permite | sí |
| `/registro` | página | permitir | permite | sí |
| `/registro-colegio` | página | permitir | permite | sí |
| `/registro/inicio` | página | permitir | permite | sí |
| `/reportar` | página | redirigir→/dashboard/admin | no permite | sí |
| `/seguimiento` | página | permitir | permite | sí |
| `/terminos` | página | permitir | permite | sí |

### OPERADOR

| Ruta | Tipo | Puerta (`proxy()`) | Predicado | Alineado |
| --- | --- | --- | --- | --- |
| `/` | página | permitir | permite | sí |
| `//` | página | permitir | permite | sí |
| `/activar` | página | permitir | permite | sí |
| `/api/` | api | permitir | permite | sí |
| `/api/admin` | api | permitir | permite | sí |
| `/api/admin/analisis/anomalias` | api | permitir | permite | sí |
| `/api/admin/analisis/anomalias/[id]` | api | permitir | permite | sí |
| `/api/admin/analisis/dinero-vs-valor` | api | permitir | permite | sí |
| `/api/admin/analisis/dispersion` | api | permitir | permite | sí |
| `/api/admin/analisis/kpis` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/export` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/metricas` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]/historial` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]/modo` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/test-sql` | api | permitir | permite | sí |
| `/api/admin/analisis/top-decisiones` | api | permitir | permite | sí |
| `/api/admin/analytics/colegios` | api | permitir | permite | sí |
| `/api/admin/analytics/colegios/[id]` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/bloquear` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/desbloquear` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simulacion-score` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/[id]` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/sugerencias` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/tablero` | api | permitir | permite | sí |
| `/api/admin/audit-logs` | api | permitir | permite | sí |
| `/api/admin/colegios` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/cursos` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/reenviar-email` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/regenerar-password` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/asignar` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/reasignar` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/comite/aclaracion/[id]/responder` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/documento` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/tomar` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | api | permitir | permite | sí |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion/[id]/aprobar` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion/[id]/rechazar` | api | permitir | permite | sí |
| `/api/admin/comite/integrantes` | api | permitir | permite | sí |
| `/api/admin/comite/integrantes/[id]` | api | permitir | permite | sí |
| `/api/admin/comite/mias` | api | permitir | permite | sí |
| `/api/admin/comite/pendientes` | api | permitir | permite | sí |
| `/api/admin/comite/solicitudes` | api | permitir | permite | sí |
| `/api/admin/correcciones` | api | permitir | permite | sí |
| `/api/admin/dataset-entrenamiento` | api | permitir | permite | sí |
| `/api/admin/estadisticas` | api | permitir | permite | sí |
| `/api/admin/estadisticas/clasificacion` | api | permitir | permite | sí |
| `/api/admin/estadisticas/denuncias-formales` | api | permitir | permite | sí |
| `/api/admin/estadisticas/dinero-vs-valor` | api | permitir | permite | sí |
| `/api/admin/guias-accion` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]/enviar-comite` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]/preview` | api | permitir | permite | sí |
| `/api/admin/ia/modelos` | api | permitir | permite | sí |
| `/api/admin/ia/ollama/probar` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/config` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/definiciones` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/preguntas` | api | permitir | permite | sí |
| `/api/admin/ia/sandbox` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/analisis` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/cancelar` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/export` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/resultados` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/comparar` | api | permitir | permite | sí |
| `/api/admin/matches` | api | permitir | permite | sí |
| `/api/admin/monitoreo/atascados` | api | permitir | permite | sí |
| `/api/admin/monitoreo/estado` | api | permitir | permite | sí |
| `/api/admin/monitoreo/historial` | api | permitir | permite | sí |
| `/api/admin/monitoreo/incidentes` | api | permitir | permite | sí |
| `/api/admin/monitoreo/logs` | api | permitir | permite | sí |
| `/api/admin/motor/deriva` | api | permitir | permite | sí |
| `/api/admin/motor/deriva/recalcular` | api | permitir | permite | sí |
| `/api/admin/notificaciones/bandeja` | api | permitir | permite | sí |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | api | permitir | permite | sí |
| `/api/admin/notificaciones/catalogos` | api | permitir | permite | sí |
| `/api/admin/notificaciones/parametros` | api | permitir | permite | sí |
| `/api/admin/notificaciones/parametros/[clave]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | api | permitir | permite | sí |
| `/api/admin/notificaciones/salud` | api | permitir | permite | sí |
| `/api/admin/operadores` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/casos` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/metricas` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/reenviar-email` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/regenerar-password` | api | permitir | permite | sí |
| `/api/admin/operadores/asignacion` | api | permitir | permite | sí |
| `/api/admin/operadores/modelo` | api | permitir | permite | sí |
| `/api/admin/operadores/reasignar` | api | permitir | permite | sí |
| `/api/admin/padres` | api | permitir | permite | sí |
| `/api/admin/padres/[id]` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/circulo-confianza` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/restablecer-password` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/vigencia` | api | permitir | permite | sí |
| `/api/admin/pagos/activar-manual` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos/[id]/desactivar` | api | permitir | permite | sí |
| `/api/admin/pagos/cliente/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/cliente/[id]/extender` | api | permitir | permite | sí |
| `/api/admin/pagos/mora` | api | permitir | permite | sí |
| `/api/admin/pagos/parametros` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes/[id]/autorizar` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes/[id]/rechazar` | api | permitir | permite | sí |
| `/api/admin/pagos/planes` | api | permitir | permite | sí |
| `/api/admin/pagos/planes/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/reembolsos` | api | permitir | permite | sí |
| `/api/admin/pagos/reembolsos/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/sin-suscripcion` | api | permitir | permite | sí |
| `/api/admin/pagos/solicitudes-pendientes` | api | permitir | permite | sí |
| `/api/admin/pagos/tasas` | api | permitir | permite | sí |
| `/api/admin/pagos/vencimientos` | api | permitir | permite | sí |
| `/api/admin/permisos-modulos` | api | permitir | permite | sí |
| `/api/admin/reportes-revision` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]/confirmar` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]/reasignar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/anonimizar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/baja` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/denuncia-formal` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/escalar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/expediente` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/forense` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/forense/pdf` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/proceso` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/resolver-spam` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/revelar-original` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/transiciones` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/validar-anonimizacion` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/restart` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/start` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/stop` | api | permitir | permite | sí |
| `/api/admin/servicios/estado` | api | permitir | permite | sí |
| `/api/admin/sesiones` | api | permitir | permite | sí |
| `/api/admin/sesiones/[id]/cerrar` | api | permitir | permite | sí |
| `/api/admin/spam/analitica` | api | permitir | permite | sí |
| `/api/admin/spam/banco-sugerencias` | api | permitir | permite | sí |
| `/api/admin/spam/pendientes` | api | permitir | permite | sí |
| `/api/admin/usuarios` | api | permitir | permite | sí |
| `/api/admin/usuarios/[id]` | api | permitir | permite | sí |
| `/api/admin/usuarios/dashboard` | api | permitir | permite | sí |
| `/api/alertas` | api | permitir | permite | sí |
| `/api/alertas/[id]` | api | permitir | permite | sí |
| `/api/alertas/suscribir` | api | permitir | permite | sí |
| `/api/apelaciones` | api | permitir | permite | sí |
| `/api/apelaciones/mias` | api | permitir | permite | sí |
| `/api/auth/activar` | api | permitir | permite | sí |
| `/api/auth/cambiar-password` | api | permitir | permite | sí |
| `/api/auth/login` | api | permitir | permite | sí |
| `/api/auth/logout` | api | permitir | permite | sí |
| `/api/auth/recuperar/restablecer` | api | permitir | permite | sí |
| `/api/auth/recuperar/solicitar` | api | permitir | permite | sí |
| `/api/auth/recuperar/validar` | api | permitir | permite | sí |
| `/api/auth/register` | api | permitir | permite | sí |
| `/api/auth/verificar/completar` | api | permitir | permite | sí |
| `/api/auth/verificar/solicitar` | api | permitir | permite | sí |
| `/api/auth/verificar/validar` | api | permitir | permite | sí |
| `/api/circulo-confianza` | api | permitir | permite | sí |
| `/api/circulo-confianza/[id]` | api | permitir | permite | sí |
| `/api/circulo-confianza/agregado` | api | permitir | permite | sí |
| `/api/circulo-confianza/preferencias` | api | permitir | permite | sí |
| `/api/ciudades` | api | permitir | permite | sí |
| `/api/ciudades/buscar` | api | permitir | permite | sí |
| `/api/colegio` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/asignar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/escalar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/observacion` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa/excel` | api | permitir | permite | sí |
| `/api/colegio/auditoria` | api | permitir | permite | sí |
| `/api/colegio/buscar` | api | permitir | permite | sí |
| `/api/colegio/carga/confirmar` | api | permitir | permite | sí |
| `/api/colegio/carga/plantilla` | api | permitir | permite | sí |
| `/api/colegio/carga/validar` | api | permitir | permite | sí |
| `/api/colegio/cobertura` | api | permitir | permite | sí |
| `/api/colegio/comite` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta/regenerar-password` | api | permitir | permite | sí |
| `/api/colegio/comite/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/resolver` | api | permitir | permite | sí |
| `/api/colegio/confianza/auditoria` | api | permitir | permite | sí |
| `/api/colegio/confianza/documentos` | api | permitir | permite | sí |
| `/api/colegio/confianza/protocolo/pdf` | api | permitir | permite | sí |
| `/api/colegio/cursos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/alumnos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/duplicar` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/plantilla` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/validar` | api | permitir | permite | sí |
| `/api/colegio/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/estadisticas/pdf` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/materias` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/notificaciones` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/marcar-leidas` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/colegio/onboarding` | api | permitir | permite | sí |
| `/api/colegio/patrones` | api | permitir | permite | sí |
| `/api/colegio/preferencias-avisos` | api | permitir | permite | sí |
| `/api/colegio/profesores` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/reportes/pdf` | api | permitir | permite | sí |
| `/api/colegio/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/colegio/usuarios` | api | permitir | permite | sí |
| `/api/config/parametros` | api | permitir | permite | sí |
| `/api/config/parametros/[clave]` | api | permitir | permite | sí |
| `/api/config/parametros/[clave]/revelar` | api | permitir | permite | sí |
| `/api/config/parametros/publicos` | api | permitir | permite | sí |
| `/api/config/parametros/todos` | api | permitir | permite | sí |
| `/api/consentimiento/aceptar` | api | permitir | permite | sí |
| `/api/consulta` | api | permitir | permite | sí |
| `/api/consulta/detalle` | api | permitir | permite | sí |
| `/api/consulta/evento` | api | permitir | permite | sí |
| `/api/departamentos` | api | permitir | permite | sí |
| `/api/docs/indice` | api | permitir | permite | sí |
| `/api/estadisticas-publicas` | api | permitir | permite | sí |
| `/api/health` | api | permitir | permite | sí |
| `/api/health/worker` | api | permitir | permite | sí |
| `/api/interno/expediente/[id]/transicionar` | api | permitir | permite | sí |
| `/api/me` | api | permitir | permite | sí |
| `/api/me/colegio` | api | permitir | permite | sí |
| `/api/monitor/notif` | api | permitir | permite | sí |
| `/api/notificaciones` | api | permitir | permite | sí |
| `/api/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/notificaciones/preferencias` | api | permitir | permite | sí |
| `/api/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/semaforo` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/timeline` | api | permitir | permite | sí |
| `/api/padre/contacto-emergencia` | api | permitir | permite | sí |
| `/api/padre/contacto-emergencia/[id]` | api | permitir | permite | sí |
| `/api/padre/expediente/[id]/cerrar-forzoso` | api | permitir | permite | sí |
| `/api/padre/expediente/[id]/pedir-aclaracion` | api | permitir | permite | sí |
| `/api/padre/expedientes/[id]/eventos` | api | permitir | permite | sí |
| `/api/padre/suscripcion/activar-freemium` | api | permitir | permite | sí |
| `/api/padre/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/pagos` | api | permitir | permite | sí |
| `/api/pagos/aplicar-bono` | api | permitir | permite | sí |
| `/api/pagos/aplicar-referido` | api | permitir | permite | sí |
| `/api/pagos/planes` | api | permitir | permite | sí |
| `/api/pagos/renovacion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/cancelar` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/estado` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/validar-bono` | api | permitir | permite | sí |
| `/api/paises` | api | permitir | permite | sí |
| `/api/plataformas` | api | permitir | permite | sí |
| `/api/publico/guia-accion/categoria/[cat]` | api | permitir | permite | sí |
| `/api/publico/verificar-pdf/[hash]` | api | permitir | permite | sí |
| `/api/reportes` | api | permitir | permite | sí |
| `/api/reportes/fallback` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes/[id]` | api | permitir | permite | sí |
| `/api/reportes/procesar` | api | permitir | permite | sí |
| `/api/reportes/seguimiento` | api | permitir | permite | sí |
| `/api/reportes/seguimiento/[numero]` | api | permitir | permite | sí |
| `/api/session/ping` | api | permitir | permite | sí |
| `/api/vigencia/refresh` | api | permitir | permite | sí |
| `/api/webhooks/resend` | api | permitir | permite | sí |
| `/cambiar-password` | página | permitir | permite | sí |
| `/consentimiento` | página | permitir | permite | sí |
| `/consulta` | página | permitir | permite | sí |
| `/dashboard` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard-publico` | página | permitir | permite | sí |
| `/dashboard/admin` | página | permitir | permite | sí |
| `/dashboard/admin/analisis/recomendaciones` | página | permitir | permite | sí |
| `/dashboard/admin/analisis/reglas` | página | permitir | permite | sí |
| `/dashboard/admin/anti-abuso` | página | permitir | permite | sí |
| `/dashboard/admin/colegios` | página | permitir | permite | sí |
| `/dashboard/admin/colegios/[id]/estructura` | página | permitir | permite | sí |
| `/dashboard/admin/colegios/nuevo` | página | permitir | permite | sí |
| `/dashboard/admin/comite` | página | permitir | permite | sí |
| `/dashboard/admin/comite/aclaracion/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/comite/apelaciones` | página | permitir | permite | sí |
| `/dashboard/admin/comite/auditoria` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/admin/comite/consolidacion/[expedienteId]` | página | permitir | permite | sí |
| `/dashboard/admin/comite/gestion` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/admin/comite/guias-pendientes` | página | permitir | permite | sí |
| `/dashboard/admin/configuracion` | página | permitir | permite | sí |
| `/dashboard/admin/configuracion/guias-accion` | página | permitir | permite | sí |
| `/dashboard/admin/dataset-entrenamiento` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/clasificacion` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/dinero-vs-valor` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/motor` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/operacion` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/salud-motor` | página | permitir | permite | sí |
| `/dashboard/admin/ia` | página | permitir | permite | sí |
| `/dashboard/admin/identificador/[nick]` | página | permitir | permite | sí |
| `/dashboard/admin/monitoreo/worker` | página | permitir | permite | sí |
| `/dashboard/admin/operadores` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/asignar` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/auditoria` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/gestion` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/modelo` | página | permitir | permite | sí |
| `/dashboard/admin/padres` | página | permitir | permite | sí |
| `/dashboard/admin/padres/[id]/circulo` | página | permitir | permite | sí |
| `/dashboard/admin/pagos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/analitica` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/bonos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/cliente/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/mora` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/pendientes` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/planes` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/reembolsos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/sin-suscripcion` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/vencimientos` | página | permitir | permite | sí |
| `/dashboard/admin/spam` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/admins` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/comite-convivencia` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/comite-validacion` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/operadores` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/rectores` | página | permitir | permite | sí |
| `/dashboard/apelaciones` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/circulo-confianza` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/alertas` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/alertas/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/alumnos/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/analisis/comparativa` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/auditoria` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite/casos` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite/casos/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite/estadisticas` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/comite/integrantes` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/confianza` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/configuracion` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos/carga` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos/nuevo` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/cursos/unificado` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/estadisticas` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/materias` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/onboarding` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/profesores` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/profesores/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/suscripcion` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/colegio/tablero` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/mis-reportes/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/circulo-confianza` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/expedientes` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/expedientes/[id]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/identificador/[nick]` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/notificaciones` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/perfil` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/reportar` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/padre/suscripcion` | página | redirigir→/dashboard/admin | no permite | sí |
| `/dashboard/perfil` | página | permitir | permite | sí |
| `/dashboard/perfil/notificaciones` | página | permitir | permite | sí |
| `/docs` | página | permitir | permite | sí |
| `/docs/operar` | página | permitir | permite | sí |
| `/docs/tecnico` | página | permitir | permite | sí |
| `/login` | página | permitir | permite | sí |
| `/mis-reportes` | página | redirigir→/dashboard/admin | no permite | sí |
| `/offline` | página | permitir | permite | sí |
| `/privacidad` | página | permitir | permite | sí |
| `/recuperar` | página | permitir | permite | sí |
| `/recuperar/[token]` | página | permitir | permite | sí |
| `/registro` | página | permitir | permite | sí |
| `/registro-colegio` | página | permitir | permite | sí |
| `/registro/inicio` | página | permitir | permite | sí |
| `/reportar` | página | redirigir→/dashboard/admin | no permite | sí |
| `/seguimiento` | página | permitir | permite | sí |
| `/terminos` | página | permitir | permite | sí |

### COMITE_VALIDACION

| Ruta | Tipo | Puerta (`proxy()`) | Predicado | Alineado |
| --- | --- | --- | --- | --- |
| `/` | página | permitir | permite | sí |
| `//` | página | permitir | permite | sí |
| `/activar` | página | permitir | permite | sí |
| `/api/` | api | permitir | permite | sí |
| `/api/admin` | api | permitir | permite | sí |
| `/api/admin/analisis/anomalias` | api | permitir | permite | sí |
| `/api/admin/analisis/anomalias/[id]` | api | permitir | permite | sí |
| `/api/admin/analisis/dinero-vs-valor` | api | permitir | permite | sí |
| `/api/admin/analisis/dispersion` | api | permitir | permite | sí |
| `/api/admin/analisis/kpis` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/export` | api | permitir | permite | sí |
| `/api/admin/analisis/recomendaciones/metricas` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]/historial` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/[id]/modo` | api | permitir | permite | sí |
| `/api/admin/analisis/reglas/test-sql` | api | permitir | permite | sí |
| `/api/admin/analisis/top-decisiones` | api | permitir | permite | sí |
| `/api/admin/analytics/colegios` | api | permitir | permite | sí |
| `/api/admin/analytics/colegios/[id]` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/bloquear` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/desbloquear` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simulacion-score` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/[id]` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/simular/sugerencias` | api | permitir | permite | sí |
| `/api/admin/anti-abuso/tablero` | api | permitir | permite | sí |
| `/api/admin/audit-logs` | api | permitir | permite | sí |
| `/api/admin/colegios` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/cursos` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/reenviar-email` | api | permitir | permite | sí |
| `/api/admin/colegios/[id]/regenerar-password` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/asignar` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/reasignar` | api | permitir | permite | sí |
| `/api/admin/comite/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/comite/aclaracion/[id]/responder` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/documento` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/resolver` | api | permitir | permite | sí |
| `/api/admin/comite/apelaciones/[id]/tomar` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | api | permitir | permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | api | permitir | permite | sí |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion/[id]/aprobar` | api | permitir | permite | sí |
| `/api/admin/comite/guias-accion/[id]/rechazar` | api | permitir | permite | sí |
| `/api/admin/comite/integrantes` | api | permitir | permite | sí |
| `/api/admin/comite/integrantes/[id]` | api | permitir | permite | sí |
| `/api/admin/comite/mias` | api | permitir | permite | sí |
| `/api/admin/comite/pendientes` | api | permitir | permite | sí |
| `/api/admin/comite/solicitudes` | api | permitir | permite | sí |
| `/api/admin/correcciones` | api | permitir | permite | sí |
| `/api/admin/dataset-entrenamiento` | api | permitir | permite | sí |
| `/api/admin/estadisticas` | api | permitir | permite | sí |
| `/api/admin/estadisticas/clasificacion` | api | permitir | permite | sí |
| `/api/admin/estadisticas/denuncias-formales` | api | permitir | permite | sí |
| `/api/admin/estadisticas/dinero-vs-valor` | api | permitir | permite | sí |
| `/api/admin/guias-accion` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]/enviar-comite` | api | permitir | permite | sí |
| `/api/admin/guias-accion/[id]/preview` | api | permitir | permite | sí |
| `/api/admin/ia/modelos` | api | permitir | permite | sí |
| `/api/admin/ia/ollama/probar` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/config` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/definiciones` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | api | permitir | permite | sí |
| `/api/admin/ia/rubrica/preguntas` | api | permitir | permite | sí |
| `/api/admin/ia/sandbox` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/analisis` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/cancelar` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/export` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/[id]/resultados` | api | permitir | permite | sí |
| `/api/admin/ia/simulaciones/comparar` | api | permitir | permite | sí |
| `/api/admin/matches` | api | permitir | permite | sí |
| `/api/admin/monitoreo/atascados` | api | permitir | permite | sí |
| `/api/admin/monitoreo/estado` | api | permitir | permite | sí |
| `/api/admin/monitoreo/historial` | api | permitir | permite | sí |
| `/api/admin/monitoreo/incidentes` | api | permitir | permite | sí |
| `/api/admin/monitoreo/logs` | api | permitir | permite | sí |
| `/api/admin/motor/deriva` | api | permitir | permite | sí |
| `/api/admin/motor/deriva/recalcular` | api | permitir | permite | sí |
| `/api/admin/notificaciones/bandeja` | api | permitir | permite | sí |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | api | permitir | permite | sí |
| `/api/admin/notificaciones/catalogos` | api | permitir | permite | sí |
| `/api/admin/notificaciones/parametros` | api | permitir | permite | sí |
| `/api/admin/notificaciones/parametros/[clave]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | api | permitir | permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | api | permitir | permite | sí |
| `/api/admin/notificaciones/salud` | api | permitir | permite | sí |
| `/api/admin/operadores` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/casos` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/metricas` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/reenviar-email` | api | permitir | permite | sí |
| `/api/admin/operadores/[id]/regenerar-password` | api | permitir | permite | sí |
| `/api/admin/operadores/asignacion` | api | permitir | permite | sí |
| `/api/admin/operadores/modelo` | api | permitir | permite | sí |
| `/api/admin/operadores/reasignar` | api | permitir | permite | sí |
| `/api/admin/padres` | api | permitir | permite | sí |
| `/api/admin/padres/[id]` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/circulo-confianza` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/restablecer-password` | api | permitir | permite | sí |
| `/api/admin/padres/[id]/vigencia` | api | permitir | permite | sí |
| `/api/admin/pagos/activar-manual` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/bonos/[id]/desactivar` | api | permitir | permite | sí |
| `/api/admin/pagos/cliente/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/cliente/[id]/extender` | api | permitir | permite | sí |
| `/api/admin/pagos/mora` | api | permitir | permite | sí |
| `/api/admin/pagos/parametros` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes/[id]/autorizar` | api | permitir | permite | sí |
| `/api/admin/pagos/pendientes/[id]/rechazar` | api | permitir | permite | sí |
| `/api/admin/pagos/planes` | api | permitir | permite | sí |
| `/api/admin/pagos/planes/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/reembolsos` | api | permitir | permite | sí |
| `/api/admin/pagos/reembolsos/[id]` | api | permitir | permite | sí |
| `/api/admin/pagos/sin-suscripcion` | api | permitir | permite | sí |
| `/api/admin/pagos/solicitudes-pendientes` | api | permitir | permite | sí |
| `/api/admin/pagos/tasas` | api | permitir | permite | sí |
| `/api/admin/pagos/vencimientos` | api | permitir | permite | sí |
| `/api/admin/permisos-modulos` | api | permitir | permite | sí |
| `/api/admin/reportes-revision` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]/confirmar` | api | permitir | permite | sí |
| `/api/admin/reportes-revision/[id]/reasignar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/anonimizar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/baja` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/denuncia-formal` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/escalar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/expediente` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/forense` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/forense/pdf` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/proceso` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/reactivar` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/resolver-spam` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/revelar-original` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/transiciones` | api | permitir | permite | sí |
| `/api/admin/reportes/[id]/validar-anonimizacion` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/restart` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/start` | api | permitir | permite | sí |
| `/api/admin/servicios/[nombre]/stop` | api | permitir | permite | sí |
| `/api/admin/servicios/estado` | api | permitir | permite | sí |
| `/api/admin/sesiones` | api | permitir | permite | sí |
| `/api/admin/sesiones/[id]/cerrar` | api | permitir | permite | sí |
| `/api/admin/spam/analitica` | api | permitir | permite | sí |
| `/api/admin/spam/banco-sugerencias` | api | permitir | permite | sí |
| `/api/admin/spam/pendientes` | api | permitir | permite | sí |
| `/api/admin/usuarios` | api | permitir | permite | sí |
| `/api/admin/usuarios/[id]` | api | permitir | permite | sí |
| `/api/admin/usuarios/dashboard` | api | permitir | permite | sí |
| `/api/alertas` | api | permitir | permite | sí |
| `/api/alertas/[id]` | api | permitir | permite | sí |
| `/api/alertas/suscribir` | api | permitir | permite | sí |
| `/api/apelaciones` | api | permitir | permite | sí |
| `/api/apelaciones/mias` | api | permitir | permite | sí |
| `/api/auth/activar` | api | permitir | permite | sí |
| `/api/auth/cambiar-password` | api | permitir | permite | sí |
| `/api/auth/login` | api | permitir | permite | sí |
| `/api/auth/logout` | api | permitir | permite | sí |
| `/api/auth/recuperar/restablecer` | api | permitir | permite | sí |
| `/api/auth/recuperar/solicitar` | api | permitir | permite | sí |
| `/api/auth/recuperar/validar` | api | permitir | permite | sí |
| `/api/auth/register` | api | permitir | permite | sí |
| `/api/auth/verificar/completar` | api | permitir | permite | sí |
| `/api/auth/verificar/solicitar` | api | permitir | permite | sí |
| `/api/auth/verificar/validar` | api | permitir | permite | sí |
| `/api/circulo-confianza` | api | permitir | permite | sí |
| `/api/circulo-confianza/[id]` | api | permitir | permite | sí |
| `/api/circulo-confianza/agregado` | api | permitir | permite | sí |
| `/api/circulo-confianza/preferencias` | api | permitir | permite | sí |
| `/api/ciudades` | api | permitir | permite | sí |
| `/api/ciudades/buscar` | api | permitir | permite | sí |
| `/api/colegio` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/asignar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/escalar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/observacion` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa/excel` | api | permitir | permite | sí |
| `/api/colegio/auditoria` | api | permitir | permite | sí |
| `/api/colegio/buscar` | api | permitir | permite | sí |
| `/api/colegio/carga/confirmar` | api | permitir | permite | sí |
| `/api/colegio/carga/plantilla` | api | permitir | permite | sí |
| `/api/colegio/carga/validar` | api | permitir | permite | sí |
| `/api/colegio/cobertura` | api | permitir | permite | sí |
| `/api/colegio/comite` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta/regenerar-password` | api | permitir | permite | sí |
| `/api/colegio/comite/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/resolver` | api | permitir | permite | sí |
| `/api/colegio/confianza/auditoria` | api | permitir | permite | sí |
| `/api/colegio/confianza/documentos` | api | permitir | permite | sí |
| `/api/colegio/confianza/protocolo/pdf` | api | permitir | permite | sí |
| `/api/colegio/cursos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/alumnos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/duplicar` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/plantilla` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/validar` | api | permitir | permite | sí |
| `/api/colegio/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/estadisticas/pdf` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/materias` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/notificaciones` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/marcar-leidas` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/colegio/onboarding` | api | permitir | permite | sí |
| `/api/colegio/patrones` | api | permitir | permite | sí |
| `/api/colegio/preferencias-avisos` | api | permitir | permite | sí |
| `/api/colegio/profesores` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/reportes/pdf` | api | permitir | permite | sí |
| `/api/colegio/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/colegio/usuarios` | api | permitir | permite | sí |
| `/api/config/parametros` | api | permitir | permite | sí |
| `/api/config/parametros/[clave]` | api | permitir | permite | sí |
| `/api/config/parametros/[clave]/revelar` | api | permitir | permite | sí |
| `/api/config/parametros/publicos` | api | permitir | permite | sí |
| `/api/config/parametros/todos` | api | permitir | permite | sí |
| `/api/consentimiento/aceptar` | api | permitir | permite | sí |
| `/api/consulta` | api | permitir | permite | sí |
| `/api/consulta/detalle` | api | permitir | permite | sí |
| `/api/consulta/evento` | api | permitir | permite | sí |
| `/api/departamentos` | api | permitir | permite | sí |
| `/api/docs/indice` | api | permitir | permite | sí |
| `/api/estadisticas-publicas` | api | permitir | permite | sí |
| `/api/health` | api | permitir | permite | sí |
| `/api/health/worker` | api | permitir | permite | sí |
| `/api/interno/expediente/[id]/transicionar` | api | permitir | permite | sí |
| `/api/me` | api | permitir | permite | sí |
| `/api/me/colegio` | api | permitir | permite | sí |
| `/api/monitor/notif` | api | permitir | permite | sí |
| `/api/notificaciones` | api | permitir | permite | sí |
| `/api/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/notificaciones/preferencias` | api | permitir | permite | sí |
| `/api/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/semaforo` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/timeline` | api | permitir | permite | sí |
| `/api/padre/contacto-emergencia` | api | permitir | permite | sí |
| `/api/padre/contacto-emergencia/[id]` | api | permitir | permite | sí |
| `/api/padre/expediente/[id]/cerrar-forzoso` | api | permitir | permite | sí |
| `/api/padre/expediente/[id]/pedir-aclaracion` | api | permitir | permite | sí |
| `/api/padre/expedientes/[id]/eventos` | api | permitir | permite | sí |
| `/api/padre/suscripcion/activar-freemium` | api | permitir | permite | sí |
| `/api/padre/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/pagos` | api | permitir | permite | sí |
| `/api/pagos/aplicar-bono` | api | permitir | permite | sí |
| `/api/pagos/aplicar-referido` | api | permitir | permite | sí |
| `/api/pagos/planes` | api | permitir | permite | sí |
| `/api/pagos/renovacion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/cancelar` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/estado` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/validar-bono` | api | permitir | permite | sí |
| `/api/paises` | api | permitir | permite | sí |
| `/api/plataformas` | api | permitir | permite | sí |
| `/api/publico/guia-accion/categoria/[cat]` | api | permitir | permite | sí |
| `/api/publico/verificar-pdf/[hash]` | api | permitir | permite | sí |
| `/api/reportes` | api | permitir | permite | sí |
| `/api/reportes/fallback` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes/[id]` | api | permitir | permite | sí |
| `/api/reportes/procesar` | api | permitir | permite | sí |
| `/api/reportes/seguimiento` | api | permitir | permite | sí |
| `/api/reportes/seguimiento/[numero]` | api | permitir | permite | sí |
| `/api/session/ping` | api | permitir | permite | sí |
| `/api/vigencia/refresh` | api | permitir | permite | sí |
| `/api/webhooks/resend` | api | permitir | permite | sí |
| `/cambiar-password` | página | permitir | permite | sí |
| `/consentimiento` | página | permitir | permite | sí |
| `/consulta` | página | permitir | permite | sí |
| `/dashboard` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard-publico` | página | permitir | permite | sí |
| `/dashboard/admin` | página | permitir | permite | sí |
| `/dashboard/admin/analisis/recomendaciones` | página | permitir | permite | sí |
| `/dashboard/admin/analisis/reglas` | página | permitir | permite | sí |
| `/dashboard/admin/anti-abuso` | página | permitir | permite | sí |
| `/dashboard/admin/colegios` | página | permitir | permite | sí |
| `/dashboard/admin/colegios/[id]/estructura` | página | permitir | permite | sí |
| `/dashboard/admin/colegios/nuevo` | página | permitir | permite | sí |
| `/dashboard/admin/comite` | página | permitir | permite | sí |
| `/dashboard/admin/comite/aclaracion/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/comite/apelaciones` | página | permitir | permite | sí |
| `/dashboard/admin/comite/auditoria` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/admin/comite/consolidacion/[expedienteId]` | página | permitir | permite | sí |
| `/dashboard/admin/comite/gestion` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/admin/comite/guias-pendientes` | página | permitir | permite | sí |
| `/dashboard/admin/configuracion` | página | permitir | permite | sí |
| `/dashboard/admin/configuracion/guias-accion` | página | permitir | permite | sí |
| `/dashboard/admin/dataset-entrenamiento` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/clasificacion` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/dinero-vs-valor` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/motor` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/operacion` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` | página | permitir | permite | sí |
| `/dashboard/admin/estadisticas/salud-motor` | página | permitir | permite | sí |
| `/dashboard/admin/ia` | página | permitir | permite | sí |
| `/dashboard/admin/identificador/[nick]` | página | permitir | permite | sí |
| `/dashboard/admin/monitoreo/worker` | página | permitir | permite | sí |
| `/dashboard/admin/operadores` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/asignar` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/auditoria` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/gestion` | página | permitir | permite | sí |
| `/dashboard/admin/operadores/modelo` | página | permitir | permite | sí |
| `/dashboard/admin/padres` | página | permitir | permite | sí |
| `/dashboard/admin/padres/[id]/circulo` | página | permitir | permite | sí |
| `/dashboard/admin/pagos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/analitica` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/bonos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/cliente/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/mora` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/pendientes` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/planes` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/reembolsos` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/sin-suscripcion` | página | permitir | permite | sí |
| `/dashboard/admin/pagos/vencimientos` | página | permitir | permite | sí |
| `/dashboard/admin/spam` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/[id]` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/admins` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/comite-convivencia` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/comite-validacion` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/operadores` | página | permitir | permite | sí |
| `/dashboard/admin/usuarios/rectores` | página | permitir | permite | sí |
| `/dashboard/apelaciones` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/circulo-confianza` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/alertas` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/alertas/[id]` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/alumnos/[id]` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/analisis/comparativa` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/auditoria` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/comite` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/comite/casos` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/comite/casos/[id]` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/comite/estadisticas` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/comite/integrantes` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/confianza` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/configuracion` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/cursos` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/cursos/[id]` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/cursos/carga` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/cursos/nuevo` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/cursos/unificado` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/estadisticas` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/materias` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/onboarding` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/profesores` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/profesores/[id]` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/suscripcion` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/colegio/tablero` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/mis-reportes/[id]` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre/circulo-confianza` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre/expedientes` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre/expedientes/[id]` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre/identificador/[nick]` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre/notificaciones` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre/perfil` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre/reportar` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/padre/suscripcion` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/dashboard/perfil` | página | permitir | permite | sí |
| `/dashboard/perfil/notificaciones` | página | permitir | permite | sí |
| `/docs` | página | permitir | permite | sí |
| `/docs/operar` | página | permitir | permite | sí |
| `/docs/tecnico` | página | permitir | permite | sí |
| `/login` | página | permitir | permite | sí |
| `/mis-reportes` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/offline` | página | permitir | permite | sí |
| `/privacidad` | página | permitir | permite | sí |
| `/recuperar` | página | permitir | permite | sí |
| `/recuperar/[token]` | página | permitir | permite | sí |
| `/registro` | página | permitir | permite | sí |
| `/registro-colegio` | página | permitir | permite | sí |
| `/registro/inicio` | página | permitir | permite | sí |
| `/reportar` | página | redirigir→/dashboard/admin/comite | no permite | sí |
| `/seguimiento` | página | permitir | permite | sí |
| `/terminos` | página | permitir | permite | sí |

### SCHOOL_ADMIN

| Ruta | Tipo | Puerta (`proxy()`) | Predicado | Alineado |
| --- | --- | --- | --- | --- |
| `/` | página | permitir | permite | sí |
| `//` | página | permitir | permite | sí |
| `/activar` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/api/` | api | HTTP 403 | no permite | sí |
| `/api/admin` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/anomalias` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/anomalias/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/dinero-vs-valor` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/dispersion` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/kpis` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/export` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/metricas` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]/historial` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]/modo` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/test-sql` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/top-decisiones` | api | HTTP 403 | no permite | sí |
| `/api/admin/analytics/colegios` | api | HTTP 403 | no permite | sí |
| `/api/admin/analytics/colegios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/bloquear` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/desbloquear` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simulacion-score` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/sugerencias` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/tablero` | api | HTTP 403 | no permite | sí |
| `/api/admin/audit-logs` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/cursos` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/reenviar-email` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/regenerar-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/asignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/aclaracion/[id]/responder` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/documento` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/tomar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion/[id]/aprobar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion/[id]/rechazar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/integrantes` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/integrantes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/mias` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/solicitudes` | api | HTTP 403 | no permite | sí |
| `/api/admin/correcciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/dataset-entrenamiento` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/clasificacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/denuncias-formales` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/dinero-vs-valor` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]/enviar-comite` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]/preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/modelos` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/ollama/probar` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/config` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/definiciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/preguntas` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/sandbox` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/analisis` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/cancelar` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/export` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/resultados` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/comparar` | api | HTTP 403 | no permite | sí |
| `/api/admin/matches` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/atascados` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/estado` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/historial` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/incidentes` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/logs` | api | HTTP 403 | no permite | sí |
| `/api/admin/motor/deriva` | api | HTTP 403 | no permite | sí |
| `/api/admin/motor/deriva/recalcular` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/bandeja` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/catalogos` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/parametros` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/parametros/[clave]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/salud` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/casos` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/metricas` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/reenviar-email` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/regenerar-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/asignacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/modelo` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/circulo-confianza` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/restablecer-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/vigencia` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/activar-manual` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos/[id]/desactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/cliente/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/cliente/[id]/extender` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/mora` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/parametros` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes/[id]/autorizar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes/[id]/rechazar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/planes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/planes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/reembolsos` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/reembolsos/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/sin-suscripcion` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/solicitudes-pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/tasas` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/vencimientos` | api | HTTP 403 | no permite | sí |
| `/api/admin/permisos-modulos` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]/confirmar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/anonimizar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/baja` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/denuncia-formal` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/escalar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/expediente` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/forense` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/forense/pdf` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/proceso` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/resolver-spam` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/revelar-original` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/transiciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/validar-anonimizacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/restart` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/start` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/stop` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/estado` | api | HTTP 403 | no permite | sí |
| `/api/admin/sesiones` | api | HTTP 403 | no permite | sí |
| `/api/admin/sesiones/[id]/cerrar` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/analitica` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/banco-sugerencias` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios/dashboard` | api | HTTP 403 | no permite | sí |
| `/api/alertas` | api | HTTP 403 | no permite | sí |
| `/api/alertas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/alertas/suscribir` | api | HTTP 403 | no permite | sí |
| `/api/apelaciones` | api | HTTP 403 | no permite | sí |
| `/api/apelaciones/mias` | api | HTTP 403 | no permite | sí |
| `/api/auth/activar` | api | HTTP 403 | no permite | sí |
| `/api/auth/cambiar-password` | api | permitir | permite | sí |
| `/api/auth/login` | api | HTTP 403 | no permite | sí |
| `/api/auth/logout` | api | permitir | permite | sí |
| `/api/auth/recuperar/restablecer` | api | HTTP 403 | no permite | sí |
| `/api/auth/recuperar/solicitar` | api | HTTP 403 | no permite | sí |
| `/api/auth/recuperar/validar` | api | HTTP 403 | no permite | sí |
| `/api/auth/register` | api | HTTP 403 | no permite | sí |
| `/api/auth/verificar/completar` | api | HTTP 403 | no permite | sí |
| `/api/auth/verificar/solicitar` | api | HTTP 403 | no permite | sí |
| `/api/auth/verificar/validar` | api | HTTP 403 | no permite | sí |
| `/api/circulo-confianza` | api | HTTP 403 | no permite | sí |
| `/api/circulo-confianza/[id]` | api | HTTP 403 | no permite | sí |
| `/api/circulo-confianza/agregado` | api | HTTP 403 | no permite | sí |
| `/api/circulo-confianza/preferencias` | api | HTTP 403 | no permite | sí |
| `/api/ciudades` | api | HTTP 403 | no permite | sí |
| `/api/ciudades/buscar` | api | HTTP 403 | no permite | sí |
| `/api/colegio` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/asignar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/escalar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/observacion` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa/excel` | api | permitir | permite | sí |
| `/api/colegio/auditoria` | api | permitir | permite | sí |
| `/api/colegio/buscar` | api | permitir | permite | sí |
| `/api/colegio/carga/confirmar` | api | permitir | permite | sí |
| `/api/colegio/carga/plantilla` | api | permitir | permite | sí |
| `/api/colegio/carga/validar` | api | permitir | permite | sí |
| `/api/colegio/cobertura` | api | permitir | permite | sí |
| `/api/colegio/comite` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta/regenerar-password` | api | permitir | permite | sí |
| `/api/colegio/comite/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/resolver` | api | permitir | permite | sí |
| `/api/colegio/confianza/auditoria` | api | permitir | permite | sí |
| `/api/colegio/confianza/documentos` | api | permitir | permite | sí |
| `/api/colegio/confianza/protocolo/pdf` | api | permitir | permite | sí |
| `/api/colegio/cursos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/alumnos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/duplicar` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/plantilla` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/validar` | api | permitir | permite | sí |
| `/api/colegio/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/estadisticas/pdf` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/materias` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/notificaciones` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/marcar-leidas` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/colegio/onboarding` | api | permitir | permite | sí |
| `/api/colegio/patrones` | api | permitir | permite | sí |
| `/api/colegio/preferencias-avisos` | api | permitir | permite | sí |
| `/api/colegio/profesores` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/reportes/pdf` | api | permitir | permite | sí |
| `/api/colegio/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/colegio/usuarios` | api | permitir | permite | sí |
| `/api/config/parametros` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros/[clave]` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros/[clave]/revelar` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros/publicos` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros/todos` | api | HTTP 403 | no permite | sí |
| `/api/consentimiento/aceptar` | api | permitir | permite | sí |
| `/api/consulta` | api | permitir | permite | sí |
| `/api/consulta/detalle` | api | permitir | permite | sí |
| `/api/consulta/evento` | api | permitir | permite | sí |
| `/api/departamentos` | api | HTTP 403 | no permite | sí |
| `/api/docs/indice` | api | HTTP 403 | no permite | sí |
| `/api/estadisticas-publicas` | api | permitir | permite | sí |
| `/api/health` | api | HTTP 403 | no permite | sí |
| `/api/health/worker` | api | HTTP 403 | no permite | sí |
| `/api/interno/expediente/[id]/transicionar` | api | HTTP 403 | no permite | sí |
| `/api/me` | api | permitir | permite | sí |
| `/api/me/colegio` | api | permitir | permite | sí |
| `/api/monitor/notif` | api | HTTP 403 | no permite | sí |
| `/api/notificaciones` | api | permitir | permite | sí |
| `/api/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/notificaciones/preferencias` | api | permitir | permite | sí |
| `/api/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/semaforo` | api | HTTP 403 | no permite | sí |
| `/api/padre/circulo-confianza/timeline` | api | HTTP 403 | no permite | sí |
| `/api/padre/contacto-emergencia` | api | HTTP 403 | no permite | sí |
| `/api/padre/contacto-emergencia/[id]` | api | HTTP 403 | no permite | sí |
| `/api/padre/expediente/[id]/cerrar-forzoso` | api | HTTP 403 | no permite | sí |
| `/api/padre/expediente/[id]/pedir-aclaracion` | api | HTTP 403 | no permite | sí |
| `/api/padre/expedientes/[id]/eventos` | api | HTTP 403 | no permite | sí |
| `/api/padre/suscripcion/activar-freemium` | api | HTTP 403 | no permite | sí |
| `/api/padre/suscripcion/solicitar-plan` | api | HTTP 403 | no permite | sí |
| `/api/pagos` | api | permitir | permite | sí |
| `/api/pagos/aplicar-bono` | api | permitir | permite | sí |
| `/api/pagos/aplicar-referido` | api | permitir | permite | sí |
| `/api/pagos/planes` | api | permitir | permite | sí |
| `/api/pagos/renovacion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/cancelar` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/estado` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/validar-bono` | api | permitir | permite | sí |
| `/api/paises` | api | HTTP 403 | no permite | sí |
| `/api/plataformas` | api | HTTP 403 | no permite | sí |
| `/api/publico/guia-accion/categoria/[cat]` | api | HTTP 403 | no permite | sí |
| `/api/publico/verificar-pdf/[hash]` | api | HTTP 403 | no permite | sí |
| `/api/reportes` | api | HTTP 403 | no permite | sí |
| `/api/reportes/fallback` | api | HTTP 403 | no permite | sí |
| `/api/reportes/mis-reportes` | api | HTTP 403 | no permite | sí |
| `/api/reportes/mis-reportes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/reportes/procesar` | api | HTTP 403 | no permite | sí |
| `/api/reportes/seguimiento` | api | permitir | permite | sí |
| `/api/reportes/seguimiento/[numero]` | api | permitir | permite | sí |
| `/api/session/ping` | api | HTTP 403 | no permite | sí |
| `/api/vigencia/refresh` | api | permitir | permite | sí |
| `/api/webhooks/resend` | api | HTTP 403 | no permite | sí |
| `/cambiar-password` | página | permitir | permite | sí |
| `/consentimiento` | página | permitir | permite | sí |
| `/consulta` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard-publico` | página | permitir | permite | sí |
| `/dashboard/admin` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/analisis/recomendaciones` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/analisis/reglas` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/anti-abuso` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/colegios` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/colegios/[id]/estructura` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/colegios/nuevo` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/comite` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/comite/aclaracion/[id]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/comite/apelaciones` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/comite/auditoria` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/comite/consolidacion/[expedienteId]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/comite/gestion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/comite/guias-pendientes` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/configuracion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/configuracion/guias-accion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/dataset-entrenamiento` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/estadisticas` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/estadisticas/clasificacion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/estadisticas/dinero-vs-valor` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/estadisticas/motor` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/estadisticas/operacion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/estadisticas/salud-motor` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/ia` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/identificador/[nick]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/monitoreo/worker` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/operadores` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/operadores/[id]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/operadores/asignar` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/operadores/auditoria` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/operadores/gestion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/operadores/modelo` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/padres` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/padres/[id]/circulo` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/analitica` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/bonos` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/cliente/[id]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/mora` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/pendientes` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/planes` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/reembolsos` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/sin-suscripcion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/pagos/vencimientos` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/spam` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/usuarios` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/usuarios/[id]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/usuarios/admins` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/usuarios/comite-convivencia` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/usuarios/comite-validacion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/usuarios/operadores` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/admin/usuarios/rectores` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/apelaciones` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/circulo-confianza` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/colegio` | página | permitir | permite | sí |
| `/dashboard/colegio/alertas` | página | permitir | permite | sí |
| `/dashboard/colegio/alertas/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/alumnos/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/analisis/comparativa` | página | permitir | permite | sí |
| `/dashboard/colegio/auditoria` | página | permitir | permite | sí |
| `/dashboard/colegio/comite` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/casos` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/casos/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/estadisticas` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/integrantes` | página | permitir | permite | sí |
| `/dashboard/colegio/confianza` | página | permitir | permite | sí |
| `/dashboard/colegio/configuracion` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos/carga` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos/nuevo` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos/unificado` | página | permitir | permite | sí |
| `/dashboard/colegio/estadisticas` | página | permitir | permite | sí |
| `/dashboard/colegio/materias` | página | permitir | permite | sí |
| `/dashboard/colegio/onboarding` | página | permitir | permite | sí |
| `/dashboard/colegio/profesores` | página | permitir | permite | sí |
| `/dashboard/colegio/profesores/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/suscripcion` | página | permitir | permite | sí |
| `/dashboard/colegio/tablero` | página | permitir | permite | sí |
| `/dashboard/mis-reportes/[id]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre/circulo-confianza` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre/expedientes` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre/expedientes/[id]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre/identificador/[nick]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre/notificaciones` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre/perfil` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre/reportar` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/padre/suscripcion` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/dashboard/perfil` | página | permitir | permite | sí |
| `/dashboard/perfil/notificaciones` | página | permitir | permite | sí |
| `/docs` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/docs/operar` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/docs/tecnico` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/login` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/mis-reportes` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/offline` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/privacidad` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/recuperar` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/recuperar/[token]` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/registro` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/registro-colegio` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/registro/inicio` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/reportar` | página | redirigir→/dashboard/colegio | no permite | sí |
| `/seguimiento` | página | permitir | permite | sí |
| `/terminos` | página | redirigir→/dashboard/colegio | no permite | sí |

### COMITE_CONVIVENCIA

| Ruta | Tipo | Puerta (`proxy()`) | Predicado | Alineado |
| --- | --- | --- | --- | --- |
| `/` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `//` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/activar` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/api/` | api | HTTP 403 | no permite | sí |
| `/api/admin` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/anomalias` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/anomalias/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/dinero-vs-valor` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/dispersion` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/kpis` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/export` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/metricas` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]/historial` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]/modo` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/test-sql` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/top-decisiones` | api | HTTP 403 | no permite | sí |
| `/api/admin/analytics/colegios` | api | HTTP 403 | no permite | sí |
| `/api/admin/analytics/colegios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/bloquear` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/desbloquear` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simulacion-score` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/sugerencias` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/tablero` | api | HTTP 403 | no permite | sí |
| `/api/admin/audit-logs` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/cursos` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/reenviar-email` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/regenerar-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/asignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/aclaracion/[id]/responder` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/documento` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/tomar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion/[id]/aprobar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion/[id]/rechazar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/integrantes` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/integrantes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/mias` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/solicitudes` | api | HTTP 403 | no permite | sí |
| `/api/admin/correcciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/dataset-entrenamiento` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/clasificacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/denuncias-formales` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/dinero-vs-valor` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]/enviar-comite` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]/preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/modelos` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/ollama/probar` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/config` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/definiciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/preguntas` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/sandbox` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/analisis` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/cancelar` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/export` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/resultados` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/comparar` | api | HTTP 403 | no permite | sí |
| `/api/admin/matches` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/atascados` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/estado` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/historial` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/incidentes` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/logs` | api | HTTP 403 | no permite | sí |
| `/api/admin/motor/deriva` | api | HTTP 403 | no permite | sí |
| `/api/admin/motor/deriva/recalcular` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/bandeja` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/catalogos` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/parametros` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/parametros/[clave]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/salud` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/casos` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/metricas` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/reenviar-email` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/regenerar-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/asignacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/modelo` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/circulo-confianza` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/restablecer-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/vigencia` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/activar-manual` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos/[id]/desactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/cliente/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/cliente/[id]/extender` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/mora` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/parametros` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes/[id]/autorizar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes/[id]/rechazar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/planes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/planes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/reembolsos` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/reembolsos/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/sin-suscripcion` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/solicitudes-pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/tasas` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/vencimientos` | api | HTTP 403 | no permite | sí |
| `/api/admin/permisos-modulos` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]/confirmar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/anonimizar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/baja` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/denuncia-formal` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/escalar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/expediente` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/forense` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/forense/pdf` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/proceso` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/resolver-spam` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/revelar-original` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/transiciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/validar-anonimizacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/restart` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/start` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/stop` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/estado` | api | HTTP 403 | no permite | sí |
| `/api/admin/sesiones` | api | HTTP 403 | no permite | sí |
| `/api/admin/sesiones/[id]/cerrar` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/analitica` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/banco-sugerencias` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios/dashboard` | api | HTTP 403 | no permite | sí |
| `/api/alertas` | api | HTTP 403 | no permite | sí |
| `/api/alertas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/alertas/suscribir` | api | HTTP 403 | no permite | sí |
| `/api/apelaciones` | api | HTTP 403 | no permite | sí |
| `/api/apelaciones/mias` | api | HTTP 403 | no permite | sí |
| `/api/auth/activar` | api | HTTP 403 | no permite | sí |
| `/api/auth/cambiar-password` | api | permitir | permite | sí |
| `/api/auth/login` | api | HTTP 403 | no permite | sí |
| `/api/auth/logout` | api | permitir | permite | sí |
| `/api/auth/recuperar/restablecer` | api | HTTP 403 | no permite | sí |
| `/api/auth/recuperar/solicitar` | api | HTTP 403 | no permite | sí |
| `/api/auth/recuperar/validar` | api | HTTP 403 | no permite | sí |
| `/api/auth/register` | api | HTTP 403 | no permite | sí |
| `/api/auth/verificar/completar` | api | HTTP 403 | no permite | sí |
| `/api/auth/verificar/solicitar` | api | HTTP 403 | no permite | sí |
| `/api/auth/verificar/validar` | api | HTTP 403 | no permite | sí |
| `/api/circulo-confianza` | api | HTTP 403 | no permite | sí |
| `/api/circulo-confianza/[id]` | api | HTTP 403 | no permite | sí |
| `/api/circulo-confianza/agregado` | api | HTTP 403 | no permite | sí |
| `/api/circulo-confianza/preferencias` | api | HTTP 403 | no permite | sí |
| `/api/ciudades` | api | HTTP 403 | no permite | sí |
| `/api/ciudades/buscar` | api | HTTP 403 | no permite | sí |
| `/api/colegio` | api | HTTP 403 | no permite | sí |
| `/api/colegio/acudientes/[id]/identificadores` | api | HTTP 403 | no permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alertas` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alertas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alertas/[id]/asignar` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alertas/[id]/escalar` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alertas/[id]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alertas/[id]/notas` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alumnos/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alumnos/[id]/acudientes` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alumnos/[id]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alumnos/[id]/identificadores` | api | HTTP 403 | no permite | sí |
| `/api/colegio/alumnos/[id]/observacion` | api | HTTP 403 | no permite | sí |
| `/api/colegio/analisis/comparativa` | api | HTTP 403 | no permite | sí |
| `/api/colegio/analisis/comparativa/excel` | api | HTTP 403 | no permite | sí |
| `/api/colegio/auditoria` | api | HTTP 403 | no permite | sí |
| `/api/colegio/buscar` | api | HTTP 403 | no permite | sí |
| `/api/colegio/carga/confirmar` | api | HTTP 403 | no permite | sí |
| `/api/colegio/carga/plantilla` | api | HTTP 403 | no permite | sí |
| `/api/colegio/carga/validar` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cobertura` | api | HTTP 403 | no permite | sí |
| `/api/colegio/comite` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta/regenerar-password` | api | permitir | permite | sí |
| `/api/colegio/comite/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes` | api | HTTP 403 | no permite | sí |
| `/api/colegio/comite/integrantes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/comite/integrantes/[id]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/comite/solicitudes` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/resolver` | api | permitir | permite | sí |
| `/api/colegio/confianza/auditoria` | api | HTTP 403 | no permite | sí |
| `/api/colegio/confianza/documentos` | api | HTTP 403 | no permite | sí |
| `/api/colegio/confianza/protocolo/pdf` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/[id]/alumnos` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/[id]/duplicar` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/[id]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/[id]/materias` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/unificado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/unificado/plantilla` | api | HTTP 403 | no permite | sí |
| `/api/colegio/cursos/unificado/validar` | api | HTTP 403 | no permite | sí |
| `/api/colegio/estadisticas` | api | HTTP 403 | no permite | sí |
| `/api/colegio/estadisticas/pdf` | api | HTTP 403 | no permite | sí |
| `/api/colegio/identificadores-profesor/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/identificadores-profesor/[id]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/identificadores/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/identificadores/[id]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/materias` | api | HTTP 403 | no permite | sí |
| `/api/colegio/materias/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/materias/[id]/estado` | api | HTTP 403 | no permite | sí |
| `/api/colegio/notificaciones` | api | HTTP 403 | no permite | sí |
| `/api/colegio/notificaciones/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/notificaciones/marcar-leidas` | api | HTTP 403 | no permite | sí |
| `/api/colegio/notificaciones/resumen` | api | HTTP 403 | no permite | sí |
| `/api/colegio/onboarding` | api | HTTP 403 | no permite | sí |
| `/api/colegio/patrones` | api | HTTP 403 | no permite | sí |
| `/api/colegio/preferencias-avisos` | api | HTTP 403 | no permite | sí |
| `/api/colegio/profesores` | api | HTTP 403 | no permite | sí |
| `/api/colegio/profesores/[id]` | api | HTTP 403 | no permite | sí |
| `/api/colegio/profesores/[id]/identificadores` | api | HTTP 403 | no permite | sí |
| `/api/colegio/reportes/pdf` | api | HTTP 403 | no permite | sí |
| `/api/colegio/suscripcion/solicitar-plan` | api | HTTP 403 | no permite | sí |
| `/api/colegio/usuarios` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros/[clave]` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros/[clave]/revelar` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros/publicos` | api | HTTP 403 | no permite | sí |
| `/api/config/parametros/todos` | api | HTTP 403 | no permite | sí |
| `/api/consentimiento/aceptar` | api | permitir | permite | sí |
| `/api/consulta` | api | HTTP 403 | no permite | sí |
| `/api/consulta/detalle` | api | HTTP 403 | no permite | sí |
| `/api/consulta/evento` | api | HTTP 403 | no permite | sí |
| `/api/departamentos` | api | HTTP 403 | no permite | sí |
| `/api/docs/indice` | api | HTTP 403 | no permite | sí |
| `/api/estadisticas-publicas` | api | HTTP 403 | no permite | sí |
| `/api/health` | api | HTTP 403 | no permite | sí |
| `/api/health/worker` | api | HTTP 403 | no permite | sí |
| `/api/interno/expediente/[id]/transicionar` | api | HTTP 403 | no permite | sí |
| `/api/me` | api | permitir | permite | sí |
| `/api/me/colegio` | api | permitir | permite | sí |
| `/api/monitor/notif` | api | HTTP 403 | no permite | sí |
| `/api/notificaciones` | api | permitir | permite | sí |
| `/api/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/notificaciones/preferencias` | api | permitir | permite | sí |
| `/api/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/semaforo` | api | HTTP 403 | no permite | sí |
| `/api/padre/circulo-confianza/timeline` | api | HTTP 403 | no permite | sí |
| `/api/padre/contacto-emergencia` | api | HTTP 403 | no permite | sí |
| `/api/padre/contacto-emergencia/[id]` | api | HTTP 403 | no permite | sí |
| `/api/padre/expediente/[id]/cerrar-forzoso` | api | HTTP 403 | no permite | sí |
| `/api/padre/expediente/[id]/pedir-aclaracion` | api | HTTP 403 | no permite | sí |
| `/api/padre/expedientes/[id]/eventos` | api | HTTP 403 | no permite | sí |
| `/api/padre/suscripcion/activar-freemium` | api | HTTP 403 | no permite | sí |
| `/api/padre/suscripcion/solicitar-plan` | api | HTTP 403 | no permite | sí |
| `/api/pagos` | api | HTTP 403 | no permite | sí |
| `/api/pagos/aplicar-bono` | api | HTTP 403 | no permite | sí |
| `/api/pagos/aplicar-referido` | api | HTTP 403 | no permite | sí |
| `/api/pagos/planes` | api | HTTP 403 | no permite | sí |
| `/api/pagos/renovacion` | api | HTTP 403 | no permite | sí |
| `/api/pagos/suscripcion` | api | HTTP 403 | no permite | sí |
| `/api/pagos/suscripcion/cancelar` | api | HTTP 403 | no permite | sí |
| `/api/pagos/suscripcion/estado` | api | HTTP 403 | no permite | sí |
| `/api/pagos/suscripcion/validar-bono` | api | HTTP 403 | no permite | sí |
| `/api/paises` | api | HTTP 403 | no permite | sí |
| `/api/plataformas` | api | HTTP 403 | no permite | sí |
| `/api/publico/guia-accion/categoria/[cat]` | api | HTTP 403 | no permite | sí |
| `/api/publico/verificar-pdf/[hash]` | api | HTTP 403 | no permite | sí |
| `/api/reportes` | api | HTTP 403 | no permite | sí |
| `/api/reportes/fallback` | api | HTTP 403 | no permite | sí |
| `/api/reportes/mis-reportes` | api | HTTP 403 | no permite | sí |
| `/api/reportes/mis-reportes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/reportes/procesar` | api | HTTP 403 | no permite | sí |
| `/api/reportes/seguimiento` | api | HTTP 403 | no permite | sí |
| `/api/reportes/seguimiento/[numero]` | api | HTTP 403 | no permite | sí |
| `/api/session/ping` | api | HTTP 403 | no permite | sí |
| `/api/vigencia/refresh` | api | permitir | permite | sí |
| `/api/webhooks/resend` | api | HTTP 403 | no permite | sí |
| `/cambiar-password` | página | permitir | permite | sí |
| `/consentimiento` | página | permitir | permite | sí |
| `/consulta` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard-publico` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/analisis/recomendaciones` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/analisis/reglas` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/anti-abuso` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/colegios` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/colegios/[id]/estructura` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/colegios/nuevo` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/comite` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/comite/aclaracion/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/comite/apelaciones` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/comite/auditoria` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/comite/consolidacion/[expedienteId]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/comite/gestion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/comite/guias-pendientes` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/configuracion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/configuracion/guias-accion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/dataset-entrenamiento` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/estadisticas` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/estadisticas/clasificacion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/estadisticas/dinero-vs-valor` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/estadisticas/motor` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/estadisticas/operacion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/estadisticas/salud-motor` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/ia` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/identificador/[nick]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/monitoreo/worker` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/operadores` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/operadores/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/operadores/asignar` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/operadores/auditoria` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/operadores/gestion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/operadores/modelo` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/padres` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/padres/[id]/circulo` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/analitica` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/bonos` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/cliente/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/mora` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/pendientes` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/planes` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/reembolsos` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/sin-suscripcion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/pagos/vencimientos` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/spam` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/usuarios` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/usuarios/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/usuarios/admins` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/usuarios/comite-convivencia` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/usuarios/comite-validacion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/usuarios/operadores` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/admin/usuarios/rectores` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/apelaciones` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/circulo-confianza` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/alertas` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/alertas/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/alumnos/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/analisis/comparativa` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/auditoria` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/comite` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/casos` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/casos/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/estadisticas` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/integrantes` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/confianza` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/configuracion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/cursos` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/cursos/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/cursos/carga` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/cursos/nuevo` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/cursos/unificado` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/estadisticas` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/materias` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/onboarding` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/profesores` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/profesores/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/suscripcion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/colegio/tablero` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/mis-reportes/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre/circulo-confianza` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre/expedientes` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre/expedientes/[id]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre/identificador/[nick]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre/notificaciones` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre/perfil` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre/reportar` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/padre/suscripcion` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/dashboard/perfil` | página | permitir | permite | sí |
| `/dashboard/perfil/notificaciones` | página | permitir | permite | sí |
| `/docs` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/docs/operar` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/docs/tecnico` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/login` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/mis-reportes` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/offline` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/privacidad` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/recuperar` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/recuperar/[token]` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/registro` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/registro-colegio` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/registro/inicio` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/reportar` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/seguimiento` | página | redirigir→/dashboard/colegio/comite | no permite | sí |
| `/terminos` | página | redirigir→/dashboard/colegio/comite | no permite | sí |

### PARENT

| Ruta | Tipo | Puerta (`proxy()`) | Predicado | Alineado |
| --- | --- | --- | --- | --- |
| `/` | página | permitir | permite | sí |
| `//` | página | permitir | permite | sí |
| `/activar` | página | permitir | permite | sí |
| `/api/` | api | permitir | permite | sí |
| `/api/admin` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/anomalias` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/anomalias/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/dinero-vs-valor` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/dispersion` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/kpis` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/export` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/recomendaciones/metricas` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]/historial` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/[id]/modo` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/reglas/test-sql` | api | HTTP 403 | no permite | sí |
| `/api/admin/analisis/top-decisiones` | api | HTTP 403 | no permite | sí |
| `/api/admin/analytics/colegios` | api | HTTP 403 | no permite | sí |
| `/api/admin/analytics/colegios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/bloquear` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/desbloquear` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simulacion-score` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/simular/sugerencias` | api | HTTP 403 | no permite | sí |
| `/api/admin/anti-abuso/tablero` | api | HTTP 403 | no permite | sí |
| `/api/admin/audit-logs` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/cursos` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/reenviar-email` | api | HTTP 403 | no permite | sí |
| `/api/admin/colegios/[id]/regenerar-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/asignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/aclaracion/[id]/responder` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/documento` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/resolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/apelaciones/[id]/tomar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion/[id]/aprobar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/guias-accion/[id]/rechazar` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/integrantes` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/integrantes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/mias` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/comite/solicitudes` | api | HTTP 403 | no permite | sí |
| `/api/admin/correcciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/dataset-entrenamiento` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/clasificacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/denuncias-formales` | api | HTTP 403 | no permite | sí |
| `/api/admin/estadisticas/dinero-vs-valor` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]/enviar-comite` | api | HTTP 403 | no permite | sí |
| `/api/admin/guias-accion/[id]/preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/modelos` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/ollama/probar` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/config` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/definiciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/rubrica/preguntas` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/sandbox` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/analisis` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/cancelar` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/export` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/[id]/resultados` | api | HTTP 403 | no permite | sí |
| `/api/admin/ia/simulaciones/comparar` | api | HTTP 403 | no permite | sí |
| `/api/admin/matches` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/atascados` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/estado` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/historial` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/incidentes` | api | HTTP 403 | no permite | sí |
| `/api/admin/monitoreo/logs` | api | HTTP 403 | no permite | sí |
| `/api/admin/motor/deriva` | api | HTTP 403 | no permite | sí |
| `/api/admin/motor/deriva/recalcular` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/bandeja` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/catalogos` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/parametros` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/parametros/[clave]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | api | HTTP 403 | no permite | sí |
| `/api/admin/notificaciones/salud` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/casos` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/metricas` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/reenviar-email` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/[id]/regenerar-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/asignacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/modelo` | api | HTTP 403 | no permite | sí |
| `/api/admin/operadores/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/circulo-confianza` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/restablecer-password` | api | HTTP 403 | no permite | sí |
| `/api/admin/padres/[id]/vigencia` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/activar-manual` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/bonos/[id]/desactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/cliente/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/cliente/[id]/extender` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/mora` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/parametros` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes/[id]/autorizar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/pendientes/[id]/rechazar` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/planes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/planes/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/reembolsos` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/reembolsos/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/sin-suscripcion` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/solicitudes-pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/tasas` | api | HTTP 403 | no permite | sí |
| `/api/admin/pagos/vencimientos` | api | HTTP 403 | no permite | sí |
| `/api/admin/permisos-modulos` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]/confirmar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes-revision/[id]/reasignar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/anonimizar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/baja` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/denuncia-formal` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/escalar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/expediente` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/forense` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/forense/pdf` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/proceso` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/reactivar` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/resolver-spam` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/revelar-original` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/transiciones` | api | HTTP 403 | no permite | sí |
| `/api/admin/reportes/[id]/validar-anonimizacion` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/restart` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/start` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/[nombre]/stop` | api | HTTP 403 | no permite | sí |
| `/api/admin/servicios/estado` | api | HTTP 403 | no permite | sí |
| `/api/admin/sesiones` | api | HTTP 403 | no permite | sí |
| `/api/admin/sesiones/[id]/cerrar` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/analitica` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/banco-sugerencias` | api | HTTP 403 | no permite | sí |
| `/api/admin/spam/pendientes` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios/[id]` | api | HTTP 403 | no permite | sí |
| `/api/admin/usuarios/dashboard` | api | HTTP 403 | no permite | sí |
| `/api/alertas` | api | permitir | permite | sí |
| `/api/alertas/[id]` | api | permitir | permite | sí |
| `/api/alertas/suscribir` | api | permitir | permite | sí |
| `/api/apelaciones` | api | permitir | permite | sí |
| `/api/apelaciones/mias` | api | permitir | permite | sí |
| `/api/auth/activar` | api | permitir | permite | sí |
| `/api/auth/cambiar-password` | api | permitir | permite | sí |
| `/api/auth/login` | api | permitir | permite | sí |
| `/api/auth/logout` | api | permitir | permite | sí |
| `/api/auth/recuperar/restablecer` | api | permitir | permite | sí |
| `/api/auth/recuperar/solicitar` | api | permitir | permite | sí |
| `/api/auth/recuperar/validar` | api | permitir | permite | sí |
| `/api/auth/register` | api | permitir | permite | sí |
| `/api/auth/verificar/completar` | api | permitir | permite | sí |
| `/api/auth/verificar/solicitar` | api | permitir | permite | sí |
| `/api/auth/verificar/validar` | api | permitir | permite | sí |
| `/api/circulo-confianza` | api | permitir | permite | sí |
| `/api/circulo-confianza/[id]` | api | permitir | permite | sí |
| `/api/circulo-confianza/agregado` | api | permitir | permite | sí |
| `/api/circulo-confianza/preferencias` | api | permitir | permite | sí |
| `/api/ciudades` | api | permitir | permite | sí |
| `/api/ciudades/buscar` | api | permitir | permite | sí |
| `/api/colegio` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | api | permitir | permite | sí |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/asignar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/escalar` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alertas/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/alumnos/[id]/observacion` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa` | api | permitir | permite | sí |
| `/api/colegio/analisis/comparativa/excel` | api | permitir | permite | sí |
| `/api/colegio/auditoria` | api | permitir | permite | sí |
| `/api/colegio/buscar` | api | permitir | permite | sí |
| `/api/colegio/carga/confirmar` | api | permitir | permite | sí |
| `/api/colegio/carga/plantilla` | api | permitir | permite | sí |
| `/api/colegio/carga/validar` | api | permitir | permite | sí |
| `/api/colegio/cobertura` | api | permitir | permite | sí |
| `/api/colegio/comite` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta` | api | permitir | permite | sí |
| `/api/colegio/comite/cuenta/regenerar-password` | api | permitir | permite | sí |
| `/api/colegio/comite/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/integrantes/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/notas` | api | permitir | permite | sí |
| `/api/colegio/comite/solicitudes/[id]/resolver` | api | permitir | permite | sí |
| `/api/colegio/confianza/auditoria` | api | permitir | permite | sí |
| `/api/colegio/confianza/documentos` | api | permitir | permite | sí |
| `/api/colegio/confianza/protocolo/pdf` | api | permitir | permite | sí |
| `/api/colegio/cursos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/alumnos` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/duplicar` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias` | api | permitir | permite | sí |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/plantilla` | api | permitir | permite | sí |
| `/api/colegio/cursos/unificado/validar` | api | permitir | permite | sí |
| `/api/colegio/estadisticas` | api | permitir | permite | sí |
| `/api/colegio/estadisticas/pdf` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores-profesor/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]` | api | permitir | permite | sí |
| `/api/colegio/identificadores/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/materias` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]` | api | permitir | permite | sí |
| `/api/colegio/materias/[id]/estado` | api | permitir | permite | sí |
| `/api/colegio/notificaciones` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/marcar-leidas` | api | permitir | permite | sí |
| `/api/colegio/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/colegio/onboarding` | api | permitir | permite | sí |
| `/api/colegio/patrones` | api | permitir | permite | sí |
| `/api/colegio/preferencias-avisos` | api | permitir | permite | sí |
| `/api/colegio/profesores` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]` | api | permitir | permite | sí |
| `/api/colegio/profesores/[id]/identificadores` | api | permitir | permite | sí |
| `/api/colegio/reportes/pdf` | api | permitir | permite | sí |
| `/api/colegio/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/colegio/usuarios` | api | permitir | permite | sí |
| `/api/config/parametros` | api | permitir | permite | sí |
| `/api/config/parametros/[clave]` | api | permitir | permite | sí |
| `/api/config/parametros/[clave]/revelar` | api | permitir | permite | sí |
| `/api/config/parametros/publicos` | api | permitir | permite | sí |
| `/api/config/parametros/todos` | api | permitir | permite | sí |
| `/api/consentimiento/aceptar` | api | permitir | permite | sí |
| `/api/consulta` | api | permitir | permite | sí |
| `/api/consulta/detalle` | api | permitir | permite | sí |
| `/api/consulta/evento` | api | permitir | permite | sí |
| `/api/departamentos` | api | permitir | permite | sí |
| `/api/docs/indice` | api | permitir | permite | sí |
| `/api/estadisticas-publicas` | api | permitir | permite | sí |
| `/api/health` | api | permitir | permite | sí |
| `/api/health/worker` | api | permitir | permite | sí |
| `/api/interno/expediente/[id]/transicionar` | api | permitir | permite | sí |
| `/api/me` | api | permitir | permite | sí |
| `/api/me/colegio` | api | permitir | permite | sí |
| `/api/monitor/notif` | api | permitir | permite | sí |
| `/api/notificaciones` | api | permitir | permite | sí |
| `/api/notificaciones/[id]` | api | permitir | permite | sí |
| `/api/notificaciones/preferencias` | api | permitir | permite | sí |
| `/api/notificaciones/resumen` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/semaforo` | api | permitir | permite | sí |
| `/api/padre/circulo-confianza/timeline` | api | permitir | permite | sí |
| `/api/padre/contacto-emergencia` | api | permitir | permite | sí |
| `/api/padre/contacto-emergencia/[id]` | api | permitir | permite | sí |
| `/api/padre/expediente/[id]/cerrar-forzoso` | api | permitir | permite | sí |
| `/api/padre/expediente/[id]/pedir-aclaracion` | api | permitir | permite | sí |
| `/api/padre/expedientes/[id]/eventos` | api | permitir | permite | sí |
| `/api/padre/suscripcion/activar-freemium` | api | permitir | permite | sí |
| `/api/padre/suscripcion/solicitar-plan` | api | permitir | permite | sí |
| `/api/pagos` | api | permitir | permite | sí |
| `/api/pagos/aplicar-bono` | api | permitir | permite | sí |
| `/api/pagos/aplicar-referido` | api | permitir | permite | sí |
| `/api/pagos/planes` | api | permitir | permite | sí |
| `/api/pagos/renovacion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/cancelar` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/estado` | api | permitir | permite | sí |
| `/api/pagos/suscripcion/validar-bono` | api | permitir | permite | sí |
| `/api/paises` | api | permitir | permite | sí |
| `/api/plataformas` | api | permitir | permite | sí |
| `/api/publico/guia-accion/categoria/[cat]` | api | permitir | permite | sí |
| `/api/publico/verificar-pdf/[hash]` | api | permitir | permite | sí |
| `/api/reportes` | api | permitir | permite | sí |
| `/api/reportes/fallback` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes/[id]` | api | permitir | permite | sí |
| `/api/reportes/procesar` | api | permitir | permite | sí |
| `/api/reportes/seguimiento` | api | permitir | permite | sí |
| `/api/reportes/seguimiento/[numero]` | api | permitir | permite | sí |
| `/api/session/ping` | api | permitir | permite | sí |
| `/api/vigencia/refresh` | api | permitir | permite | sí |
| `/api/webhooks/resend` | api | permitir | permite | sí |
| `/cambiar-password` | página | permitir | permite | sí |
| `/consentimiento` | página | permitir | permite | sí |
| `/consulta` | página | permitir | permite | sí |
| `/dashboard` | página | permitir | permite | sí |
| `/dashboard-publico` | página | permitir | permite | sí |
| `/dashboard/admin` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/analisis/recomendaciones` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/analisis/reglas` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/anti-abuso` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/colegios` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/colegios/[id]/estructura` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/colegios/nuevo` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/comite` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/comite/aclaracion/[id]` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/comite/apelaciones` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/comite/auditoria` | página | redirigir→/dashboard | no permite | sí |
| `/dashboard/admin/comite/consolidacion/[expedienteId]` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/comite/gestion` | página | redirigir→/dashboard | no permite | sí |
| `/dashboard/admin/comite/guias-pendientes` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/configuracion` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/configuracion/guias-accion` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/dataset-entrenamiento` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/estadisticas` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/estadisticas/clasificacion` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/estadisticas/dinero-vs-valor` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/estadisticas/motor` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/estadisticas/operacion` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/estadisticas/salud-motor` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/ia` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/identificador/[nick]` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/monitoreo/worker` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/operadores` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/operadores/[id]` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/operadores/asignar` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/operadores/auditoria` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/operadores/gestion` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/operadores/modelo` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/padres` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/padres/[id]/circulo` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/analitica` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/bonos` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/cliente/[id]` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/mora` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/pendientes` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/planes` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/reembolsos` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/sin-suscripcion` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/pagos/vencimientos` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/spam` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/usuarios` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/usuarios/[id]` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/usuarios/admins` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/usuarios/comite-convivencia` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/usuarios/comite-validacion` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/usuarios/operadores` | página | redirigir→/ | no permite | sí |
| `/dashboard/admin/usuarios/rectores` | página | redirigir→/ | no permite | sí |
| `/dashboard/apelaciones` | página | permitir | permite | sí |
| `/dashboard/circulo-confianza` | página | permitir | permite | sí |
| `/dashboard/colegio` | página | permitir | permite | sí |
| `/dashboard/colegio/alertas` | página | permitir | permite | sí |
| `/dashboard/colegio/alertas/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/alumnos/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/analisis/comparativa` | página | permitir | permite | sí |
| `/dashboard/colegio/auditoria` | página | permitir | permite | sí |
| `/dashboard/colegio/comite` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/casos` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/casos/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/estadisticas` | página | permitir | permite | sí |
| `/dashboard/colegio/comite/integrantes` | página | permitir | permite | sí |
| `/dashboard/colegio/confianza` | página | permitir | permite | sí |
| `/dashboard/colegio/configuracion` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos/carga` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos/nuevo` | página | permitir | permite | sí |
| `/dashboard/colegio/cursos/unificado` | página | permitir | permite | sí |
| `/dashboard/colegio/estadisticas` | página | permitir | permite | sí |
| `/dashboard/colegio/materias` | página | permitir | permite | sí |
| `/dashboard/colegio/onboarding` | página | permitir | permite | sí |
| `/dashboard/colegio/profesores` | página | permitir | permite | sí |
| `/dashboard/colegio/profesores/[id]` | página | permitir | permite | sí |
| `/dashboard/colegio/suscripcion` | página | permitir | permite | sí |
| `/dashboard/colegio/tablero` | página | permitir | permite | sí |
| `/dashboard/mis-reportes/[id]` | página | permitir | permite | sí |
| `/dashboard/padre` | página | permitir | permite | sí |
| `/dashboard/padre/circulo-confianza` | página | permitir | permite | sí |
| `/dashboard/padre/expedientes` | página | permitir | permite | sí |
| `/dashboard/padre/expedientes/[id]` | página | permitir | permite | sí |
| `/dashboard/padre/identificador/[nick]` | página | permitir | permite | sí |
| `/dashboard/padre/notificaciones` | página | permitir | permite | sí |
| `/dashboard/padre/perfil` | página | permitir | permite | sí |
| `/dashboard/padre/reportar` | página | permitir | permite | sí |
| `/dashboard/padre/suscripcion` | página | permitir | permite | sí |
| `/dashboard/perfil` | página | permitir | permite | sí |
| `/dashboard/perfil/notificaciones` | página | permitir | permite | sí |
| `/docs` | página | permitir | permite | sí |
| `/docs/operar` | página | permitir | permite | sí |
| `/docs/tecnico` | página | permitir | permite | sí |
| `/login` | página | permitir | permite | sí |
| `/mis-reportes` | página | permitir | permite | sí |
| `/offline` | página | permitir | permite | sí |
| `/privacidad` | página | permitir | permite | sí |
| `/recuperar` | página | permitir | permite | sí |
| `/recuperar/[token]` | página | permitir | permite | sí |
| `/registro` | página | permitir | permite | sí |
| `/registro-colegio` | página | permitir | permite | sí |
| `/registro/inicio` | página | permitir | permite | sí |
| `/reportar` | página | permitir | permite | sí |
| `/seguimiento` | página | permitir | permite | sí |
| `/terminos` | página | permitir | permite | sí |

### ANONIMO

| Ruta | Tipo | Puerta (`proxy()`) | Predicado | Alineado |
| --- | --- | --- | --- | --- |
| `/` | página | permitir | permite | sí |
| `//` | página | permitir | permite | sí |
| `/activar` | página | permitir | permite | sí |
| `/api/` | api | HTTP 401 | permite | **NO** |
| `/api/admin` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/anomalias` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/anomalias/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/dinero-vs-valor` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/dispersion` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/kpis` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/recomendaciones` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/recomendaciones/export` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/recomendaciones/metricas` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/reglas` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/reglas/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/reglas/[id]/historial` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/reglas/[id]/modo` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/reglas/test-sql` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analisis/top-decisiones` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analytics/colegios` | api | HTTP 401 | permite | **NO** |
| `/api/admin/analytics/colegios/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/anti-abuso/bloquear` | api | HTTP 401 | permite | **NO** |
| `/api/admin/anti-abuso/desbloquear` | api | HTTP 401 | permite | **NO** |
| `/api/admin/anti-abuso/simulacion-score` | api | HTTP 401 | permite | **NO** |
| `/api/admin/anti-abuso/simular` | api | HTTP 401 | permite | **NO** |
| `/api/admin/anti-abuso/simular/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/anti-abuso/simular/sugerencias` | api | HTTP 401 | permite | **NO** |
| `/api/admin/anti-abuso/tablero` | api | HTTP 401 | permite | **NO** |
| `/api/admin/audit-logs` | api | HTTP 401 | permite | **NO** |
| `/api/admin/colegios` | api | HTTP 401 | permite | **NO** |
| `/api/admin/colegios/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/colegios/[id]/cursos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/colegios/[id]/reenviar-email` | api | HTTP 401 | permite | **NO** |
| `/api/admin/colegios/[id]/regenerar-password` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/[id]/asignar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/[id]/reasignar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/[id]/resolver` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/aclaracion/[id]/responder` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/apelaciones` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/apelaciones/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/apelaciones/[id]/documento` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/apelaciones/[id]/resolver` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/apelaciones/[id]/tomar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/consolidacion` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/consolidacion/[expedienteId]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/guias-accion` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/guias-accion/[id]/aprobar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/guias-accion/[id]/rechazar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/integrantes` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/integrantes/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/mias` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/pendientes` | api | HTTP 401 | permite | **NO** |
| `/api/admin/comite/solicitudes` | api | HTTP 401 | permite | **NO** |
| `/api/admin/correcciones` | api | HTTP 401 | permite | **NO** |
| `/api/admin/dataset-entrenamiento` | api | HTTP 401 | permite | **NO** |
| `/api/admin/estadisticas` | api | HTTP 401 | permite | **NO** |
| `/api/admin/estadisticas/clasificacion` | api | HTTP 401 | permite | **NO** |
| `/api/admin/estadisticas/denuncias-formales` | api | HTTP 401 | permite | **NO** |
| `/api/admin/estadisticas/dinero-vs-valor` | api | HTTP 401 | permite | **NO** |
| `/api/admin/guias-accion` | api | HTTP 401 | permite | **NO** |
| `/api/admin/guias-accion/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/guias-accion/[id]/enviar-comite` | api | HTTP 401 | permite | **NO** |
| `/api/admin/guias-accion/[id]/preview` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/modelos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/ollama/probar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/rubrica` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/rubrica/config` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/rubrica/definiciones` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/rubrica/preguntas` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/sandbox` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/simulaciones` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/simulaciones/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/simulaciones/[id]/analisis` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/simulaciones/[id]/cancelar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/simulaciones/[id]/export` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/simulaciones/[id]/resultados` | api | HTTP 401 | permite | **NO** |
| `/api/admin/ia/simulaciones/comparar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/matches` | api | HTTP 401 | permite | **NO** |
| `/api/admin/monitoreo/atascados` | api | HTTP 401 | permite | **NO** |
| `/api/admin/monitoreo/estado` | api | HTTP 401 | permite | **NO** |
| `/api/admin/monitoreo/historial` | api | HTTP 401 | permite | **NO** |
| `/api/admin/monitoreo/incidentes` | api | HTTP 401 | permite | **NO** |
| `/api/admin/monitoreo/logs` | api | HTTP 401 | permite | **NO** |
| `/api/admin/motor/deriva` | api | HTTP 401 | permite | **NO** |
| `/api/admin/motor/deriva/recalcular` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/bandeja` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/catalogos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/parametros` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/parametros/[clave]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/plantillas` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/plantillas/[clave]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/reglas` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/reglas/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | api | HTTP 401 | permite | **NO** |
| `/api/admin/notificaciones/salud` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/[id]/casos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/[id]/metricas` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/[id]/reactivar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/[id]/reenviar-email` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/[id]/regenerar-password` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/asignacion` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/modelo` | api | HTTP 401 | permite | **NO** |
| `/api/admin/operadores/reasignar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/padres` | api | HTTP 401 | permite | **NO** |
| `/api/admin/padres/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/padres/[id]/circulo-confianza` | api | HTTP 401 | permite | **NO** |
| `/api/admin/padres/[id]/reactivar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/padres/[id]/restablecer-password` | api | HTTP 401 | permite | **NO** |
| `/api/admin/padres/[id]/vigencia` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/activar-manual` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/bonos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/bonos/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/bonos/[id]/desactivar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/cliente/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/cliente/[id]/extender` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/mora` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/parametros` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/pendientes` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/pendientes/[id]/autorizar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/pendientes/[id]/rechazar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/planes` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/planes/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/reembolsos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/reembolsos/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/sin-suscripcion` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/solicitudes-pendientes` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/tasas` | api | HTTP 401 | permite | **NO** |
| `/api/admin/pagos/vencimientos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/permisos-modulos` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes-revision` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes-revision/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes-revision/[id]/confirmar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes-revision/[id]/reasignar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/anonimizar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/baja` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/denuncia-formal` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/escalar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/expediente` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/forense` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/forense/pdf` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/proceso` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/reactivar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/resolver-spam` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/revelar-original` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/transiciones` | api | HTTP 401 | permite | **NO** |
| `/api/admin/reportes/[id]/validar-anonimizacion` | api | HTTP 401 | permite | **NO** |
| `/api/admin/servicios/[nombre]/restart` | api | HTTP 401 | permite | **NO** |
| `/api/admin/servicios/[nombre]/start` | api | HTTP 401 | permite | **NO** |
| `/api/admin/servicios/[nombre]/stop` | api | HTTP 401 | permite | **NO** |
| `/api/admin/servicios/estado` | api | HTTP 401 | permite | **NO** |
| `/api/admin/sesiones` | api | HTTP 401 | permite | **NO** |
| `/api/admin/sesiones/[id]/cerrar` | api | HTTP 401 | permite | **NO** |
| `/api/admin/spam/analitica` | api | HTTP 401 | permite | **NO** |
| `/api/admin/spam/banco-sugerencias` | api | HTTP 401 | permite | **NO** |
| `/api/admin/spam/pendientes` | api | HTTP 401 | permite | **NO** |
| `/api/admin/usuarios` | api | HTTP 401 | permite | **NO** |
| `/api/admin/usuarios/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/admin/usuarios/dashboard` | api | HTTP 401 | permite | **NO** |
| `/api/alertas` | api | HTTP 401 | permite | **NO** |
| `/api/alertas/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/alertas/suscribir` | api | HTTP 401 | permite | **NO** |
| `/api/apelaciones` | api | HTTP 401 | permite | **NO** |
| `/api/apelaciones/mias` | api | HTTP 401 | permite | **NO** |
| `/api/auth/activar` | api | permitir | permite | sí |
| `/api/auth/cambiar-password` | api | permitir | permite | sí |
| `/api/auth/login` | api | permitir | permite | sí |
| `/api/auth/logout` | api | permitir | permite | sí |
| `/api/auth/recuperar/restablecer` | api | permitir | permite | sí |
| `/api/auth/recuperar/solicitar` | api | permitir | permite | sí |
| `/api/auth/recuperar/validar` | api | permitir | permite | sí |
| `/api/auth/register` | api | permitir | permite | sí |
| `/api/auth/verificar/completar` | api | permitir | permite | sí |
| `/api/auth/verificar/solicitar` | api | permitir | permite | sí |
| `/api/auth/verificar/validar` | api | permitir | permite | sí |
| `/api/circulo-confianza` | api | HTTP 401 | permite | **NO** |
| `/api/circulo-confianza/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/circulo-confianza/agregado` | api | HTTP 401 | permite | **NO** |
| `/api/circulo-confianza/preferencias` | api | HTTP 401 | permite | **NO** |
| `/api/ciudades` | api | permitir | permite | sí |
| `/api/ciudades/buscar` | api | permitir | permite | sí |
| `/api/colegio` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/acudientes/[id]/identificadores` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alertas` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alertas/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alertas/[id]/asignar` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alertas/[id]/escalar` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alertas/[id]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alertas/[id]/notas` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alumnos/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alumnos/[id]/acudientes` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alumnos/[id]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alumnos/[id]/identificadores` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/alumnos/[id]/observacion` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/analisis/comparativa` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/analisis/comparativa/excel` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/auditoria` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/buscar` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/carga/confirmar` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/carga/plantilla` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/carga/validar` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cobertura` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/cuenta` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/cuenta/regenerar-password` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/estadisticas` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/integrantes` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/integrantes/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/integrantes/[id]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/solicitudes` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/solicitudes/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/solicitudes/[id]/notas` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/comite/solicitudes/[id]/resolver` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/confianza/auditoria` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/confianza/documentos` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/confianza/protocolo/pdf` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/[id]/alumnos` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/[id]/duplicar` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/[id]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/[id]/materias` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/unificado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/unificado/plantilla` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/cursos/unificado/validar` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/estadisticas` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/estadisticas/pdf` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/identificadores-profesor/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/identificadores-profesor/[id]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/identificadores/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/identificadores/[id]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/materias` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/materias/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/materias/[id]/estado` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/notificaciones` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/notificaciones/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/notificaciones/marcar-leidas` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/notificaciones/resumen` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/onboarding` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/patrones` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/preferencias-avisos` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/profesores` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/profesores/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/profesores/[id]/identificadores` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/reportes/pdf` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/suscripcion/solicitar-plan` | api | HTTP 401 | permite | **NO** |
| `/api/colegio/usuarios` | api | HTTP 401 | permite | **NO** |
| `/api/config/parametros` | api | HTTP 401 | permite | **NO** |
| `/api/config/parametros/[clave]` | api | HTTP 401 | permite | **NO** |
| `/api/config/parametros/[clave]/revelar` | api | HTTP 401 | permite | **NO** |
| `/api/config/parametros/publicos` | api | permitir | permite | sí |
| `/api/config/parametros/todos` | api | HTTP 401 | permite | **NO** |
| `/api/consentimiento/aceptar` | api | HTTP 401 | permite | **NO** |
| `/api/consulta` | api | permitir | permite | sí |
| `/api/consulta/detalle` | api | permitir | permite | sí |
| `/api/consulta/evento` | api | permitir | permite | sí |
| `/api/departamentos` | api | permitir | permite | sí |
| `/api/docs/indice` | api | permitir | permite | sí |
| `/api/estadisticas-publicas` | api | permitir | permite | sí |
| `/api/health` | api | permitir | permite | sí |
| `/api/health/worker` | api | permitir | permite | sí |
| `/api/interno/expediente/[id]/transicionar` | api | HTTP 401 | permite | **NO** |
| `/api/me` | api | HTTP 401 | permite | **NO** |
| `/api/me/colegio` | api | HTTP 401 | permite | **NO** |
| `/api/monitor/notif` | api | permitir | permite | sí |
| `/api/notificaciones` | api | HTTP 401 | permite | **NO** |
| `/api/notificaciones/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/notificaciones/preferencias` | api | HTTP 401 | permite | **NO** |
| `/api/notificaciones/resumen` | api | HTTP 401 | permite | **NO** |
| `/api/padre/circulo-confianza/semaforo` | api | HTTP 401 | permite | **NO** |
| `/api/padre/circulo-confianza/timeline` | api | HTTP 401 | permite | **NO** |
| `/api/padre/contacto-emergencia` | api | HTTP 401 | permite | **NO** |
| `/api/padre/contacto-emergencia/[id]` | api | HTTP 401 | permite | **NO** |
| `/api/padre/expediente/[id]/cerrar-forzoso` | api | HTTP 401 | permite | **NO** |
| `/api/padre/expediente/[id]/pedir-aclaracion` | api | HTTP 401 | permite | **NO** |
| `/api/padre/expedientes/[id]/eventos` | api | HTTP 401 | permite | **NO** |
| `/api/padre/suscripcion/activar-freemium` | api | HTTP 401 | permite | **NO** |
| `/api/padre/suscripcion/solicitar-plan` | api | HTTP 401 | permite | **NO** |
| `/api/pagos` | api | HTTP 401 | permite | **NO** |
| `/api/pagos/aplicar-bono` | api | HTTP 401 | permite | **NO** |
| `/api/pagos/aplicar-referido` | api | HTTP 401 | permite | **NO** |
| `/api/pagos/planes` | api | HTTP 401 | permite | **NO** |
| `/api/pagos/renovacion` | api | HTTP 401 | permite | **NO** |
| `/api/pagos/suscripcion` | api | HTTP 401 | permite | **NO** |
| `/api/pagos/suscripcion/cancelar` | api | HTTP 401 | permite | **NO** |
| `/api/pagos/suscripcion/estado` | api | HTTP 401 | permite | **NO** |
| `/api/pagos/suscripcion/validar-bono` | api | HTTP 401 | permite | **NO** |
| `/api/paises` | api | permitir | permite | sí |
| `/api/plataformas` | api | permitir | permite | sí |
| `/api/publico/guia-accion/categoria/[cat]` | api | HTTP 401 | permite | **NO** |
| `/api/publico/verificar-pdf/[hash]` | api | HTTP 401 | permite | **NO** |
| `/api/reportes` | api | permitir | permite | sí |
| `/api/reportes/fallback` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes` | api | permitir | permite | sí |
| `/api/reportes/mis-reportes/[id]` | api | permitir | permite | sí |
| `/api/reportes/procesar` | api | permitir | permite | sí |
| `/api/reportes/seguimiento` | api | permitir | permite | sí |
| `/api/reportes/seguimiento/[numero]` | api | permitir | permite | sí |
| `/api/session/ping` | api | HTTP 401 | permite | **NO** |
| `/api/vigencia/refresh` | api | HTTP 401 | permite | **NO** |
| `/api/webhooks/resend` | api | HTTP 401 | permite | **NO** |
| `/cambiar-password` | página | redirigir→/login | permite | **NO** |
| `/consentimiento` | página | redirigir→/login | permite | **NO** |
| `/consulta` | página | redirigir→/login | permite | **NO** |
| `/dashboard` | página | redirigir→/login | permite | **NO** |
| `/dashboard-publico` | página | permitir | permite | sí |
| `/dashboard/admin` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/analisis/recomendaciones` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/analisis/reglas` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/anti-abuso` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/colegios` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/colegios/[id]/estructura` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/colegios/nuevo` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/comite` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/comite/aclaracion/[id]` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/comite/apelaciones` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/comite/auditoria` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/comite/consolidacion/[expedienteId]` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/comite/gestion` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/comite/guias-pendientes` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/configuracion` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/configuracion/guias-accion` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/dataset-entrenamiento` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/estadisticas` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/estadisticas/clasificacion` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/estadisticas/dinero-vs-valor` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/estadisticas/motor` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/estadisticas/operacion` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/estadisticas/salud-motor` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/ia` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/identificador/[nick]` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/monitoreo/worker` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/operadores` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/operadores/[id]` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/operadores/asignar` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/operadores/auditoria` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/operadores/gestion` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/operadores/modelo` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/padres` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/padres/[id]/circulo` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/analitica` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/bonos` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/cliente/[id]` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/mora` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/pendientes` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/planes` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/reembolsos` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/sin-suscripcion` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/pagos/vencimientos` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/spam` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/usuarios` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/usuarios/[id]` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/usuarios/admins` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/usuarios/comite-convivencia` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/usuarios/comite-validacion` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/usuarios/operadores` | página | redirigir→/login | no permite | sí |
| `/dashboard/admin/usuarios/rectores` | página | redirigir→/login | no permite | sí |
| `/dashboard/apelaciones` | página | redirigir→/login | permite | **NO** |
| `/dashboard/circulo-confianza` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/alertas` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/alertas/[id]` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/alumnos/[id]` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/analisis/comparativa` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/auditoria` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/comite` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/comite/casos` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/comite/casos/[id]` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/comite/estadisticas` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/comite/integrantes` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/confianza` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/configuracion` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/cursos` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/cursos/[id]` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/cursos/carga` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/cursos/nuevo` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/cursos/unificado` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/estadisticas` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/materias` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/onboarding` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/profesores` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/profesores/[id]` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/suscripcion` | página | redirigir→/login | permite | **NO** |
| `/dashboard/colegio/tablero` | página | redirigir→/login | permite | **NO** |
| `/dashboard/mis-reportes/[id]` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre/circulo-confianza` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre/expedientes` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre/expedientes/[id]` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre/identificador/[nick]` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre/notificaciones` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre/perfil` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre/reportar` | página | redirigir→/login | permite | **NO** |
| `/dashboard/padre/suscripcion` | página | redirigir→/login | permite | **NO** |
| `/dashboard/perfil` | página | redirigir→/login | permite | **NO** |
| `/dashboard/perfil/notificaciones` | página | redirigir→/login | permite | **NO** |
| `/docs` | página | permitir | permite | sí |
| `/docs/operar` | página | permitir | permite | sí |
| `/docs/tecnico` | página | permitir | permite | sí |
| `/login` | página | permitir | permite | sí |
| `/mis-reportes` | página | redirigir→/login | permite | **NO** |
| `/offline` | página | permitir | permite | sí |
| `/privacidad` | página | permitir | permite | sí |
| `/recuperar` | página | permitir | permite | sí |
| `/recuperar/[token]` | página | permitir | permite | sí |
| `/registro` | página | permitir | permite | sí |
| `/registro-colegio` | página | permitir | permite | sí |
| `/registro/inicio` | página | permitir | permite | sí |
| `/reportar` | página | permitir | permite | sí |
| `/seguimiento` | página | permitir | permite | sí |
| `/terminos` | página | permitir | permite | sí |

## Nota: divergencias del eje anónimo (NO son rojo)

Sin sesión, la puerta exige login donde el predicado solo describe qué pintaría el
menú (condición ZEUS 1: el rojo es SOLO desalineo real con sesión canónica).

| Ruta | Puerta (anónimo) | Predicado (anónimo) |
| --- | --- | --- |
| `/api/` | HTTP 401 | permite |
| `/api/admin` | HTTP 401 | permite |
| `/api/admin/analisis/anomalias` | HTTP 401 | permite |
| `/api/admin/analisis/anomalias/[id]` | HTTP 401 | permite |
| `/api/admin/analisis/dinero-vs-valor` | HTTP 401 | permite |
| `/api/admin/analisis/dispersion` | HTTP 401 | permite |
| `/api/admin/analisis/kpis` | HTTP 401 | permite |
| `/api/admin/analisis/recomendaciones` | HTTP 401 | permite |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | HTTP 401 | permite |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | HTTP 401 | permite |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | HTTP 401 | permite |
| `/api/admin/analisis/recomendaciones/export` | HTTP 401 | permite |
| `/api/admin/analisis/recomendaciones/metricas` | HTTP 401 | permite |
| `/api/admin/analisis/reglas` | HTTP 401 | permite |
| `/api/admin/analisis/reglas/[id]` | HTTP 401 | permite |
| `/api/admin/analisis/reglas/[id]/historial` | HTTP 401 | permite |
| `/api/admin/analisis/reglas/[id]/modo` | HTTP 401 | permite |
| `/api/admin/analisis/reglas/test-sql` | HTTP 401 | permite |
| `/api/admin/analisis/top-decisiones` | HTTP 401 | permite |
| `/api/admin/analytics/colegios` | HTTP 401 | permite |
| `/api/admin/analytics/colegios/[id]` | HTTP 401 | permite |
| `/api/admin/anti-abuso/bloquear` | HTTP 401 | permite |
| `/api/admin/anti-abuso/desbloquear` | HTTP 401 | permite |
| `/api/admin/anti-abuso/simulacion-score` | HTTP 401 | permite |
| `/api/admin/anti-abuso/simular` | HTTP 401 | permite |
| `/api/admin/anti-abuso/simular/[id]` | HTTP 401 | permite |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | HTTP 401 | permite |
| `/api/admin/anti-abuso/simular/sugerencias` | HTTP 401 | permite |
| `/api/admin/anti-abuso/tablero` | HTTP 401 | permite |
| `/api/admin/audit-logs` | HTTP 401 | permite |
| `/api/admin/colegios` | HTTP 401 | permite |
| `/api/admin/colegios/[id]` | HTTP 401 | permite |
| `/api/admin/colegios/[id]/cursos` | HTTP 401 | permite |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | HTTP 401 | permite |
| `/api/admin/colegios/[id]/reenviar-email` | HTTP 401 | permite |
| `/api/admin/colegios/[id]/regenerar-password` | HTTP 401 | permite |
| `/api/admin/comite/[id]/asignar` | HTTP 401 | permite |
| `/api/admin/comite/[id]/reasignar` | HTTP 401 | permite |
| `/api/admin/comite/[id]/resolver` | HTTP 401 | permite |
| `/api/admin/comite/aclaracion/[id]/responder` | HTTP 401 | permite |
| `/api/admin/comite/apelaciones` | HTTP 401 | permite |
| `/api/admin/comite/apelaciones/[id]` | HTTP 401 | permite |
| `/api/admin/comite/apelaciones/[id]/documento` | HTTP 401 | permite |
| `/api/admin/comite/apelaciones/[id]/resolver` | HTTP 401 | permite |
| `/api/admin/comite/apelaciones/[id]/tomar` | HTTP 401 | permite |
| `/api/admin/comite/consolidacion` | HTTP 401 | permite |
| `/api/admin/comite/consolidacion/[expedienteId]` | HTTP 401 | permite |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | HTTP 401 | permite |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | HTTP 401 | permite |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | HTTP 401 | permite |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | HTTP 401 | permite |
| `/api/admin/comite/guias-accion` | HTTP 401 | permite |
| `/api/admin/comite/guias-accion/[id]/aprobar` | HTTP 401 | permite |
| `/api/admin/comite/guias-accion/[id]/rechazar` | HTTP 401 | permite |
| `/api/admin/comite/integrantes` | HTTP 401 | permite |
| `/api/admin/comite/integrantes/[id]` | HTTP 401 | permite |
| `/api/admin/comite/mias` | HTTP 401 | permite |
| `/api/admin/comite/pendientes` | HTTP 401 | permite |
| `/api/admin/comite/solicitudes` | HTTP 401 | permite |
| `/api/admin/correcciones` | HTTP 401 | permite |
| `/api/admin/dataset-entrenamiento` | HTTP 401 | permite |
| `/api/admin/estadisticas` | HTTP 401 | permite |
| `/api/admin/estadisticas/clasificacion` | HTTP 401 | permite |
| `/api/admin/estadisticas/denuncias-formales` | HTTP 401 | permite |
| `/api/admin/estadisticas/dinero-vs-valor` | HTTP 401 | permite |
| `/api/admin/guias-accion` | HTTP 401 | permite |
| `/api/admin/guias-accion/[id]` | HTTP 401 | permite |
| `/api/admin/guias-accion/[id]/enviar-comite` | HTTP 401 | permite |
| `/api/admin/guias-accion/[id]/preview` | HTTP 401 | permite |
| `/api/admin/ia/modelos` | HTTP 401 | permite |
| `/api/admin/ia/ollama/probar` | HTTP 401 | permite |
| `/api/admin/ia/rubrica` | HTTP 401 | permite |
| `/api/admin/ia/rubrica/config` | HTTP 401 | permite |
| `/api/admin/ia/rubrica/definiciones` | HTTP 401 | permite |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | HTTP 401 | permite |
| `/api/admin/ia/rubrica/preguntas` | HTTP 401 | permite |
| `/api/admin/ia/sandbox` | HTTP 401 | permite |
| `/api/admin/ia/simulaciones` | HTTP 401 | permite |
| `/api/admin/ia/simulaciones/[id]` | HTTP 401 | permite |
| `/api/admin/ia/simulaciones/[id]/analisis` | HTTP 401 | permite |
| `/api/admin/ia/simulaciones/[id]/cancelar` | HTTP 401 | permite |
| `/api/admin/ia/simulaciones/[id]/export` | HTTP 401 | permite |
| `/api/admin/ia/simulaciones/[id]/resultados` | HTTP 401 | permite |
| `/api/admin/ia/simulaciones/comparar` | HTTP 401 | permite |
| `/api/admin/matches` | HTTP 401 | permite |
| `/api/admin/monitoreo/atascados` | HTTP 401 | permite |
| `/api/admin/monitoreo/estado` | HTTP 401 | permite |
| `/api/admin/monitoreo/historial` | HTTP 401 | permite |
| `/api/admin/monitoreo/incidentes` | HTTP 401 | permite |
| `/api/admin/monitoreo/logs` | HTTP 401 | permite |
| `/api/admin/motor/deriva` | HTTP 401 | permite |
| `/api/admin/motor/deriva/recalcular` | HTTP 401 | permite |
| `/api/admin/notificaciones/bandeja` | HTTP 401 | permite |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | HTTP 401 | permite |
| `/api/admin/notificaciones/catalogos` | HTTP 401 | permite |
| `/api/admin/notificaciones/parametros` | HTTP 401 | permite |
| `/api/admin/notificaciones/parametros/[clave]` | HTTP 401 | permite |
| `/api/admin/notificaciones/plantillas` | HTTP 401 | permite |
| `/api/admin/notificaciones/plantillas/[clave]` | HTTP 401 | permite |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | HTTP 401 | permite |
| `/api/admin/notificaciones/reglas` | HTTP 401 | permite |
| `/api/admin/notificaciones/reglas/[id]` | HTTP 401 | permite |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | HTTP 401 | permite |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | HTTP 401 | permite |
| `/api/admin/notificaciones/salud` | HTTP 401 | permite |
| `/api/admin/operadores` | HTTP 401 | permite |
| `/api/admin/operadores/[id]` | HTTP 401 | permite |
| `/api/admin/operadores/[id]/casos` | HTTP 401 | permite |
| `/api/admin/operadores/[id]/metricas` | HTTP 401 | permite |
| `/api/admin/operadores/[id]/reactivar` | HTTP 401 | permite |
| `/api/admin/operadores/[id]/reenviar-email` | HTTP 401 | permite |
| `/api/admin/operadores/[id]/regenerar-password` | HTTP 401 | permite |
| `/api/admin/operadores/asignacion` | HTTP 401 | permite |
| `/api/admin/operadores/modelo` | HTTP 401 | permite |
| `/api/admin/operadores/reasignar` | HTTP 401 | permite |
| `/api/admin/padres` | HTTP 401 | permite |
| `/api/admin/padres/[id]` | HTTP 401 | permite |
| `/api/admin/padres/[id]/circulo-confianza` | HTTP 401 | permite |
| `/api/admin/padres/[id]/reactivar` | HTTP 401 | permite |
| `/api/admin/padres/[id]/restablecer-password` | HTTP 401 | permite |
| `/api/admin/padres/[id]/vigencia` | HTTP 401 | permite |
| `/api/admin/pagos/activar-manual` | HTTP 401 | permite |
| `/api/admin/pagos/bonos` | HTTP 401 | permite |
| `/api/admin/pagos/bonos/[id]` | HTTP 401 | permite |
| `/api/admin/pagos/bonos/[id]/desactivar` | HTTP 401 | permite |
| `/api/admin/pagos/cliente/[id]` | HTTP 401 | permite |
| `/api/admin/pagos/cliente/[id]/extender` | HTTP 401 | permite |
| `/api/admin/pagos/mora` | HTTP 401 | permite |
| `/api/admin/pagos/parametros` | HTTP 401 | permite |
| `/api/admin/pagos/pendientes` | HTTP 401 | permite |
| `/api/admin/pagos/pendientes/[id]/autorizar` | HTTP 401 | permite |
| `/api/admin/pagos/pendientes/[id]/rechazar` | HTTP 401 | permite |
| `/api/admin/pagos/planes` | HTTP 401 | permite |
| `/api/admin/pagos/planes/[id]` | HTTP 401 | permite |
| `/api/admin/pagos/reembolsos` | HTTP 401 | permite |
| `/api/admin/pagos/reembolsos/[id]` | HTTP 401 | permite |
| `/api/admin/pagos/sin-suscripcion` | HTTP 401 | permite |
| `/api/admin/pagos/solicitudes-pendientes` | HTTP 401 | permite |
| `/api/admin/pagos/tasas` | HTTP 401 | permite |
| `/api/admin/pagos/vencimientos` | HTTP 401 | permite |
| `/api/admin/permisos-modulos` | HTTP 401 | permite |
| `/api/admin/reportes-revision` | HTTP 401 | permite |
| `/api/admin/reportes-revision/[id]` | HTTP 401 | permite |
| `/api/admin/reportes-revision/[id]/confirmar` | HTTP 401 | permite |
| `/api/admin/reportes-revision/[id]/reasignar` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/anonimizar` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/baja` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/denuncia-formal` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/escalar` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/expediente` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/forense` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/forense/pdf` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/proceso` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/reactivar` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/resolver-spam` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/revelar-original` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/transiciones` | HTTP 401 | permite |
| `/api/admin/reportes/[id]/validar-anonimizacion` | HTTP 401 | permite |
| `/api/admin/servicios/[nombre]/restart` | HTTP 401 | permite |
| `/api/admin/servicios/[nombre]/start` | HTTP 401 | permite |
| `/api/admin/servicios/[nombre]/stop` | HTTP 401 | permite |
| `/api/admin/servicios/estado` | HTTP 401 | permite |
| `/api/admin/sesiones` | HTTP 401 | permite |
| `/api/admin/sesiones/[id]/cerrar` | HTTP 401 | permite |
| `/api/admin/spam/analitica` | HTTP 401 | permite |
| `/api/admin/spam/banco-sugerencias` | HTTP 401 | permite |
| `/api/admin/spam/pendientes` | HTTP 401 | permite |
| `/api/admin/usuarios` | HTTP 401 | permite |
| `/api/admin/usuarios/[id]` | HTTP 401 | permite |
| `/api/admin/usuarios/dashboard` | HTTP 401 | permite |
| `/api/alertas` | HTTP 401 | permite |
| `/api/alertas/[id]` | HTTP 401 | permite |
| `/api/alertas/suscribir` | HTTP 401 | permite |
| `/api/apelaciones` | HTTP 401 | permite |
| `/api/apelaciones/mias` | HTTP 401 | permite |
| `/api/circulo-confianza` | HTTP 401 | permite |
| `/api/circulo-confianza/[id]` | HTTP 401 | permite |
| `/api/circulo-confianza/agregado` | HTTP 401 | permite |
| `/api/circulo-confianza/preferencias` | HTTP 401 | permite |
| `/api/colegio` | HTTP 401 | permite |
| `/api/colegio/acudientes/[id]/identificadores` | HTTP 401 | permite |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | HTTP 401 | permite |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | HTTP 401 | permite |
| `/api/colegio/alertas` | HTTP 401 | permite |
| `/api/colegio/alertas/[id]` | HTTP 401 | permite |
| `/api/colegio/alertas/[id]/asignar` | HTTP 401 | permite |
| `/api/colegio/alertas/[id]/escalar` | HTTP 401 | permite |
| `/api/colegio/alertas/[id]/estado` | HTTP 401 | permite |
| `/api/colegio/alertas/[id]/notas` | HTTP 401 | permite |
| `/api/colegio/alumnos/[id]` | HTTP 401 | permite |
| `/api/colegio/alumnos/[id]/acudientes` | HTTP 401 | permite |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | HTTP 401 | permite |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | HTTP 401 | permite |
| `/api/colegio/alumnos/[id]/estado` | HTTP 401 | permite |
| `/api/colegio/alumnos/[id]/identificadores` | HTTP 401 | permite |
| `/api/colegio/alumnos/[id]/observacion` | HTTP 401 | permite |
| `/api/colegio/analisis/comparativa` | HTTP 401 | permite |
| `/api/colegio/analisis/comparativa/excel` | HTTP 401 | permite |
| `/api/colegio/auditoria` | HTTP 401 | permite |
| `/api/colegio/buscar` | HTTP 401 | permite |
| `/api/colegio/carga/confirmar` | HTTP 401 | permite |
| `/api/colegio/carga/plantilla` | HTTP 401 | permite |
| `/api/colegio/carga/validar` | HTTP 401 | permite |
| `/api/colegio/cobertura` | HTTP 401 | permite |
| `/api/colegio/comite` | HTTP 401 | permite |
| `/api/colegio/comite/cuenta` | HTTP 401 | permite |
| `/api/colegio/comite/cuenta/regenerar-password` | HTTP 401 | permite |
| `/api/colegio/comite/estadisticas` | HTTP 401 | permite |
| `/api/colegio/comite/integrantes` | HTTP 401 | permite |
| `/api/colegio/comite/integrantes/[id]` | HTTP 401 | permite |
| `/api/colegio/comite/integrantes/[id]/estado` | HTTP 401 | permite |
| `/api/colegio/comite/solicitudes` | HTTP 401 | permite |
| `/api/colegio/comite/solicitudes/[id]` | HTTP 401 | permite |
| `/api/colegio/comite/solicitudes/[id]/notas` | HTTP 401 | permite |
| `/api/colegio/comite/solicitudes/[id]/resolver` | HTTP 401 | permite |
| `/api/colegio/confianza/auditoria` | HTTP 401 | permite |
| `/api/colegio/confianza/documentos` | HTTP 401 | permite |
| `/api/colegio/confianza/protocolo/pdf` | HTTP 401 | permite |
| `/api/colegio/cursos` | HTTP 401 | permite |
| `/api/colegio/cursos/[id]` | HTTP 401 | permite |
| `/api/colegio/cursos/[id]/alumnos` | HTTP 401 | permite |
| `/api/colegio/cursos/[id]/duplicar` | HTTP 401 | permite |
| `/api/colegio/cursos/[id]/estado` | HTTP 401 | permite |
| `/api/colegio/cursos/[id]/materias` | HTTP 401 | permite |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | HTTP 401 | permite |
| `/api/colegio/cursos/unificado` | HTTP 401 | permite |
| `/api/colegio/cursos/unificado/plantilla` | HTTP 401 | permite |
| `/api/colegio/cursos/unificado/validar` | HTTP 401 | permite |
| `/api/colegio/estadisticas` | HTTP 401 | permite |
| `/api/colegio/estadisticas/pdf` | HTTP 401 | permite |
| `/api/colegio/identificadores-profesor/[id]` | HTTP 401 | permite |
| `/api/colegio/identificadores-profesor/[id]/estado` | HTTP 401 | permite |
| `/api/colegio/identificadores/[id]` | HTTP 401 | permite |
| `/api/colegio/identificadores/[id]/estado` | HTTP 401 | permite |
| `/api/colegio/materias` | HTTP 401 | permite |
| `/api/colegio/materias/[id]` | HTTP 401 | permite |
| `/api/colegio/materias/[id]/estado` | HTTP 401 | permite |
| `/api/colegio/notificaciones` | HTTP 401 | permite |
| `/api/colegio/notificaciones/[id]` | HTTP 401 | permite |
| `/api/colegio/notificaciones/marcar-leidas` | HTTP 401 | permite |
| `/api/colegio/notificaciones/resumen` | HTTP 401 | permite |
| `/api/colegio/onboarding` | HTTP 401 | permite |
| `/api/colegio/patrones` | HTTP 401 | permite |
| `/api/colegio/preferencias-avisos` | HTTP 401 | permite |
| `/api/colegio/profesores` | HTTP 401 | permite |
| `/api/colegio/profesores/[id]` | HTTP 401 | permite |
| `/api/colegio/profesores/[id]/identificadores` | HTTP 401 | permite |
| `/api/colegio/reportes/pdf` | HTTP 401 | permite |
| `/api/colegio/suscripcion/solicitar-plan` | HTTP 401 | permite |
| `/api/colegio/usuarios` | HTTP 401 | permite |
| `/api/config/parametros` | HTTP 401 | permite |
| `/api/config/parametros/[clave]` | HTTP 401 | permite |
| `/api/config/parametros/[clave]/revelar` | HTTP 401 | permite |
| `/api/config/parametros/todos` | HTTP 401 | permite |
| `/api/consentimiento/aceptar` | HTTP 401 | permite |
| `/api/interno/expediente/[id]/transicionar` | HTTP 401 | permite |
| `/api/me` | HTTP 401 | permite |
| `/api/me/colegio` | HTTP 401 | permite |
| `/api/notificaciones` | HTTP 401 | permite |
| `/api/notificaciones/[id]` | HTTP 401 | permite |
| `/api/notificaciones/preferencias` | HTTP 401 | permite |
| `/api/notificaciones/resumen` | HTTP 401 | permite |
| `/api/padre/circulo-confianza/semaforo` | HTTP 401 | permite |
| `/api/padre/circulo-confianza/timeline` | HTTP 401 | permite |
| `/api/padre/contacto-emergencia` | HTTP 401 | permite |
| `/api/padre/contacto-emergencia/[id]` | HTTP 401 | permite |
| `/api/padre/expediente/[id]/cerrar-forzoso` | HTTP 401 | permite |
| `/api/padre/expediente/[id]/pedir-aclaracion` | HTTP 401 | permite |
| `/api/padre/expedientes/[id]/eventos` | HTTP 401 | permite |
| `/api/padre/suscripcion/activar-freemium` | HTTP 401 | permite |
| `/api/padre/suscripcion/solicitar-plan` | HTTP 401 | permite |
| `/api/pagos` | HTTP 401 | permite |
| `/api/pagos/aplicar-bono` | HTTP 401 | permite |
| `/api/pagos/aplicar-referido` | HTTP 401 | permite |
| `/api/pagos/planes` | HTTP 401 | permite |
| `/api/pagos/renovacion` | HTTP 401 | permite |
| `/api/pagos/suscripcion` | HTTP 401 | permite |
| `/api/pagos/suscripcion/cancelar` | HTTP 401 | permite |
| `/api/pagos/suscripcion/estado` | HTTP 401 | permite |
| `/api/pagos/suscripcion/validar-bono` | HTTP 401 | permite |
| `/api/publico/guia-accion/categoria/[cat]` | HTTP 401 | permite |
| `/api/publico/verificar-pdf/[hash]` | HTTP 401 | permite |
| `/api/session/ping` | HTTP 401 | permite |
| `/api/vigencia/refresh` | HTTP 401 | permite |
| `/api/webhooks/resend` | HTTP 401 | permite |
| `/cambiar-password` | redirigir→/login | permite |
| `/consentimiento` | redirigir→/login | permite |
| `/consulta` | redirigir→/login | permite |
| `/dashboard` | redirigir→/login | permite |
| `/dashboard/apelaciones` | redirigir→/login | permite |
| `/dashboard/circulo-confianza` | redirigir→/login | permite |
| `/dashboard/colegio` | redirigir→/login | permite |
| `/dashboard/colegio/alertas` | redirigir→/login | permite |
| `/dashboard/colegio/alertas/[id]` | redirigir→/login | permite |
| `/dashboard/colegio/alumnos/[id]` | redirigir→/login | permite |
| `/dashboard/colegio/analisis/comparativa` | redirigir→/login | permite |
| `/dashboard/colegio/auditoria` | redirigir→/login | permite |
| `/dashboard/colegio/comite` | redirigir→/login | permite |
| `/dashboard/colegio/comite/casos` | redirigir→/login | permite |
| `/dashboard/colegio/comite/casos/[id]` | redirigir→/login | permite |
| `/dashboard/colegio/comite/estadisticas` | redirigir→/login | permite |
| `/dashboard/colegio/comite/integrantes` | redirigir→/login | permite |
| `/dashboard/colegio/confianza` | redirigir→/login | permite |
| `/dashboard/colegio/configuracion` | redirigir→/login | permite |
| `/dashboard/colegio/cursos` | redirigir→/login | permite |
| `/dashboard/colegio/cursos/[id]` | redirigir→/login | permite |
| `/dashboard/colegio/cursos/carga` | redirigir→/login | permite |
| `/dashboard/colegio/cursos/nuevo` | redirigir→/login | permite |
| `/dashboard/colegio/cursos/unificado` | redirigir→/login | permite |
| `/dashboard/colegio/estadisticas` | redirigir→/login | permite |
| `/dashboard/colegio/materias` | redirigir→/login | permite |
| `/dashboard/colegio/onboarding` | redirigir→/login | permite |
| `/dashboard/colegio/profesores` | redirigir→/login | permite |
| `/dashboard/colegio/profesores/[id]` | redirigir→/login | permite |
| `/dashboard/colegio/suscripcion` | redirigir→/login | permite |
| `/dashboard/colegio/tablero` | redirigir→/login | permite |
| `/dashboard/mis-reportes/[id]` | redirigir→/login | permite |
| `/dashboard/padre` | redirigir→/login | permite |
| `/dashboard/padre/circulo-confianza` | redirigir→/login | permite |
| `/dashboard/padre/expedientes` | redirigir→/login | permite |
| `/dashboard/padre/expedientes/[id]` | redirigir→/login | permite |
| `/dashboard/padre/identificador/[nick]` | redirigir→/login | permite |
| `/dashboard/padre/notificaciones` | redirigir→/login | permite |
| `/dashboard/padre/perfil` | redirigir→/login | permite |
| `/dashboard/padre/reportar` | redirigir→/login | permite |
| `/dashboard/padre/suscripcion` | redirigir→/login | permite |
| `/dashboard/perfil` | redirigir→/login | permite |
| `/dashboard/perfil/notificaciones` | redirigir→/login | permite |
| `/mis-reportes` | redirigir→/login | permite |

## Eje de módulos (BD): módulo → ruta → rol

Módulos del catálogo enlazados a ítems de navegación (`nav-items.ts`) y grants por
defecto del seed (`clavesPorRol` de `prisma/seed.ts`; los grants reales viven en BD).
Desde la D-41, el menú pinta un ítem solo si (módulo concedido) ∧ (predicado permite).

| Módulo | Ruta del menú | Roles con grant por defecto |
| --- | --- | --- |
| analisis_admin | `/dashboard/admin/analisis/reglas` | ADMIN |
| analisis_recomendaciones | `/dashboard/admin/analisis/recomendaciones` | ADMIN |
| anti_abuso | `/dashboard/admin/anti-abuso` | ADMIN |
| bandeja_reportes | `/dashboard/admin` | ADMIN, OPERADOR |
| centro_control_ia | `/dashboard/admin/ia` | ADMIN |
| colegios | `/dashboard/colegio` | ADMIN, COMITE_CONVIVENCIA, SCHOOL_ADMIN |
| colegios | `/dashboard/colegio/suscripcion` | ADMIN, COMITE_CONVIVENCIA, SCHOOL_ADMIN |
| colegios_auditoria | `/dashboard/colegio/auditoria` | ADMIN, SCHOOL_ADMIN |
| colegios_comite_bandeja | `/dashboard/colegio/comite/casos` | ADMIN, COMITE_CONVIVENCIA, SCHOOL_ADMIN |
| colegios_gestion | `/dashboard/admin/colegios` | ADMIN, SCHOOL_ADMIN |
| colegios_gestion | `/dashboard/colegio/alertas` | ADMIN, SCHOOL_ADMIN |
| colegios_gestion | `/dashboard/colegio/configuracion` | ADMIN, SCHOOL_ADMIN |
| colegios_gestion | `/dashboard/colegio/cursos` | ADMIN, SCHOOL_ADMIN |
| colegios_gestion | `/dashboard/colegio/estadisticas` | ADMIN, SCHOOL_ADMIN |
| colegios_gestion | `#` | ADMIN, SCHOOL_ADMIN |
| comite | `/dashboard/admin/comite/gestion` | ADMIN, COMITE_VALIDACION |
| comite_auditoria | `/dashboard/admin/comite/auditoria` | ADMIN |
| comite_bandeja | `/dashboard/admin/comite` | ADMIN, COMITE_VALIDACION |
| comite_bandeja | `/dashboard/admin/comite` | ADMIN, COMITE_VALIDACION |
| comite_bandeja | `/dashboard/admin/comite/apelaciones` | ADMIN, COMITE_VALIDACION |
| comite_guias_accion | `/dashboard/admin/comite/guias-pendientes` | ADMIN, COMITE_VALIDACION |
| configuracion_sistema | `/dashboard/admin/configuracion` | ADMIN |
| dataset_entrenamiento | `/dashboard/admin/dataset-entrenamiento` | ADMIN |
| estadisticas | `/dashboard/admin/estadisticas` | ADMIN |
| operadores | `/dashboard/admin/operadores` | ADMIN |
| padres | `/dashboard/admin/padres` | ADMIN |
| pagos_admin | `/dashboard/admin/pagos` | ADMIN |
| revision_spam | `/dashboard/admin/spam` | ADMIN |
| usuarios_admin | `/dashboard/admin/usuarios` | ADMIN |

## Hrefs del header (NavHeader.tsx)

Hrefs literales con su guarda de rol (parseados del JSX; la cobertura es total: un
href nuevo sin guarda declarada hace fallar la aserción B ruidosamente).

| Href | Roles que lo ven (guarda JSX ∧ predicado) |
| --- | --- |
| `/` | ADMIN, OPERADOR, COMITE_VALIDACION, SCHOOL_ADMIN, COMITE_CONVIVENCIA, PARENT, ANONIMO |
| `/cambiar-password` | ADMIN, OPERADOR, COMITE_VALIDACION, SCHOOL_ADMIN, COMITE_CONVIVENCIA, PARENT |
| `/dashboard` | PARENT |
| `/dashboard-publico` | ADMIN, OPERADOR, COMITE_VALIDACION, SCHOOL_ADMIN, COMITE_CONVIVENCIA, PARENT, ANONIMO |
| `/dashboard/admin` | ADMIN, OPERADOR |
| `/dashboard/admin/comite` | COMITE_VALIDACION |
| `/dashboard/admin/configuracion` | ADMIN |
| `/dashboard/circulo-confianza` | PARENT |
| `/dashboard/colegio` | SCHOOL_ADMIN |
| `/dashboard/colegio/comite/casos` | SCHOOL_ADMIN, COMITE_CONVIVENCIA |
| `/login` | ANONIMO |
| `/mis-reportes` | PARENT |
