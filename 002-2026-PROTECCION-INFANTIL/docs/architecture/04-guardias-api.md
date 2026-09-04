> GENERADO por `scripts/arch/generar-guardias-api.ts` — no editar a mano.
> Fuentes: `src/app/api/**`, `src/lib/routing/guardias.ts`, `src/lib/routing/roles-titulares.ts`, `middleware.ts`.
> Regenerar: `npx tsx scripts/arch/generar-guardias-api.ts` (o `npm run arch:check` para verificar).

# 04 · Guardianes de `/api/**` (fase de análisis — SPEC-400b)

> Este documento **es un análisis, no un fix**. La corrección (`middleware.ts`, `proxy.ts`, tests nuevos) se radica en un PR aparte con este inventario en la mano.

## Fenómeno medido (I-236 · I-239)

El middleware evalúa los guardianes 4 (`consentimiento`), 5 (`cambio-de-password` + `camino`) y 6 (`vigencia`) SOLO cuando puede leer la cookie firmada `sesion_estado`. Si la cookie **no está** (caducó a los 5 min, es de antes del despliegue, o el navegador la perdió), el bloque `if (estado) { … }` es falso y las tres etapas **se saltan enteras**: la request PASA sin evaluar. Para pantallas HTML de `PARENT` y `SCHOOL_ADMIN` existe un rebote explícito a `/api/sesion/al-dia` que re-sella la cookie (SPEC-339 · A-67), pero **ese rebote NO cubre `/api/**`**: cualquier `/api/**` sin cookie pasa. Ese es el «borde que se abre solo cada 5 minutos».

## Alcance de este PR

1. **Inventario completo** de todas las rutas `/api/**` con los guardianes que aplican HOY con cookie, ejecutando los helpers reales de `src/lib/routing/guardias.ts`.
2. **Fail-open medido**: qué pasa sin cookie por ruta (siempre `PASA`; se documenta para dejar explícito el mapa).
3. **Recomendación fail-closed por ruta**: `bloquear` / `exenta` / `decidir`. Las decisiones difíciles quedan marcadas `decidir` con dos opciones — SPEC-400b implementación decide.
4. **Matriz de pruebas de cookie-ausente** por guardián y por rol, que hoy no existe (`middleware-api-guardias.test.ts` solo cubre CON cookie).

Candado 22 v5: enumeración completa, no muestreo.

## Resumen

- Total de rutas `/api/**`: **385**
- Recomendación **bloquear** en fail-closed: **325**
- Recomendación **exenta** en fail-closed: **48**
- **Decidir** (requiere decisión CEO/Jelkin): **12**

## Guardianes que aplican HOY (con cookie `sesion_estado`)

Cada celda es `SÍ` si el guardián evalúa la ruta cuando la cookie existe. `no` si la ruta está exenta. `—` si la ruta es pública (`P`) o de sesión (`S`) y por diseño no llega a los guardianes.

Camino y vigencia se ramifican por rol: se listan las dos ramas relevantes (PARENT vs SCHOOL_ADMIN para camino; roles con vigencia en columnas separadas).

