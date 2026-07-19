# Cierre — Spec 029: Rediseño de la consulta pública + panel del usuario autenticado

## Estado
**CERRADA** — implementada, verificada y desplegada en `feature/001-scaffolding`.

## Qué se implementó

### Nivel 1 — Consulta pública (`/consulta`)
- Badge de nivel de riesgo (bajo/medio/alto) con color semafórico.
- Porcentaje promedio de confianza de la IA sobre reportes clasificados.
- Cantidad de reportes visibles, desglose autenticados/anónimos y fecha del último reporte.
- Resumen de plataformas usando `formatPlataformasResumen`, sin mostrar `undefined`.
- Bloque de llamada a la acción "Crear una cuenta".
- Se mantiene la regla de privacidad: no se expone texto del reporte ni identidad del denunciante.

### Nivel 2 — Panel del usuario autenticado (`/dashboard`)
- Sección "Mis reportes": lista de reportes creados por el usuario con estado y código de seguimiento.
- Consulta enriquecida: busca cualquier identificador y muestra detalle agregado.
- Mapa de ubicaciones aproximadas a nivel ciudad (sin coordenadas exactas).
- Lista de reportes del identificador con plataforma, fecha, categoría y nivel de riesgo.
- No se muestra el texto del reporte ni quién reportó.

### Backend
- `src/lib/riesgo-consulta.ts`: cálculo de riesgo conservador para consultas públicas, con umbrales parametrizables en `ParametroSistema`.
- `src/app/api/consulta/route.ts`: extendido para incluir `nivelRiesgo`, `confianzaPromedio` y `resumenPlataformas`.
- `src/app/api/consulta/detalle/route.ts`: nuevo endpoint para usuarios autenticados (`PARENT`).

### Bugs corregidos (Tarea 1)
- `ConsultaPublicaClient.tsx`: detecta sesión activa vía `useAuth`. Si el usuario es `PARENT`, oculta el CTA "Crear una cuenta" y muestra "Ver detalle completo" con acceso directo al dashboard.
- `MisReportesList.tsx`: las tarjetas de reporte ahora son clickeables (role="button", cursor-pointer, foco visible) y abren la ruta de seguimiento `/seguimiento?numero=...`.
- `ConsultaEnriquecidaClient.tsx`: verificado de punta a punta; el mapa muestra ubicaciones aproximadas a nivel ciudad (coordenadas de ciudad, no direcciones exactas) con zoom adecuado.

## Archivos tocados/creados

### Spec-Kit
- `specs/029-redisenio-consulta-panel-usuario/spec.md`
- `specs/029-redisenio-consulta-panel-usuario/plan.md`
- `specs/029-redisenio-consulta-panel-usuario/data-model.md`
- `specs/029-redisenio-consulta-panel-usuario/quickstart.md`
- `specs/029-redisenio-consulta-panel-usuario/contracts/consulta.md`
- `specs/029-redisenio-consulta-panel-usuario/cierre.md` (este archivo)

### Backend
- `src/lib/riesgo-consulta.ts` (nuevo)
- `src/lib/riesgo-consulta.test.ts` (nuevo)
- `src/app/api/consulta/route.ts`
- `src/app/api/consulta/route.test.ts`
- `src/app/api/consulta/detalle/route.ts` (nuevo)
- `src/app/api/consulta/detalle/route.test.ts` (nuevo)
- `src/lib/reporte-test-utils.ts`

### Frontend
- `src/components/modules/ConsultaPublicaClient.tsx`
- `src/components/modules/ConsultaPublicaClient.test.tsx`
- `src/components/modules/ConsultaEnriquecidaClient.tsx` (nuevo)
- `src/components/modules/ConsultaEnriquecidaClient.test.tsx` (nuevo)
- `src/components/modules/MisReportesList.tsx`
- `src/components/modules/DashboardUsuarioClient.tsx` (nuevo)
- `src/app/dashboard/page.tsx`

## Resultados de verificación

### Checks automatizados
- `npm run lint`: ✅ verde (1 warning preexistente en `src/lib/sms.ts`).
- `npx tsc --noEmit`: ✅ verde.
- `npm run build`: ✅ verde.
- `npm test`: ✅ 367 tests en 72 archivos, todos verdes.
- `npx tsx scripts/smoke-e2e.ts`: ✅ verde.

### Validación en vivo (desplegado en `:5005` con rebuild limpio)
- App y worker reiniciados con build nueva (`rm -rf .next && npm run build`).
- Consulta pública `/api/consulta?identificador=...` responde 200 con nivel de riesgo, confianza y resumen de plataformas sin `undefined`.
- Consulta enriquecida `/api/consulta/detalle?identificador=...` con cookie de usuario `PARENT` responde 200 con ubicaciones aproximadas y reportes agregados.
- Endpoints autenticados (`/api/consulta`, `/api/consulta/detalle`, `/api/reportes/mis-reportes`) responden 200 con sesión `PARENT`.
- Páginas `/consulta` (200) y `/dashboard` (307 para anónimo) responden correctamente.

## Git

```
4b24ad3 fix(029): corrige bugs de consulta pública y panel autenticado
2eb59eb docs(029): cierre de spec con resultado de tests, despliegue y validación en vivo
bff6c0a feat(029): rediseño consulta pública + panel usuario con riesgo, confianza y consulta enriquecida
```

Push a `feature/001-scaffolding` realizado.

## Decisiones y notas

- No se tocó el Círculo de Confianza (spec 016) ni su navegación.
- El cálculo de riesgo de consulta es independiente del scoring interno de admin.
- Los umbrales de riesgo (`risk.umbral_medio`, `risk.umbral_alto`, `risk.min_reportes_alto`) son parametrizables desde `ParametroSistema` y se inicializan en `reporte-test-utils.ts` para tests.

## R7 (pipeline de clasificación)
No se modificó el pipeline de clasificación IA. Solo se agregó un cálculo de riesgo derivado de las clasificaciones ya existentes.
