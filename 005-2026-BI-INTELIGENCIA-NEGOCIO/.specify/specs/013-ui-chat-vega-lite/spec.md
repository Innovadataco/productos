# SPEC-013 · UI chat + Vega-Lite + feedback humano

> **Radicado:** BI · SPEC-013 · sub-fase 3 de INSTRUCTIVO-007
> **F3C:** 2026-08-28
> **Rama:** `work/bi-SPEC-011-vanna-motor` (mismo PR)
> **Depende de:** SPEC-011 spec+plan (endpoint `/api/bi/preguntar`) · SPEC-012 spec+plan (jurado devuelve `votosJurado`).
> **Sub-SPECs hermanas:** SPEC-011 · SPEC-012 · SPEC-014
> **Constitución:** aplica candados 7 (feedback humano) · 10 (plantillas) · 14 (verificación en vivo)

---

## 1. Problema

No hay UI para consumir el motor NL→SQL. Jelkin y los admins internos necesitan un chat visible en `tablero.pi.innovadataco.com/chat` que:
1. Envíe la pregunta al endpoint SPEC-011.
2. Renderice la respuesta según la plantilla determinista.
3. Permita 👍/👎 para alimentar el cache semántico (candado 7).
4. Muestre detalle de depuración (SQL · votos jurado · latencias · consultaLogId) en un panel expandible.

## 2. Objetivo

`src/app/chat/page.tsx` (Client Component) con:
- Input controlado + botón Enviar (Enter también envía).
- Historial en memoria de sesión (React state · sin persistencia entre reloads · deuda para Fase 2).
- Cada respuesta se pinta según `plantilla`:
  - `sin-datos` → párrafo gris con la razón.
  - `un-numero` → tarjeta con la cifra grande y su etiqueta.
  - `tabla` → `<TablaBI />` con paginación cliente (max 100 filas visibles).
  - `grafico` → `<GraficoVegaLite spec={graficoSpec} />` (Vega-Lite via `react-vega`).
- Panel detalle expandible con: SQL generado (highlight SQL simple · `<pre>`) · votos jurado (3 modelos · consenso) · latencias · consultaLogId (link a `/admin/consultas/{id}` futuro).
- Botones 👍 (POST `/api/bi/aprobar`) · 👎 (POST `/api/bi/rechazar`) · solo visibles cuando `usuario.rol === "ADMIN"`.
- Manejo de errores: `estado: RECHAZADO` muestra banner rojo con razón · `estado: REVISION` muestra banner amarillo "los modelos no concuerdan · aprueba una opción abajo si quieres".

## 3. Alcance

**Dentro:**

- `src/app/chat/page.tsx` — Client Component principal.
- `src/components/bi/chat/MensajeUsuario.tsx` — pregunta.
- `src/components/bi/chat/MensajeMotor.tsx` — router por plantilla.
- `src/components/bi/chat/TablaBI.tsx` — tabla básica con `<table>` HTML + paginación cliente (max 25 por página).
- `src/components/bi/chat/GraficoVegaLite.tsx` — wrapper de `react-vega` con `actions={false}`.
- `src/components/bi/chat/PanelDetalle.tsx` — expandible con `<details>` nativo.
- `src/components/bi/chat/BotonesFeedback.tsx` — 👍/👎 · POST a `/api/bi/aprobar` o `/api/bi/rechazar`.
- `src/components/bi/chat/BannerEstado.tsx` — RECHAZADO/REVISION.
- `src/lib/bi/tipos-ui.ts` — tipos UI (interfaz `MensajeChat` · `HistorialChat`).
- `src/app/api/bi/aprobar/route.ts` — POST · body `{consultaLogId}` · llama `cache-semantico.guardarAprobacion` con la pregunta y el SQL de esa consulta. Solo ADMIN.
- `src/app/api/bi/rechazar/route.ts` — POST · body `{consultaLogId, razon?}` · actualiza `bi_consulta_log.estado = REVISION_HUMANA` con la razón.
- Tests unit para cada componente (Vitest + Testing Library).
- Componentes UI base (`Button`, `Input`, `Card`) COPIADOS de `productos/002-2026-PROTECCION-INFANTIL/src/components/ui/` (D-15 de PI · mismo tokens de diseño).

**Fuera:**

- Persistencia de historial entre reloads (Fase 2 · una tabla `bi_chat_sesion` diferida).
- Múltiples sesiones concurrentes / conversación multi-turno con contexto acumulado.
- Streaming de tokens (Fase 2).
- Notificaciones push cuando llega REVISION.
- Personalización de tema · rueda oscura/clara.
- Panel admin `/admin/consultas/{id}` (deuda de mantenimiento Fase 1).

## 4. Endpoint aprobar/rechazar

`POST /api/bi/aprobar`
```json
{ "consultaLogId": "clxyz..." }
```
- Lee `bi_consulta_log` por id.
- Verifica `usuario.rol === "ADMIN"` (401 si no).
- Vectoriza la `preguntaNL` con `nomic-embed-text`.
- `cache-semantico.guardarAprobacion({preguntaNL, sql: consultaLog.sqlGenerado, aprobadoPor: usuario.id, consultaLogId, embedding})`.
- Retorna `{ok: true, cacheEntryId}`.

`POST /api/bi/rechazar`
```json
{ "consultaLogId": "...", "razon": "el sql filtra por fecha equivocada" }
```
- Actualiza `bi_consulta_log.error = razon` · `estado = "REVISION_HUMANA"`.
- Retorna `{ok: true}`.

## 5. Criterios de aceptación (compuerta §4)

- [ ] `src/app/chat/page.tsx` renderiza input + historial + panel detalle.
- [ ] Cada plantilla tiene su componente y su test de render.
- [ ] `react-vega` incluido en `package.json` (versión pinneada `>= 8 · < 9`).
- [ ] Componentes UI base copiados desde PI (no reimplementados).
- [ ] Endpoints `/api/bi/aprobar` y `/api/bi/rechazar` validan sesión ADMIN.
- [ ] Tests unit con Vitest cubren: (a) render happy path por plantilla, (b) botones feedback solo visibles para ADMIN, (c) submit envía POST correcto.
- [ ] Ratchets siguen verdes (no imports LLM · no additional-properties true · no secretos).
- [ ] `research.md` documenta: (a) por qué react-vega, (b) por qué no persistir historial en Fase 1, (c) por qué copiar componentes PI en vez de package compartido.

## 6. Riesgos

- **`react-vega` requiere Vega + Vega-Lite (bundle grande ~600 KB gzip):** aceptable en tablero interno · Fase 1 no busca métricas de bundle size.
- **Falta de auth wire-through:** hasta que exista integración auth completa (INSTRUCTIVO-009), la sesión ADMIN se determina por header/cookie stub. Documentar en `research.md` como puente.
- **`consultaLogId` como source-of-truth para aprobar:** exige que el motor SIEMPRE devuelva `consultaLogId` no-null. Verificar en test integración SPEC-014.

---

## 📋 Control del documento

| Campo | Valor |
|---|---|
| **Radicado** | BI · SPEC-013 |
| **F3C** | 2026-08-28 |
| **Autor** | BI-Dev 1 |
| **Aprobado** | pendiente REVISO Fábrica BI-2 |
| **Estado** | 🟡 spec+plan en compuerta §4 |