| Ruta | Tipo | Consent. | Camb. clave | Camino PARENT | Camino SCHOOL_ADMIN | Vigencia PARENT | Vigencia SCHOOL_ADMIN |
|------|------|----------|-------------|---------------|---------------------|-----------------|-----------------------|
| `/api/admin/analisis/anomalias` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/anomalias/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/dinero-vs-valor` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/dispersion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/kpis` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/recomendaciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/recomendaciones/export` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/recomendaciones/metricas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/reglas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/reglas/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/reglas/[id]/historial` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/reglas/[id]/modo` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/reglas/test-sql` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analisis/top-decisiones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analytics/colegios` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/analytics/colegios/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/anti-abuso/bloquear` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/anti-abuso/desbloquear` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/anti-abuso/simulacion-score` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/anti-abuso/simular` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/anti-abuso/simular/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/anti-abuso/simular/sugerencias` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/anti-abuso/tablero` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/audit-logs` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/colegios` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/colegios/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/colegios/[id]/cursos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/colegios/[id]/reenviar-email` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/colegios/[id]/regenerar-password` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/[id]/asignar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/[id]/reasignar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/[id]/resolver` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/aclaracion/[id]/responder` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/apelaciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/apelaciones/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/apelaciones/[id]/documento` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/apelaciones/[id]/resolver` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/apelaciones/[id]/tomar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/consolidacion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/consolidacion/[expedienteId]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/guias-accion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/guias-accion/[id]/aprobar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/guias-accion/[id]/rechazar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/integrantes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/integrantes/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/mias` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/pendientes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/comite/solicitudes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/correcciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/dataset-entrenamiento` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/estadisticas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/estadisticas/clasificacion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/estadisticas/denuncias-formales` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/estadisticas/dinero-vs-valor` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/guias-accion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/guias-accion/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/guias-accion/[id]/enviar-comite` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/guias-accion/[id]/preview` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/modelos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/ollama/probar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/rubrica` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/rubrica/config` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/rubrica/definiciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/rubrica/preguntas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/sandbox` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/simulaciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/simulaciones/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/simulaciones/[id]/analisis` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/simulaciones/[id]/cancelar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/simulaciones/[id]/export` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/simulaciones/[id]/resultados` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/ia/simulaciones/comparar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/inicio/senales` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/matches` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/monitoreo/atascados` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/monitoreo/estado` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/monitoreo/historial` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/monitoreo/incidentes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/monitoreo/logs` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/motor/deriva` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/motor/deriva/recalcular` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/bandeja` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/catalogos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/parametros` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/parametros/[clave]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/plantillas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/plantillas/[clave]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/reglas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/reglas/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/notificaciones/salud` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/[id]/casos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/[id]/metricas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/[id]/reactivar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/[id]/reenviar-email` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/[id]/regenerar-password` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/asignacion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/modelo` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/reasignar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/operadores/reconciliar-huerfanos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/padres` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/padres/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/padres/[id]/circulo-confianza` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/padres/[id]/reactivar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/padres/[id]/reenviar-email` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/padres/[id]/restablecer-password` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/padres/[id]/vigencia` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/activar-manual` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/bonos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/bonos/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/bonos/[id]/desactivar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/cita/[id]/activar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/cita/pendientes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/cliente/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/cliente/[id]/extender` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/mora` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/parametros` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/pendientes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/pendientes/[id]/autorizar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/pendientes/[id]/rechazar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/planes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/planes/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/reembolsos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/reembolsos/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/sin-suscripcion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/solicitudes-pendientes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/tasas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/pagos/vencimientos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/permisos-modulos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/profesionales` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/profesionales/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/profesionales/[id]/reactivar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/profesionales/[id]/reenviar-email` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/profesionales/[id]/restablecer-password` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/profesionales/solicitudes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/profesionales/solicitudes/reenviar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes-revision` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes-revision/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes-revision/[id]/clasificar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes-revision/[id]/confirmar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes-revision/[id]/reasignar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/anonimizar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/baja` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/denuncia-formal` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/escalar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/expediente` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/forense` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/forense/pdf` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/proceso` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/reactivar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/resolver-spam` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/revelar-original` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/transiciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/reportes/[id]/validar-anonimizacion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/servicios/[nombre]/restart` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/servicios/[nombre]/start` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/servicios/[nombre]/stop` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/servicios/estado` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/sesiones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/sesiones/[id]/cerrar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/spam/analitica` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/spam/banco-sugerencias` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/spam/pendientes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/tipos-documento` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/tipos-documento/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/usuarios` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/usuarios/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/usuarios/dashboard` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/verificacion-profesionales` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/verificacion-profesionales/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/verificacion-profesionales/[id]/decidir` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/admin/verificacion-profesionales/incidentes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/alertas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/alertas/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/alertas/suscribir` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/apelaciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/apelaciones/mias` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/auth/activar` | P | — | — | — | — | — | — |
| `/api/auth/cambiar-password` | P | — | — | — | — | — | — |
| `/api/auth/link-bi` | P | — | — | — | — | — | — |
| `/api/auth/login` | P | — | — | — | — | — | — |
| `/api/auth/logout` | P | — | — | — | — | — | — |
| `/api/auth/recuperar/restablecer` | P | — | — | — | — | — | — |
| `/api/auth/recuperar/solicitar` | P | — | — | — | — | — | — |
| `/api/auth/recuperar/validar` | P | — | — | — | — | — | — |
| `/api/auth/register` | P | — | — | — | — | — | — |
| `/api/auth/registro-colegio/completar` | P | — | — | — | — | — | — |
| `/api/auth/registro-colegio/solicitar` | P | — | — | — | — | — | — |
| `/api/auth/registro-profesional/completar` | P | — | — | — | — | — | — |
| `/api/auth/registro-profesional/solicitar` | P | — | — | — | — | — | — |
| `/api/auth/registro/completar` | P | — | — | — | — | — | — |
| `/api/auth/registro/solicitar` | P | — | — | — | — | — | — |
| `/api/auth/verificar/completar` | P | — | — | — | — | — | — |
| `/api/auth/verificar/solicitar` | P | — | — | — | — | — | — |
| `/api/auth/verificar/validar` | P | — | — | — | — | — | — |
| `/api/circulo-confianza` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/circulo-confianza/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/circulo-confianza/agregado` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/circulo-confianza/preferencias` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/ciudades` | P | — | — | — | — | — | — |
| `/api/ciudades/buscar` | P | — | — | — | — | — | — |
| `/api/colegio/acudientes/[id]/identificadores` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/alertas` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alertas/[id]` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alertas/[id]/asignar` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alertas/[id]/escalar` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alertas/[id]/estado` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alertas/[id]/notas` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alumnos/[id]` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alumnos/[id]/acudientes` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alumnos/[id]/estado` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alumnos/[id]/identificadores` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/alumnos/[id]/observacion` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/analisis/comparativa` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/analisis/comparativa/excel` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/auditoria` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/buscar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/carga-profesores/confirmar` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/carga-profesores/plantilla` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/carga-profesores/validar` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/carga/confirmar` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/carga/plantilla` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/carga/validar` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/casos/[id]/analisis` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/casos/[id]/informes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/casos/[id]/informes/[hash]/pdf` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/cobertura` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/cuenta` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/cuenta/reenviar-invitacion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/estadisticas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/integrantes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/integrantes/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/integrantes/[id]/estado` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/integrantes/[id]/identificadores` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/integrantes/[id]/identificadores/[identificadorId]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/solicitudes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/solicitudes/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/solicitudes/[id]/analisis` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/solicitudes/[id]/notas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/solicitudes/[id]/recomendar-informe` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/comite/solicitudes/[id]/resolver` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/confianza/auditoria` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/confianza/documentos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/confianza/protocolo/pdf` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/configuracion/escudo` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/cursos` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/[id]` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/[id]/alumnos` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/[id]/duplicar` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/[id]/estado` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/[id]/materias` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/unificado` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/unificado/plantilla` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/cursos/unificado/validar` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/estadisticas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/estadisticas/pdf` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/identificadores-profesor/[id]` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/identificadores-profesor/[id]/estado` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/identificadores/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/identificadores/[id]/estado` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/materias` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/materias/[id]` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/materias/[id]/estado` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/notificaciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/notificaciones/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/notificaciones/marcar-leidas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/notificaciones/resumen` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/onboarding` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/patrones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/preferencias-avisos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/profesores` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/profesores/[id]` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/profesores/[id]/identificadores` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/rector` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/reportes/pdf` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/colegio/suscripcion/activar-freemium` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/suscripcion/solicitar-plan` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/tipos-documento` | R | SÍ | SÍ | SÍ | no | SÍ | no |
| `/api/colegio/usuarios` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/config/parametros` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/config/parametros/[clave]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/config/parametros/[clave]/revelar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/config/parametros/publicos` | P | — | — | — | — | — | — |
| `/api/config/parametros/todos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/consentimiento/aceptar` | S | — | — | — | — | — | — |
| `/api/consulta` | P | — | — | — | — | — | — |
| `/api/consulta/detalle` | P | — | — | — | — | — | — |
| `/api/consulta/evento` | P | — | — | — | — | — | — |
| `/api/departamentos` | P | — | — | — | — | — | — |
| `/api/docs/indice` | P | — | — | — | — | — | — |
| `/api/estadisticas-publicas` | P | — | — | — | — | — | — |
| `/api/health` | P | — | — | — | — | — | — |
| `/api/health/worker` | P | — | — | — | — | — | — |
| `/api/interno/expediente/[id]/transicionar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/me` | S | — | — | — | — | — | — |
| `/api/me/colegio` | S | — | — | — | — | — | — |
| `/api/monitor/notif` | P | — | — | — | — | — | — |
| `/api/notificaciones` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/notificaciones/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/notificaciones/preferencias` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/notificaciones/resumen` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/circulo-confianza/semaforo` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/circulo-confianza/timeline` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/citas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/citas/[id]/reasignar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/citas/[id]/reprogramar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/contacto-emergencia` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/contacto-emergencia/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/expediente/[id]/cerrar-forzoso` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/expediente/[id]/pedir-aclaracion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/expedientes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/expedientes/[id]/analisis` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/expedientes/[id]/eventos` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/expedientes/[id]/lectura` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/expedientes/[id]/pdf` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/hijos` | R | SÍ | SÍ | no | SÍ | no | SÍ |
| `/api/padre/hijos/[id]` | R | SÍ | SÍ | no | SÍ | no | SÍ |
| `/api/padre/hijos/[id]/bitacora` | R | SÍ | SÍ | no | SÍ | no | SÍ |
| `/api/padre/hijos/identificadores` | R | SÍ | SÍ | no | SÍ | no | SÍ |
| `/api/padre/hijos/identificadores/[id]` | R | SÍ | SÍ | no | SÍ | no | SÍ |
| `/api/padre/home` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/home/sugerencia` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/perfil` | R | SÍ | SÍ | no | SÍ | no | SÍ |
| `/api/padre/profesionales` | R | SÍ | SÍ | SÍ | SÍ | no | SÍ |
| `/api/padre/profesionales/[id]` | R | SÍ | SÍ | SÍ | SÍ | no | SÍ |
| `/api/padre/profesionales/facetas` | R | SÍ | SÍ | SÍ | SÍ | no | SÍ |
| `/api/padre/reportes/[id]/texto` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/reportes/cadenas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/step-up` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/padre/suscripcion/activar-freemium` | R | SÍ | SÍ | no | SÍ | no | SÍ |
| `/api/padre/suscripcion/solicitar-plan` | R | SÍ | SÍ | no | SÍ | no | SÍ |
| `/api/pagos/aplicar-bono` | R | SÍ | SÍ | no | no | no | no |
| `/api/pagos/aplicar-referido` | R | SÍ | SÍ | no | no | no | no |
| `/api/pagos/planes` | R | SÍ | SÍ | no | no | no | no |
| `/api/pagos/renovacion` | R | SÍ | SÍ | no | no | no | no |
| `/api/pagos/suscripcion` | R | SÍ | SÍ | no | no | no | no |
| `/api/pagos/suscripcion/cancelar` | R | SÍ | SÍ | no | no | no | no |
| `/api/pagos/suscripcion/estado` | R | SÍ | SÍ | no | no | no | no |
| `/api/pagos/suscripcion/validar-bono` | R | SÍ | SÍ | no | no | no | no |
| `/api/paises` | P | — | — | — | — | — | — |
| `/api/plataformas` | P | — | — | — | — | — | — |
| `/api/profesional/autorizacion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/franjas` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/franjas/[id]` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/panel` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/perfil` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/solicitudes` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/solicitudes/[id]/confirmar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/solicitudes/[id]/rechazar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/verificacion` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/profesional/verificacion/reenviar` | R | SÍ | SÍ | SÍ | SÍ | SÍ | SÍ |
| `/api/publico/guia-accion/categoria/[cat]` | P | — | — | — | — | — | — |
| `/api/publico/profesionales/[id]/franjas` | P | — | — | — | — | — | — |
| `/api/publico/verificar-pdf/[hash]` | P | — | — | — | — | — | — |
| `/api/reportes` | P | — | — | — | — | — | — |
| `/api/reportes/[id]/evento` | P | — | — | — | — | — | — |
| `/api/reportes/fallback` | P | — | — | — | — | — | — |
| `/api/reportes/mis-reportes` | P | — | — | — | — | — | — |
| `/api/reportes/mis-reportes/[id]` | P | — | — | — | — | — | — |
| `/api/reportes/procesar` | P | — | — | — | — | — | — |
| `/api/reportes/seguimiento/[numero]` | P | — | — | — | — | — | — |
| `/api/sesion/al-dia` | S | — | — | — | — | — | — |
| `/api/session/ping` | R | SÍ | SÍ | no | no | SÍ | no |
| `/api/vigencia/refresh` | S | — | — | — | — | — | — |
| `/api/webhooks/resend` | P | — | — | — | — | — | — |

