# Checklist de requisitos · SPEC-857

- [x] FR-001 · Menú admin de 2 niveles desde `navParaRol` (fuente única; `nav-superficie-unica` verde).
- [x] FR-002 · Grupo visible ⟺ ≥1 hijo visible (compuerta por hijos; `nav/para-rol.test` verde).
- [x] FR-003 · Encabezado visible ⟺ sección con ≥1 hoja (sin huérfanos; test verde).
- [x] FR-004 · Cada hoja con el módulo que gatea su página (48 rutas verificadas; `nav-items.test` verde; `audit_logs`/`guias_accion_admin`/`estadisticas_salud_motor` fuera de SIN_PANTALLA_PROPIA).
- [x] FR-005 · Cero íconos nuevos (claves de grupo reusan componentes; hojas sin ícono; `nav-iconos.candado` verde).
- [x] FR-006 · `/dashboard/admin` redirige a hoja real (nunca `#`) vía `aplanarNavItems`.
- [x] FR-007 · `npm run arch:check` VERDE.
- [x] 3 drops aplicados (Pagos Resumen/Analítica, Estadísticas Clasificación); Pagos=9, Estadísticas=4.
- [x] `tsc` + `lint` (0 errores) verdes.
- [ ] `test:unit` (job completo) + `build` verdes.
- [ ] Recorrido en vivo + certificación de Diseño contra ec4910a.
