# Contratos · SPEC-340 · el hilo

Códigos canónicos de `AppError`; sin trazas al cliente. Todas las rutas del padre exigen rol PARENT y pasan por los guardianes de A-67.

## Nuevas

### `GET /api/padre/reportes/cadenas`
Tarjetas de Mis reportes: una entrada por cadena. `{ cadenas: [{ reportePrincipalId, identificador, plataforma, clasificacionDominante, cantidadEventos, ultimoEventoEn, expedienteId | null, eventos: [{id, fechaIncidente, clasificacion, textoDisponible}], otrosReportes: {...FR-009} | null }] }`. **El texto NUNCA viaja en el listado** — solo `textoDisponible` (research R-4).

### `POST /api/reportes/[id]/evento`
Agrega un evento a la cadena del reporte `[id]` (del padre autenticado). **Entrada**: `{ texto, fechaIncidente }` (con hora) — nada más: nick, país, ciudad y edad se HEREDAN del principal en servidor. **Errores**: `404` no es su reporte · `400` datos inválidos. Reusa la vinculación existente (advisory lock, no-duplicación #202).

### `POST /api/padre/expedientes`
El botón «Crear expediente». **Entrada**: `{ reportePrincipalId }`. Crea con `origenCreacion: "PADRE"`; si la cadena ya tiene expediente → `200` con el existente (idempotente — dos toques no crean dos). `404` si el reporte no es suyo.

### `GET /api/padre/reportes/[id]/texto`
Entrega el texto propio SOLO si: sesión joven (< M min) **o** sello de step-up fresco. Si no → `403` con `code: "STEP_UP_REQUERIDO"`. Es la única vía por la que el texto viaja (el listado nunca lo incluye).

### `POST /api/padre/step-up`
**Entrada**: `{ password }`. Verifica contra el hash del usuario con el MISMO contador global de intentos del login. Correcta → cookie firmada `stepup_sello` (vida M min) + `204`. Errada → `401` con mensaje sereno; el contador global decide el bloqueo.

### `GET /api/padre/expedientes/[id]/lectura`
La capa 1: `{ hechos: n, propios, ajenos, anonimos, franjas: [...], escalada: {...}|null, aceleracion: {...}|null, alcance, perfil, ciudades: [{ciudad, conteo}], masReciente: {...} }`. Todo cifras; cero frases interpretativas.

## Cambiadas

### `GET /api/padre/expedientes/[id]/pdf`
Además de generar: estampa pie (fecha/hora Bogotá + código + URL pública), calcula hash canónico, registra `InformePadre` (número secuencial siguiente) y `AuditLog`. La descarga repetida NO re-registra si no se re-genera (cada GET = una generación = un registro; es el contrato del brief: cada generación queda auditada).

### `GET /api/padre/expedientes/[id]` (detalle)
Suma: `informesGenerados: [{numero, generadoEn, codigoVerificacion}]` y los datos del mapa/timeline con la marca mío/autenticado/anónimo.

### `GET /api/publico/verificar-pdf/[hash]`
Busca en `InformeConsolidado` **y** en `InformePadre`. Respuesta idéntica en forma para ambas fuentes; hash desconocido → mismo «no verifica» de hoy.

### `POST /api/reportes` (alta)
- Acepta y valida `fechaIncidente` con hora.
- **Se retira** la creación de expediente de la transacción de vinculación (D-4/R-1). Todo lo demás de la vinculación queda intacto.

## Eliminado de UI (sin cambio de API)

- Letrero «Reportando como…» (`ReporteWizard`).
- CTA «Reportar de nuevo a este identificador» (`SeguimientoClient`) — la ruta de datos de seguimiento no cambia.

## Guardianes

Ninguna ruta nueva entra a listas públicas; todas viven detrás de sesión + camino de A-67. `verificar-pdf` ya es pública con rate-limit propio y así se queda.