## Recomendación fail-closed por ruta

**Regla de lectura**:

- `exenta`: entra en el catálogo explícito de rutas que deben responder sin cookie de estado (login, health, webhooks, catálogos, rebotes de sesión, pagos-si-eso-es-lo-que-decide-CEO).
- `decidir`: hay dos lecturas legítimas; SPEC-400b implementación decide con el CEO.
- `bloquear`: si el fail-closed se activa, esta ruta responde `401`/`403` cuando la cookie está ausente (default de «cualquier /api/ regular»).

| Ruta | Fail-open hoy | Fail-closed propuesto | Motivo |
|------|---------------|-----------------------|--------|
| `/api/admin/analisis/anomalias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/anomalias/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/dinero-vs-valor` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/dispersion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/kpis` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/recomendaciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/recomendaciones/[id]/aplicar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/recomendaciones/[id]/resolver` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/recomendaciones/[id]/revertir` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/recomendaciones/export` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/recomendaciones/metricas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/reglas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/reglas/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/reglas/[id]/historial` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/reglas/[id]/modo` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/reglas/test-sql` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analisis/top-decisiones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analytics/colegios` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/analytics/colegios/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/anti-abuso/bloquear` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/anti-abuso/desbloquear` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/anti-abuso/simulacion-score` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/anti-abuso/simular` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/anti-abuso/simular/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/anti-abuso/simular/[id]/cancelar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/anti-abuso/simular/sugerencias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/anti-abuso/tablero` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/audit-logs` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/colegios` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/colegios/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/colegios/[id]/cursos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/colegios/[id]/cursos/[cursoId]/alumnos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/colegios/[id]/reenviar-email` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/colegios/[id]/regenerar-password` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/[id]/asignar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/[id]/reasignar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/[id]/resolver` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/aclaracion/[id]/responder` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/apelaciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/apelaciones/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/apelaciones/[id]/documento` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/apelaciones/[id]/resolver` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/apelaciones/[id]/tomar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/consolidacion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/consolidacion/[expedienteId]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/consolidacion/[expedienteId]/aprobar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/consolidacion/[expedienteId]/corregir` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/consolidacion/[expedienteId]/devolver` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/expediente/[id]/activar-emergencia` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/guias-accion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/guias-accion/[id]/aprobar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/guias-accion/[id]/rechazar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/integrantes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/integrantes/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/mias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/pendientes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/comite/solicitudes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/correcciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/dataset-entrenamiento` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/estadisticas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/estadisticas/clasificacion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/estadisticas/denuncias-formales` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/estadisticas/dinero-vs-valor` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/guias-accion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/guias-accion/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/guias-accion/[id]/enviar-comite` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/guias-accion/[id]/preview` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/modelos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/ollama/probar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/rubrica` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/rubrica/config` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/rubrica/definiciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/rubrica/definiciones/[categoria]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/rubrica/preguntas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/sandbox` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/simulaciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/simulaciones/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/simulaciones/[id]/analisis` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/simulaciones/[id]/cancelar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/simulaciones/[id]/export` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/simulaciones/[id]/resultados` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/ia/simulaciones/comparar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/inicio/senales` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/matches` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/monitoreo/atascados` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/monitoreo/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/monitoreo/historial` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/monitoreo/incidentes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/monitoreo/logs` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/motor/deriva` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/motor/deriva/recalcular` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/bandeja` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/bandeja/[id]/reenviar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/catalogos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/parametros` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/parametros/[clave]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/plantillas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/plantillas/[clave]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/plantillas/[clave]/preview` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/reglas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/reglas/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/reglas/[id]/recalcular` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/reglas/[id]/recalcular-preview` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/notificaciones/salud` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/[id]/casos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/[id]/metricas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/[id]/reactivar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/[id]/reenviar-email` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/[id]/regenerar-password` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/asignacion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/modelo` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/reasignar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/operadores/reconciliar-huerfanos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/padres` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/padres/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/padres/[id]/circulo-confianza` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/padres/[id]/reactivar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/padres/[id]/reenviar-email` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/padres/[id]/restablecer-password` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/padres/[id]/vigencia` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/activar-manual` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/bonos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/bonos/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/bonos/[id]/desactivar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/cita/[id]/activar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/cita/pendientes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/cliente/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/cliente/[id]/extender` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/mora` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/parametros` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/pendientes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/pendientes/[id]/autorizar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/pendientes/[id]/rechazar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/planes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/planes/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/reembolsos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/reembolsos/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/sin-suscripcion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/solicitudes-pendientes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/tasas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/pagos/vencimientos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/permisos-modulos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/profesionales` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/profesionales/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/profesionales/[id]/reactivar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/profesionales/[id]/reenviar-email` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/profesionales/[id]/restablecer-password` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/profesionales/solicitudes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/profesionales/solicitudes/reenviar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes-revision` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes-revision/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes-revision/[id]/clasificar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes-revision/[id]/confirmar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes-revision/[id]/reasignar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/anonimizar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/baja` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/denuncia-formal` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/escalar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/expediente` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/forense` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/forense/pdf` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/proceso` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/reactivar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/resolver-spam` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/revelar-original` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/transiciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/reportes/[id]/validar-anonimizacion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/servicios/[nombre]/restart` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/servicios/[nombre]/start` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/servicios/[nombre]/stop` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/servicios/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/sesiones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/sesiones/[id]/cerrar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/spam/analitica` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/spam/banco-sugerencias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/spam/pendientes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/tipos-documento` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/tipos-documento/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/usuarios` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/usuarios/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/usuarios/dashboard` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/verificacion-profesionales` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/verificacion-profesionales/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/verificacion-profesionales/[id]/decidir` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/admin/verificacion-profesionales/incidentes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/alertas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/alertas/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/alertas/suscribir` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/apelaciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/apelaciones/mias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/auth/activar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/cambiar-password` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/link-bi` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/login` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/logout` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/recuperar/restablecer` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/recuperar/solicitar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/recuperar/validar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/register` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/registro-colegio/completar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/registro-colegio/solicitar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/registro-profesional/completar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/registro-profesional/solicitar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/registro/completar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/registro/solicitar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/verificar/completar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/verificar/solicitar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/auth/verificar/validar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/circulo-confianza` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/circulo-confianza/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/circulo-confianza/agregado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/circulo-confianza/preferencias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/ciudades` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/ciudades/buscar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/colegio/acudientes/[id]/identificadores` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alertas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alertas/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alertas/[id]/asignar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alertas/[id]/escalar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alertas/[id]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alertas/[id]/notas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alumnos/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alumnos/[id]/acudientes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alumnos/[id]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alumnos/[id]/identificadores` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/alumnos/[id]/observacion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/analisis/comparativa` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/analisis/comparativa/excel` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/auditoria` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/buscar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/carga-profesores/confirmar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/carga-profesores/plantilla` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/carga-profesores/validar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/carga/confirmar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/carga/plantilla` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/carga/validar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/casos/[id]/analisis` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/casos/[id]/informes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/casos/[id]/informes/[hash]/pdf` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cobertura` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/cuenta` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/cuenta/reenviar-invitacion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/estadisticas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/integrantes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/integrantes/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/integrantes/[id]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/integrantes/[id]/identificadores` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/integrantes/[id]/identificadores/[identificadorId]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/solicitudes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/solicitudes/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/solicitudes/[id]/analisis` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/solicitudes/[id]/notas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/solicitudes/[id]/recomendar-informe` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/comite/solicitudes/[id]/resolver` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/confianza/auditoria` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/confianza/documentos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/confianza/protocolo/pdf` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/configuracion/escudo` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/[id]/alumnos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/[id]/duplicar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/[id]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/[id]/materias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/[id]/materias/[materiaId]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/unificado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/unificado/plantilla` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/cursos/unificado/validar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/estadisticas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/estadisticas/pdf` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/identificadores-profesor/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/identificadores-profesor/[id]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/identificadores/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/identificadores/[id]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/materias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/materias/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/materias/[id]/estado` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/notificaciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/notificaciones/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/notificaciones/marcar-leidas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/notificaciones/resumen` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/onboarding` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/patrones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/preferencias-avisos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/profesores` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/profesores/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/profesores/[id]/identificadores` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/rector` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/reportes/pdf` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/suscripcion/activar-freemium` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/colegio/suscripcion/solicitar-plan` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/colegio/tipos-documento` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/colegio/usuarios` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/config/parametros` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/config/parametros/[clave]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/config/parametros/[clave]/revelar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/config/parametros/publicos` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/config/parametros/todos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/consentimiento/aceptar` | PASA | **exenta** | ruta de sesión (necesaria para salir del bloqueo) |
| `/api/consulta` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/consulta/detalle` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/consulta/evento` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/departamentos` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/docs/indice` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/estadisticas-publicas` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/health` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/health/worker` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/interno/expediente/[id]/transicionar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/me` | PASA | **exenta** | ruta de sesión (necesaria para salir del bloqueo) |
| `/api/me/colegio` | PASA | **exenta** | ruta de sesión (necesaria para salir del bloqueo) |
| `/api/monitor/notif` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/notificaciones` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/notificaciones/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/notificaciones/preferencias` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/notificaciones/resumen` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/circulo-confianza/semaforo` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/circulo-confianza/timeline` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/citas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/citas/[id]/reasignar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/citas/[id]/reprogramar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/contacto-emergencia` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/contacto-emergencia/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/expediente/[id]/cerrar-forzoso` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/expediente/[id]/pedir-aclaracion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/expedientes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/expedientes/[id]/analisis` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/expedientes/[id]/eventos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/expedientes/[id]/lectura` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/expedientes/[id]/pdf` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/hijos` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/hijos/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/hijos/[id]/bitacora` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/hijos/identificadores` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/hijos/identificadores/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/home` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/home/sugerencia` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/perfil` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/profesionales` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/profesionales/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/profesionales/facetas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/reportes/[id]/texto` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/reportes/cadenas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/step-up` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/padre/suscripcion/activar-freemium` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/padre/suscripcion/solicitar-plan` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/aplicar-bono` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/aplicar-referido` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/planes` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/renovacion` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/suscripcion` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/suscripcion/cancelar` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/suscripcion/estado` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/suscripcion/validar-bono` | PASA | **decidir** | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/paises` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/plataformas` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/profesional/autorizacion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/franjas` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/franjas/[id]` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/panel` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/perfil` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/solicitudes` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/solicitudes/[id]/confirmar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/solicitudes/[id]/rechazar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/verificacion` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/profesional/verificacion/reenviar` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/publico/guia-accion/categoria/[cat]` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/publico/profesionales/[id]/franjas` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/publico/verificar-pdf/[hash]` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/reportes` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/reportes/[id]/evento` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/reportes/fallback` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/reportes/mis-reportes` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/reportes/mis-reportes/[id]` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/reportes/procesar` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/reportes/seguimiento/[numero]` | PASA | **exenta** | pública por diseño (sin JWT) |
| `/api/sesion/al-dia` | PASA | **exenta** | ruta de sesión (necesaria para salir del bloqueo) |
| `/api/session/ping` | PASA | **bloquear** | cae en el catálogo genérico |
| `/api/vigencia/refresh` | PASA | **exenta** | ruta de sesión (necesaria para salir del bloqueo) |
| `/api/webhooks/resend` | PASA | **exenta** | pública por diseño (sin JWT) |

