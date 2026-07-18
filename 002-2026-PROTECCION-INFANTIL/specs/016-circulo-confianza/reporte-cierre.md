# Reporte de cierre — Spec 016: Círculo de Confianza

**Estado:** CERRADA  
**Fecha de cierre:** 2026-07-18  
**Spec:** [`spec.md`](spec.md) · **Plan:** [`plan.md`](plan.md) · **Diseño:** [`diseno.md`](diseno.md) · **Tareas:** [`tasks.md`](tasks.md)

## Resumen

Se implementó el Círculo de Confianza: una sección dentro del panel de usuarios autenticados donde pueden registrar identificadores de personas cercanas a sus hijos, ver el estado de reportes de cada contacto y consultar una vista agregada de sus contactos. No agrega capas de confirmación ni reglas de visibilidad nuevas: muestra exactamente lo que la consulta pública ya expone, organizado por contacto.

## Alcance implementado

1. **Gestión de contactos** (`src/app/api/circulo-confianza/route.ts`, `src/app/api/circulo-confianza/[id]/route.ts`)
   - Alta con identificador + etiqueta + plataforma.
   - Edición de etiqueta.
   - Inhabilitación soft (no borrado destructivo).
   - Tope de contactos activos parametrizable (`circulo.max_contactos`).

2. **Estado por contacto** (`src/lib/circulo-confianza.ts::determinarEstadoContacto`)
   - `sinReportes`, `enRevision`, `clasificado`.
   - Detalle con reportes, plataformas, categorías, ubicaciones y línea de tiempo.
   - Respeta los mismos estados visibles que la consulta pública (`CLASIFICADO`, `CORREGIDO`, `REVISION_MANUAL`, `POSIBLE_SPAM`, `REQUIERE_ANONIMIZACION`).

3. **Vista agregada de mi círculo** (`src/lib/circulo-confianza.ts::obtenerVistaAgregada`)
   - Conteos por país, ciudad, categoría y mes.
   - Umbral de agregación configurable (`circulo.umbral_agregacion`): ≥2 contactos con reportes o ≥3 reportes por defecto.
   - Si no alcanza el umbral se informa sin mostrar datos desagregados.
   - Enlace separado al dashboard público general para panorama nacional.

4. **Notificación ciega por email** (`src/lib/circulo-confianza.ts::notificarCambioCirculoSiCorresponde`)
   - Mensaje genérico: "Hay novedades en tu Círculo de Confianza. Ingresá para revisar."
   - Sin identificador, etiqueta, categoría, fecha ni ciudad.
   - Cooldown configurable (`circulo.notificaciones.cooldown_horas`, default 24h).
   - Toggle on/off en preferencias del usuario, default ON.

5. **UI** (`src/app/dashboard/circulo-confianza/page.tsx`)
   - Resumen arriba (sin reportes / en revisión / clasificado).
   - Listado de contactos con acciones.
   - Panel de detalle por contacto.
   - Panel de vista agregada con gráficos.
   - Toggle de notificaciones.

## Decisiones del owner aplicadas

| Tema | Decisión | Dónde quedó |
|------|----------|-------------|
| Umbral de agregación | ≥2 contactos con reportes o ≥3 reportes, configurable | `circulo.umbral_agregacion` en `ParametroSistema` |
| Cooldown de notificación | 24h, configurable | `circulo.notificaciones.cooldown_horas` |
| Tope de contactos | 20 activos por defecto, configurable | `circulo.max_contactos` |
| Cupo del tope | Cuenta contactos activos; inhabilitados no ocupan cupo | `contarContactosActivos` + validación en `agregarContacto` |
| Auditoría | Registra totales/histórico (agregar, inhabilitar, editar) | `AuditLog` con acciones `CIRCULO_CONTACT_*` |
| Notificación email | Toggle simple on/off, default ON | campo `usuario.notificacionesCirculo` |

## Reutilización vs. creación nueva

### Reutilizado

- **Sistema de parámetros:** `ParametroSistema` + `getParametroSistemaValor` para `circulo.max_contactos`, `circulo.umbral_agregacion`, `circulo.notificaciones.enabled`, `circulo.notificaciones.cooldown_horas`. Configurables desde la UI de administración existente.
- **Componentes visuales del dashboard público:**
  - `MetricCard` para el resumen superior.
  - `MiniList` para listados compactos.
  - `ChartCard`, `BarChart`, `DonutChart` para la vista agregada.
