# Checklist de requisitos: SPEC-189

## Backend

- [ ] `GET /api/admin/operadores/[id]/metricas` existe y requiere ADMIN + módulo `operadores`.
- [ ] Devuelve `casosAbiertos`, `casosResueltos24h/7d/30d`, `tiempoMedioResolucionMs`, `casosPorCategoria`, `tasaEscalamientoComite`.
- [ ] Definición de resuelto usa `CASO_CONFIRMADO`, `CASO_CORREGIDO`, `CASO_DADO_DE_BAJA`.
- [ ] Definición de escalado usa `CASO_ESCALADO`.
- [ ] Tiempo medio desde `OPERADOR_ASIGNADO` hasta primera acción de cierre.
- [ ] `GET /api/admin/operadores/[id]/casos` existe, pagina 25/página y filtra por estado.
- [ ] Sin PII ni texto de reporte en respuestas.
- [ ] Lógica en servicio del DAL usando repositorios existentes.

## Frontend

- [ ] Página `/dashboard/admin/operadores/[id]` renderiza cabecera, tarjetas, tablas y distribución.
- [ ] Botón "Volver a asignar" redirige a `/dashboard/admin/operadores/asignar`.
- [ ] Tabla de casos abiertos muestra RPT, categoría, estado, tiempo desde asignación.
- [ ] Tabla de historial resueltos es paginada.
- [ ] Distribución por categoría es visual simple (lista ordenada).
- [ ] `/dashboard/admin/operadores/asignar` añade botón "Ver detalle" por fila.

## Tests

- [ ] Tests de métricas con fixtures de AuditLog.
- [ ] Tests de paginación y filtro de casos.
- [ ] Test de renderizado de página con datos mock.
- [ ] Gate local verde.

## Calidad

- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run lint -- --no-cache` sin errores.
- [ ] `npm run arch:check` verde.
- [ ] Cero migraciones.