## Decisiones abiertas (`decidir`)

12 rutas caen fuera del catálogo «exenta obvia» pero cuya exención es discutible. Las dos opciones se listan aquí para que Jelkin/CEO decida antes de codificar.

| Ruta | Opciones |
|------|----------|
| `/api/colegio/suscripcion/activar-freemium` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/colegio/suscripcion/solicitar-plan` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/padre/suscripcion/activar-freemium` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/padre/suscripcion/solicitar-plan` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/aplicar-bono` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/aplicar-referido` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/planes` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/renovacion` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/suscripcion` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/suscripcion/cancelar` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/suscripcion/estado` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |
| `/api/pagos/suscripcion/validar-bono` | pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida |

## Matriz de pruebas de cookie-ausente por guardián × rol

`middleware-api-guardias.test.ts` (SPEC-329) hoy solo cubre el escenario CON cookie. Esta matriz enumera los casos SIN cookie que faltan: para cada rol autenticado + guardián, qué debería contestar la ruta si se aplica fail-closed.

| Guardián | Rol | Escenario | Hoy responde | Con fail-closed debería responder |
|----------|-----|-----------|--------------|-----------------------------------|
| consentimiento | PARENT | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CONSENTIMIENTO_REQUERIDO" }` |
| consentimiento | SCHOOL_ADMIN | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CONSENTIMIENTO_REQUERIDO" }` |
| cambio-de-password | PARENT | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMBIO_PASSWORD_REQUERIDO" }` |
| cambio-de-password | SCHOOL_ADMIN | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMBIO_PASSWORD_REQUERIDO" }` |
| cambio-de-password | COMITE_CONVIVENCIA | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMBIO_PASSWORD_REQUERIDO" }` |
| cambio-de-password | COMITE_VALIDACION | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMBIO_PASSWORD_REQUERIDO" }` |
| cambio-de-password | OPERADOR | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMBIO_PASSWORD_REQUERIDO" }` |
| cambio-de-password | ADMIN | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMBIO_PASSWORD_REQUERIDO" }` |
| cambio-de-password | PROFESIONAL | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMBIO_PASSWORD_REQUERIDO" }` |
| cambio-de-password | VERIFICADOR | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMBIO_PASSWORD_REQUERIDO" }` |
| camino | PARENT | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMINO_INCOMPLETO" }` |
| camino | SCHOOL_ADMIN | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "CAMINO_INCOMPLETO" }` |
| vigencia | PARENT | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "VIGENCIA_REQUERIDA" }` |
| vigencia | SCHOOL_ADMIN | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "VIGENCIA_REQUERIDA" }` |
| vigencia | COMITE_CONVIVENCIA | POST /api/ regular sin `sesion_estado` | **200/OK (fail-open)** | `403 { code: "VIGENCIA_REQUERIDA" }` |

**Cobertura pendiente**: cada fila de arriba requiere un test que valida el comportamiento fail-closed. Se implementan en el PR de SPEC-400b, no acá.
