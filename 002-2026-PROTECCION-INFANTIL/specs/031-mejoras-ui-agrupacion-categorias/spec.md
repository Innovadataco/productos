# Spec 031 — Mejoras de UI: agrupación de categorías, terminología, círculo de confianza, dashboard público, notificaciones y logout

> **Status**: CERRADA.

## Objetivo

Mejorar la experiencia de usuario final del producto Protección Infantil agrupando las 12 categorías internas de conducta en 5 grupos comprensibles, simplificando la terminología de estados, enriqueciendo la UI del Círculo de Confianza, saneando los textos de los emails, rediseñando el dashboard público y corrigiendo el logout.

## Problema que resuelve

- Los usuarios finales ven 12 categorías técnicas que dificultan la lectura de riesgos.
- Los estados internos del reporte (`CLASIFICADO`, `CORREGIDO`, `PENDIENTE`, etc.) no son claros para padres/madres.
- El detalle del Círculo de Confianza muestra barras por ciudad en lugar de un mapa y usa un stat box de estado demasiado grande.
- Los emails contienen voseo, inconsistente con el tono neutral formal del producto.
- El dashboard público muestra bloques que exponen identificadores o duplican KPIs.
- El logout redirige a `/login` en lugar del home.

## Alcance

1. **Agrupación de categorías (5 grupos, parametrizable)**
   - Definir 5 grupos de presentación para las 12 categorías internas de `CategoriaConducta`.
   - Almacenar la configuración en `ParametroSistema` con clave `ui.grupos_categoria` (JSON).
   - Crear helper `src/lib/categoria-grupos.ts`.
   - Aplicar el helper en Círculo de Confianza, consulta pública/enriquecida, panel de usuario, seguimiento y dashboard público.
2. **Terminología de estados**
   - `CLASIFICADO` / `CORREGIDO` → “Verificado”.
   - Todo lo demás → “En proceso”.
   - Extender `src/lib/reporte-estados-usuario.ts` y crear `formatEstadoUsuario` / `formatEstadoCirculo`.
3. **UI del Círculo de Confianza**
   - Categorías agrupadas con `DonutChart` / `MiniList`.
   - Ubicaciones con `MapaUbicaciones` a nivel ciudad (coordenadas aproximadas, sin direcciones exactas).
   - Timeline mensual más limpio con `BarChart`.
   - Reducir tamaño del stat box de estado y usar “Verificado”.
4. **Notificaciones y emails**
   - Contar novedades por usuario antes de enviar la alerta del Círculo de Confianza.
   - `enviarAlertaCirculoConfianza(email, cantidad)` con asunto y cuerpo que reflejen la cantidad.
   - Eliminar todo voseo en `src/lib/email.ts`.
5. **Dashboard público**
   - Quitar bloques “Últimos identificadores reportados” y “Resumen de actividad”.
   - Reemplazar barras por ciudad con mapa de calor visual (`MapaUbicaciones` con `CircleMarker` proporcional).
   - Categorías agrupadas en `DonutChart` con los 5 grupos.
6. **Bug logout**
   - Redirigir a `/` tanto en desktop como en móvil.

## Fuera de alcance

- No se modifica el pipeline de clasificación IA (R7).
- No se modifica el enum `CategoriaConducta` ni el eval.
- No se agregan dependencias nuevas.
- No se altera la lógica de scoring, ranking o visibilidad pública.

## Decisiones de diseño

- **Agrupación parametrizable**: se usa `ParametroSistema` con clave `ui.grupos_categoria` en lugar de una tabla nueva. Es más simple, no requiere migración y aprovecha el CRUD de parámetros existente en `/dashboard/admin/configuracion`. El helper tiene una definición por defecto (los 5 grupos) que se usa si el parámetro no existe o está malformado.
- **Estados**: se centraliza el mapeo en `src/lib/reporte-estados-usuario.ts` y se reutiliza en las vistas de usuario final.
- **Mapa de calor**: se usa `MapaUbicaciones` con `CircleMarker` de radio proporcional a la cantidad de reportes. El backend enriquece `porCiudad` con `lat`/`lng` aproximados de la tabla `Ciudad`, evitando exponer coordenadas exactas.
- **Notificaciones**: la función `notificarCambioCirculoSiCorresponde` ahora agrupa contactos por usuario, cuenta los identificadores con novedades en la ventana actual y envía un único email con la cantidad, respetando el cooldown.

## Criterios de aceptación

1. `/api/estadisticas-publicas` devuelve `porGrupoCategoria` con los 5 grupos.
2. `/api/estadisticas-publicas` devuelve `porCiudad` con `lat`/`lng`.
3. El dashboard público no muestra “Últimos identificadores reportados” ni “Resumen de actividad”.
4. El Círculo de Confianza muestra categorías agrupadas, mapa de ubicaciones y timeline limpio.
5. Seguimiento, mis reportes y Círculo de Confianza muestran “Verificado” o “En proceso”.
6. Los emails de `src/lib/email.ts` no contienen voseo.
7. El logout redirige a `/`.
8. Todos los tests pasan, `lint`, `tsc`, `build` y el smoke E2E son exitosos.
