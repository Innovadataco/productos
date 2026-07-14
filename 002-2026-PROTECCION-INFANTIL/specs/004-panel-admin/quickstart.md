# Quickstart — Panel de Administración

## Escenario A: Acceder al panel como admin

**Prerrequisitos**: Usuario con rol ADMIN existe y está autenticado.

1. Navegar a `/dashboard/admin`
2. Verificar redirección automática si no es ADMIN
3. Confirmar que se muestra la bandeja de reportes por defecto

**Validación**: `GET /api/me` retorna `rol: "ADMIN"`; layout no redirige.

---

## Escenario B: Filtrar reportes pendientes de anonimización

1. En la bandeja, seleccionar filtro `estado = REQUIERE_ANONIMIZACION`
2. Verificar que la lista solo muestra reportes en ese estado
3. Hacer clic en "Ver detalle" del primero
4. Confirmar que se muestra `textoOriginal` con PII

**Validación**: `GET /api/admin/reportes-revision?estado=REQUIERE_ANONIMIZACION` retorna items con ese estado.

---

## Escenario C: Corregir clasificación de un reporte

1. Abrir detalle de un reporte clasificado
2. Seleccionar categoría diferente en el dropdown
3. Opcional: escribir motivo
4. Confirmar corrección
5. Verificar que el detalle ahora muestra la categoría corregida

**Validación**: `POST /api/admin/correcciones` retorna 201; `GET /api/admin/reportes-revision/[id]` muestra `correccion` no nulo.

---

## Escenario D: Anonimizar reporte con PII

1. Filtrar por `REQUIERE_ANONIMIZACION`
2. Abrir detalle de un reporte
3. Ver `textoOriginal` con PII (nombre de menor, colegio)
4. Escribir texto anonimizado (eliminar nombres propios)
5. Confirmar anonimización
6. Verificar estado cambia a `CLASIFICADO`

**Validación**: `PATCH /api/admin/reportes/[id]/anonimizar` retorna 200; BD: `estado=CLASIFICADO`, `textoOriginal` preservado, `texto` = versión anonimizada.

---

## Escenario E: Verificar que PII no se expone públicamente

1. Anonimizar un reporte (Escenario D)
2. Consultar `GET /api/consulta?identificador=...&plataforma=...`
3. Verificar que el conteo aumentó pero no se expone `textoOriginal`

**Validación**: Respuesta de consulta pública no incluye campo `textoOriginal`.

---

## Escenario F: Dashboard con métricas reales

1. Abrir `/dashboard/admin/estadisticas`
2. Verificar tarjetas de totales (reportes, hoy, pendientes)
3. Confirmar gráficos de distribución por estado, categoría, plataforma
4. Verificar tendencia de últimos 30 días

**Validación**: `GET /api/admin/estadisticas` retorna objeto consolidado; suma de `porEstado.count` = `totales.reportes`.

---

## Escenario G: Acceso denegado a no-admin

1. Iniciar sesión como usuario con rol PARENT
2. Intentar navegar a `/dashboard/admin`
3. Verificar redirección a `/` o mensaje de acceso denegado
4. Intentar `GET /api/admin/estadisticas` directamente
5. Verificar 403

**Validación**: Todas las rutas `/api/admin/**` retornan 403 para non-ADMIN.