# SPEC-013 · plan.md · UI chat + Vega-Lite

## Orden de implementación

### Capa 0 · Dependencias
- `npm install --save react-vega vega vega-lite` (versiones ~8 · 5 · 5).
- Verificar bundle final con `next build` en gate local.

### Capa 1 · Componentes UI base (copia de PI)
- Copiar sin modificaciones semánticas:
  - `src/components/ui/button.tsx` (de PI)
  - `src/components/ui/input.tsx`
  - `src/components/ui/card.tsx`
  - `src/components/ui/badge.tsx`
- Ajustar imports si el path alias cambia.

### Capa 2 · Tipos UI
- `src/lib/bi/tipos-ui.ts`:
  ```ts
  export type MensajeChat =
    | { rol: "usuario"; texto: string; timestamp: number }
    | { rol: "motor"; respuesta: RespuestaMotor; timestamp: number };
  export type HistorialChat = MensajeChat[];
  ```

### Capa 3 · Componentes de plantilla
- `MensajeUsuario.tsx` · burbuja derecha, gris.
- `MensajeMotor.tsx` · router por `respuesta.plantilla`:
  ```tsx
  {plantilla === "sin-datos" && <ParrafoInfo texto={respuestaNarrativa} />}
  {plantilla === "un-numero" && <TarjetaNumero valor={filas[0]} narrativa={respuestaNarrativa} />}
  {plantilla === "tabla" && <TablaBI filas={filas} />}
  {plantilla === "grafico" && <GraficoVegaLite spec={graficoSpec} />}
  ```
- `TablaBI.tsx` · paginación cliente 25/pág · sin sorting (Fase 1 mínima).
- `GraficoVegaLite.tsx` · `<Vega spec={spec} actions={false} />`.
- `PanelDetalle.tsx` · `<details><summary>SQL · Jurado · Latencias</summary>...</details>`.

### Capa 4 · Banner estado + botones feedback
- `BannerEstado.tsx` · color por estado (verde OK · amarillo REVISION · rojo RECHAZADO).
- `BotonesFeedback.tsx`:
  - Solo renderiza si `usuario.rol === "ADMIN"` (pasar `usuario` como prop desde page).
  - `<button onClick={() => fetch("/api/bi/aprobar", {method: "POST", body: JSON.stringify({consultaLogId})})}>`.
  - Estado local: pendiente · aprobado · rechazado (indicador visual).

### Capa 5 · `page.tsx`
- Client Component con `"use client"`.
- Estado: `historial`, `preguntaEnCurso`, `cargando`.
- `handleSubmit` → POST `/api/bi/preguntar` → agregar mensaje motor al historial.
- Manejo de error de red: banner rojo local + item en historial.

### Capa 6 · Endpoints aprobar/rechazar
- `src/app/api/bi/aprobar/route.ts`:
  - Zod validar `{consultaLogId}`.
  - `prisma.bIConsultaLog.findUnique({where: {id: consultaLogId}})` → si null 404.
  - Si `sqlGenerado` null → 400 "consulta sin SQL para aprobar".
  - `embedding = await vectorizar(consultaLog.preguntaNL)`.
  - `cache-semantico.guardarAprobacion({...})`.
  - Retornar `{ok: true, cacheEntryId}`.
- `src/app/api/bi/rechazar/route.ts`:
  - Zod validar `{consultaLogId, razon?}`.
  - `prisma.bIConsultaLog.update({where: {id: consultaLogId}, data: {estado: "REVISION_HUMANA", error: razon ?? "sin_razon"}})`.
  - Retornar `{ok: true}`.

### Capa 7 · Tests unit
- Vitest + `@testing-library/react` (agregar al package si falta).
- Cada componente: happy path + edge (sin datos · vega spec vacío · botones sin rol admin).
- Endpoints aprobar/rechazar: mock Prisma · 4 casos.

### Capa 8 · Verificación en vivo (candado 14 · deferida a SPEC-014)
- La verificación real end-to-end con `curl` + navegador vive en SPEC-014.

## Env vars nuevas

- Ninguna (aprobar/rechazar reutilizan `OLLAMA_BASE_URL` de SPEC-011 para embedding).

## Gate LOCAL

```bash
rm -rf .next
npm run build
npm run test:unit -- src/components/bi src/app/api/bi
npm run lint
```

## Compuerta §4

Commit spec+plan → REVISO → implementación.
