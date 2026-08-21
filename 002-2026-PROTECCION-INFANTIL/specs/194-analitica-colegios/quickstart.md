# Quickstart: SPEC-194 — Analítica de Colegios + Vista Usuarios PARENT

## Requisitos previos

- Entorno levantado: Docker DB, Ollama (no se usa pero debe estar sano), app en puerto 5005.
- Usuario ADMIN creado.
- Al menos un colegio con datos: cursos, estudiantes, profesores, alertas y reportes.

## Pasos para validar tras deploy

### 1. Vista de usuarios PARENT

1. Iniciar sesión como ADMIN.
2. Navegar a `/dashboard/admin/usuarios`.
3. Verificar que el sub-tab "Padres" es el default.
4. Verificar que aparecen columnas: email, registro, último acceso, estado, reportes, colegios.
5. Probar búsqueda por email.
6. Probar filtros por estado y con/sin reportes.
7. Hacer clic en "Ver detalle" y confirmar que la ficha carga historial agregado sin texto de reportes.

### 2. Analítica de colegios — resumen

1. Navegar a `/dashboard/admin/estadisticas/operacion`.
2. Verificar que aparece el tab "Colegios".
3. Hacer clic en "Colegios".
4. Verificar que la tabla muestra: nombre, ciudad/departamento, fecha registro, estado, alumnos, profesores, reportes 30d, reportes total, alertas escaladas, % procesados, semáforo.
5. Probar ordenar por columnas.
6. Probar buscar por nombre y filtrar por ciudad/estado.
7. Medir tiempo de respuesta: debe ser < 3 s en segunda carga (caché caliente).

### 3. Ficha de colegio

1. En la tabla resumen, hacer clic en una fila.
2. Verificar que navega a `/dashboard/admin/estadisticas/operacion/colegios/[colegioId]`.
3. Verificar las 7 secciones:
   - Información básica
   - Métricas de tamaño
   - Actividad de reportes
   - Comité de Convivencia
   - Alertas
   - Hallazgos (qué está bien / qué está mal)
   - Comparación con la media
4. Verificar que no hay contenido de reportes ni datos del denunciante.

### 4. Configuración de umbrales

1. Navegar a `/dashboard/admin/configuracion`.
2. Buscar sección "Analítica → Colegios".
3. Cambiar "Días de inactividad alerta" a 10.
4. Volver a la ficha de un colegio sin reportes recientes.
5. Verificar que aparece el hallazgo "no hay reportes hace X días".

### 5. Gate de calidad

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run arch:check
npm run build
```

## Checks de PII

- En ninguna petición de `/api/admin/analytics/colegios/**` debe aparecer `texto`, `textoOriginal` ni `usuarioId` del denunciante.
- El historial de un padre solo muestra: número de seguimiento, fecha, estado, categoría.

## Rollback

- La migración solo añade índices; no requiere rollback de datos.
- Los parámetros nuevos son opcionales; si faltan, los endpoints usan defaults.
