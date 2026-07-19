# Plan 031 — Mejoras de UI

## Fases

### 1. Spec-Kit (Tarea 3.1)

- Redactar `spec.md`, `plan.md`, `data-model.md` y `quickstart.md` en `specs/031-mejoras-ui-agrupacion-categorias/`.

### 2. Agrupación de categorías (Tarea 3.2)

- Crear `src/lib/categoria-grupos.ts` con:
  - `obtenerGruposCategoria()` (lee `ui.grupos_categoria` de `ParametroSistema` o usa fallback).
  - `categoriaAGrupo(categoriaInterna)`.
  - `agruparCategorias(items)`.
  - `nombreGrupoCategoria(claveGrupo)`.
  - `nombreGrupoParaCategoria(categoriaInterna)`.
- Crear `src/lib/categoria-grupos.test.ts` con tests de fallback, agrupación y mapeo.
- Agregar seed/upsert del parámetro `ui.grupos_categoria` en `prisma/seed.ts`.
- Aplicar en:
  - `src/app/dashboard/circulo-confianza/page.tsx` (detalle y agregado).
  - `src/components/modules/ConsultaEnriquecidaClient.tsx` (tabla de reportes).
  - `src/components/modules/SeguimientoClient.tsx` (clasificación).
  - `src/components/modules/MisReportesList.tsx` (chip de categoría).
  - `src/components/modules/PublicDashboard.tsx` (vía `porGrupoCategoria` del backend).
- Enriquecer backend `/api/estadisticas-publicas/route.ts` para devolver `porGrupoCategoria` y `porCiudad` con `lat`/`lng`.

### 3. Terminología de estados (Tarea 3.3)

- Extender `src/lib/reporte-estados-usuario.ts`:
  - Cambiar `mapEstadoUsuario` para que `CLASIFICADO`/`CORREGIDO` → `Verificado`.
  - Cambiar todos los demás estados a `En proceso` (incluyendo `DUPLICADO` si aplica).
  - Agregar `formatEstadoUsuario(estado)` y `formatEstadoCirculo(estado)`.
- Actualizar mensajes de estado si es necesario.
- Ajustar `src/lib/reporte-estados-usuario.test.ts` y tests de API (`seguimiento`, `mis-reportes`) a los nuevos textos.
- Aplicar `formatEstadoCirculo` en el Círculo de Confianza.

### 4. UI del Círculo de Confianza (Tarea 3.4)

- En `src/app/dashboard/circulo-confianza/page.tsx`:
  - Reemplazar lista de categorías por `DonutChart` o `MiniList` con los 5 grupos.
  - Reemplazar barras de ubicaciones por `MapaUbicaciones` (import dinámico).
  - Mejorar timeline mensual con `BarChart` limpio.
  - Reducir stat box de estado y usar “Verificado” / “En proceso” / “Sin reportes”.
  - Corregir voseos en textos visibles.

### 5. Notificaciones y emails (Tarea 3.5)

- En `src/lib/circulo-confianza.ts`:
  - Refactorizar `notificarCambioCirculoSiCorresponde` para contar novedades por usuario en la ventana actual.
  - Llamar `enviarAlertaCirculoConfianza(email, cantidad)`.
- En `src/lib/email.ts`:
  - Ajustar `enviarAlertaCirculoConfianza(email, cantidad)` para asunto y cuerpo con cantidad.
  - Corregir todos los voseos: `Ingresá` → `Ingresa`, `cambiá` → `cambia`, `revisá` → `revisa`, `Consultá` → `Consulta`, `Tenés` → `Tienes`, etc.
- Actualizar `src/lib/circulo-confianza.test.ts` para validar la cantidad de novedades y el nuevo texto.

### 6. Dashboard público (Tarea 3.6)

- En `src/app/api/estadisticas-publicas/route.ts`:
  - Agregar `porGrupoCategoria` agrupado con los 5 grupos.
  - Agregar `lat`/`lng` a `porCiudad`.
  - Eliminar `ultimosIdentificadores` de la respuesta.
- En `src/components/modules/PublicDashboard.tsx`:
  - Quitar bloques de “Últimos identificadores reportados” y “Resumen de actividad”.
  - Reemplazar barras por ciudad con `MapaUbicaciones` (import dinámico).
  - Usar `porGrupoCategoria` en el `DonutChart` de categorías.
- Actualizar `src/app/api/estadisticas-publicas/route.test.ts`.

### 7. Bug logout (Tarea 3.7)

- En `src/components/modules/NavHeader.tsx` cambiar ambas redirecciones de `window.location.href = "/login"` a `window.location.href = "/"` (desktop y móvil).

### 8. Validación, despliegue y cierre (Tarea 3.8)

- Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build`, `npx tsx scripts/smoke-e2e.ts`.
- Desplegar en `:5005` con rebuild limpio (`rm -rf .next && npm run build`).
- Commits separados por punto lógico y push a `feature/001-scaffolding`.
- Escribir `specs/031-mejoras-ui-agrupacion-categorias/cierre.md`.

## Dependencias

- `src/lib/labels.ts` y `src/lib/reporte-estados-usuario.ts` para etiquetas.
- `src/lib/parametros.ts` para leer/escribir `ui.grupos_categoria`.
- Componentes del design system: `GlassCard`, `Button`, `Input`, `Badge`, `MetricCard`, `ChartCard`, `MiniList`, `BarChart`, `DonutChart`, `RiskBadge`, `MapaUbicaciones`.
- `MapaUbicaciones` usa `react-leaflet` (ya dependencia del proyecto).

## Riesgos y mitigaciones

- **Tests rotos por cambio de textos**: actualizar los tests de estados y emails.
- **Tipos de Prisma Client**: no se modifica el schema, solo se agrega un parámetro; sin riesgo.
- **Mapa sin datos**: `MapaUbicaciones` ya maneja el caso vacío con un mensaje.
- **JSON malformado en `ui.grupos_categoria`**: el helper valida y cae al fallback hardcodeado.