- **Patrón de notificación email:** función `enviarAlertaCirculoConfianza` agregada en `src/lib/email.ts`, siguiendo el mismo transporte/template base que las alertas existentes.
- **AuditLog:** `logAudit` con nuevas acciones `CIRCULO_CONTACT_CREATE`, `CIRCULO_CONTACT_UPDATE`, `CIRCULO_CONTACT_DISABLE`.
- **Rate-limit:** reutilizado en la API de alta (`src/app/api/circulo-confianza/route.ts`) vía `rateLimit` existente.
- **Reglas de visibilidad:** `determinarEstadoContacto` usa los mismos estados visibles que la consulta pública (`src/app/api/consulta/route.ts`). No inventa nuevos filtros.
- **Modelo de datos base:** `Usuario`, `Plataforma`, `Reporte`, `ClasificacionIA` existentes.

### Creado nuevo

- Modelo `ContactoConfianza` en `prisma/schema.prisma`.
- Campos `notificacionesCirculo` y `ultimaNotificacionCirculoEn` en `Usuario`.
- Librería `src/lib/circulo-confianza.ts` y sus tests `src/lib/circulo-confianza.test.ts`.
- Endpoints REST bajo `src/app/api/circulo-confianza/` y sus tests.
- Página `src/app/dashboard/circulo-confianza/page.tsx`.
- Función de email `enviarAlertaCirculoConfianza` en `src/lib/email.ts`.
- Seed de parámetros en `prisma/seed.ts`.

## Blindaje anti-abuso

| Riesgo | Mitigación implementada |
|--------|------------------------|
| Tope de contactos | `circulo.max_contactos`, ajustable sin deploy. Cuenta solo activos. |
| Auto-vigilancia / scraping | `AuditLog` registra usuario + identificador + timestamp en cada alta/édición/inhabilitación. La auditoría es sobre totales/histórico, por lo que el patrón agregar-borrar en bucle queda trazado. |
| Rate-limit en alta | Aplicado en `POST /api/circulo-confianza` con el rate-limiter existente. |
| Re-notificación masiva | Cooldown de 24h por usuario + verificación de cambio real del reporte. |
| Inferencia por resta | Umbral de agregación configurable: no se muestra el mapa/desglose agregado hasta ≥2 contactos con reportes o ≥3 reportes. |

## Análisis de amenaza resuelto

Ver [`diseno.md`](diseno.md) para el análisis completo. Los dos renglones críticos quedaron resueltos:

- **Agresor que se agrega a sí mismo al círculo:** no obtiene nada que no tenga ya en la consulta pública. El email es ciego, el detalle exige login y el estado refleja la misma información pública.
- **Inferencia por resta con círculo pequeño:** mitigada con umbral de agregación configurable. Mientras no se supere el umbral, la vista agregada no expone mapa ni desglose geográfico/categórico.

## R7 — Pipeline de clasificación

**No aplica.** Esta spec no modifica el modelo, prompt, votos, umbrales ni cola de clasificación del motor IA. Solo consume reportes ya clasificados/revisados por el sistema existente.

## Verificaciones de cierre

| Check | Resultado |
|-------|-----------|
| `npm run lint` | ✅ 0 errores (1 warning preexistente en `src/lib/sms.ts`) |
| `npx tsc --noEmit` | ✅ sin errores |
| `npm run build` | ✅ build de producción exitosa |
| `npm test` | ✅ 210 tests passed |
| `node --env-file=.env --import tsx scripts/smoke-e2e.ts` | ✅ smoke E2E pasó |

## Archivos principales

- `prisma/schema.prisma` — modelo `ContactoConfianza` y campos en `Usuario`.
- `prisma/seed.ts` — parámetros `circulo.*`.
- `src/lib/circulo-confianza.ts` — lógica de negocio.
- `src/lib/circulo-confianza.test.ts` — tests unitarios.
- `src/lib/email.ts` — notificación ciega.
- `src/app/api/circulo-confianza/route.ts` — CRUD contactos.
- `src/app/api/circulo-confianza/[id]/route.ts` — actualización/inhabilitación.
- `src/app/api/circulo-confianza/agregado/route.ts` — vista agregada.
- `src/app/api/circulo-confianza/preferencias/route.ts` — toggle de notificaciones.
- `src/app/api/circulo-confianza/route.test.ts` — tests de API.
- `src/app/dashboard/circulo-confianza/page.tsx` — UI del usuario.

## Notas para mantenimiento futuro

- Los parámetros `circulo.*` se administran desde el panel de configuración existente; no hace falta deploy para ajustar tope, umbral o cooldown.
- El hook de notificación (`notificarCambioCirculoSiCorresponde`) debe llamarse desde los puntos donde un reporte cambia de estado visible: ya se invoca desde el flujo de resolución de apelaciones y correcciones; revisar cuando se agreguen nuevos cambios de estado de reportes.
