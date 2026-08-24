# Investigación — SPEC-232

## Fuentes revisadas

- `INSTRUCTIVO-002-PI-132-VISTA-PADRE-EXPEDIENTES.md`
- `BRIEF-MODULO-PADRE-v2-EXPEDIENTE.md` §11.1 (vista padre expedientes), §7.1-7.2 (modelos), §11.2 (búsqueda por identificador — SPEC-233)
- `src/lib/dal/repositories/expediente-repository.ts` — API del repository
- `src/app/dashboard/padre/layout.tsx` — layout heredado de SPEC-231
- `src/components/modules/padre/PlaceholderPadre.tsx` — placeholder a reemplazar
- `src/components/ui/GlassCard.tsx`, `Cargando.tsx`, `ErrorState.tsx`

## Decisiones técnicas

### 1. Server vs Client Components
La lista y el detalle serán Server Components que fetchean datos vía DAL. Los filtros y el formulario de agregar evento serán Client Components para interactividad sin recargar.

### 2. Endpoint de agregar evento
Se crea `POST /api/padre/expedientes/[id]/eventos` (no se reutiliza endpoint genérico de reportes) porque la lógica es específica del agregado Expediente: validar pertenencia, rechazar cerrados, crear EventoExpediente + Reporte en una transacción.

### 3. AutoSuggest N3
Se implementa como una card en la parte superior de la lista de expedientes (y opcionalmente en `/dashboard/padre`), no como modal. Menos invasivo y respeta el patrón "motivar a la acción" sin interrumpir.

### 4. Botón "Ya se resolvió"
Placeholder visual. La consolidación real (cambio de estado, generación de informe) se implementa en SPEC-234/236.

### 5. Timezone
Se usa `date-fns-tz` con `America/Bogota` para "días desde última actividad" y formateo de fechas, siguiendo D-69.

## Alternativas consideradas

| Alternativa | Descartada por |
|---|---|
| Reutilizar `POST /api/reportes` para crear el reporte del evento | No maneja la transacción Expediente+Evento+Reporte ni la pertenencia del expediente. |
| Modal para agregar evento | Añade complejidad de estado global; mejor inline o página dedicada en v1. |
| AutoSuggest como modal bloqueante | Muy invasivo para el padre; mejor card persistente. |
