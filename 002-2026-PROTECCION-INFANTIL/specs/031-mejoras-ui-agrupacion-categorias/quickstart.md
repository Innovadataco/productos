# Quickstart — Spec 031

## Cómo probar localmente

1. Asegurarse de que la base de datos esté migrada y con seed:
   ```bash
   npm run db:seed
   ```
2. Iniciar la app y el worker:
   ```bash
   npm run dev
   npm run worker
   ```
3. Abrir `http://localhost:5005`.

## Escenarios de prueba

### 1. Dashboard público muestra 5 grupos de categorías

- Navegar a `/dashboard-publico`.
- Verificar que el gráfico “Categorías de conducta” muestra a lo sumo 5 grupos: *Contacto sexual*, *Manipulación o engaño*, *Amenazas o extorsión*, *Contenido falso (IA)* y *Otro*.
- Verificar que no aparece el bloque “Últimos identificadores reportados”.
- Verificar que no aparece el bloque “Resumen de actividad”.
- Verificar que el bloque de ciudades muestra un mapa con círculos proporcionales a la cantidad de reportes.

### 2. Círculo de Confianza muestra 5 grupos, mapa y timeline limpio

- Iniciar sesión como usuario `PARENT`.
- Navegar a `/dashboard/circulo-confianza`.
- Agregar un contacto con identificadores que tengan reportes clasificados.
- En el detalle del contacto:
  - Verificar que las categorías se muestran agrupadas en 5 grupos (`DonutChart` o `MiniList`).
  - Verificar que las ubicaciones se muestran en el mapa (`MapaUbicaciones`), no como barras.
  - Verificar que el timeline mensual usa `BarChart` con ejes legibles.
  - Verificar que el stat box de estado dice “Verificado” (si hay reportes clasificados) o “En proceso” (si hay revisión), en tamaño reducido.

### 3. Seguimiento y mis reportes muestran “Verificado” o “En proceso”

- Crear un reporte y procesarlo hasta `CLASIFICADO`.
- Consultar `/seguimiento?numero=<numero>`.
  - Verificar que el badge dice “Verificado”.
- En `/dashboard`, sección “Mis reportes”:
  - Verificar que el badge del reporte clasificado dice “Verificado”.
- Crear un reporte en estado `PENDIENTE` o `REVISION_MANUAL`.
- Verificar que el badge dice “En proceso”.

### 4. Logout redirige a home

- Iniciar sesión.
- Cerrar sesión desde el menú desktop y desde el menú móvil.
- Verificar que la redirección final es `/` (home).

### 5. Mapa de calor con colores en dashboard público

- En `/dashboard-publico`, bloque “Reportes por ciudad / departamento”:
  - Verificar que el mapa muestra círculos con color uniforme y radio proporcional a la cantidad.
  - Verificar que no se muestran coordenadas exactas ni direcciones.

### 6. Email sin voseo

- Disparar una notificación de Círculo de Confianza (por ejemplo, creando un reporte para un identificador de un contacto activo).
- Verificar el asunto y cuerpo del email:
  - No debe contener palabras como *Ingresá*, *cambiá*, *revisá*, *Consultá*, *Tenés*.
  - Debe decir “Tienes N novedades en tu Círculo de Confianza” si son varias, o “Tienes 1 novedad en tu Círculo de Confianza” si es una.

### 7. Configuración admin (opcional)

- Iniciar sesión como `ADMIN`.
- Navegar a `/dashboard/admin/configuracion`.
- Buscar el parámetro `ui.grupos_categoria`.
- Editar el JSON (por ejemplo, cambiar el nombre de un grupo) y guardar.
- Recargar el dashboard público y verificar que el cambio se refleja.

## Comandos de validación

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npx tsx scripts/smoke-e2e.ts
```

## Validación en vivo con curl

```bash
# Estadísticas públicas con porGrupoCategoria
curl -s http://localhost:5005/api/estadisticas-publicas | jq '.porGrupoCategoria, .porCiudad[0].lat, .porCiudad[0].lng'

# Dashboard público responde 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:5005/dashboard-publico

# Círculo de Confianza requiere auth (307) o 200 con cookie
curl -s -o /dev/null -w "%{http_code}" http://localhost:5005/dashboard/circulo-confianza
```
