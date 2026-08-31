# Implementation Plan: El expediente del padre · NÚCLEO (SPEC-323)

**Branch**: `work/pi-SPEC-323-expediente-padre-nucleo` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Radicado**: 002-PI-223 · SPEC-323

## Summary

Corrige dos incidencias críticas: (1) `crearExpediente` nunca se llama — el expediente no nace; (2) el 2.º reporte del mismo identificador por el mismo padre se rechaza con 429 en lugar de ofrecer vinculación. El fix cambia la respuesta del endpoint de reportes (duplicado → oferta), agrega un flag de vinculación intencional, cablea `crearExpediente` al flujo del 2.º reporte vía `/api/reportes`, y entrega la vista de expediente + PDF.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js ≥ 22

**Primary Dependencies**: Next.js App Router · Prisma 5.22.0 · PostgreSQL 16 · Vitest · pdfmake (ya instalado)

**Storage**: PostgreSQL 16 (Prisma ORM). Entidades relevantes: `Reporte`, `Expediente`, `EventoExpediente`. No hay migración de esquema en esta SPEC — el modelo ya existe.

**Testing**: Vitest (unit) · Playwright/request (E2E). `tests/e2e/reportes.spec.ts:81-107` debe actualizarse (candado 24 v2).

**Target Platform**: Next.js App Router (server-side). Los endpoints nuevos son Server Actions / API Routes estándar — NO Edge Runtime (pueden tocar Prisma).

**Performance Goals**: Oferta visible en < 2s. PDF generado en < 10s para hasta 20 eventos.

**Constraints**:
- `src/lib/ai/**` solo-lectura (motor de clasificación intacto)
- `crearReporteVinculado` MUERTO — no resucitar
- Detección de duplicados (SPEC-137 lock + `findDuplicadoReciente`) se conserva intacta
- Sin migración de esquema (el modelo de Expediente/EventoExpediente ya existe)
- Ley 1581: payload de "otros eventos" excluye texto y autor en el SELECT, no solo en la UI

**Project Type**: Web service (Next.js API Routes)

---

## Constitution Check

| Principio | Estado | Notas |
|---|---|---|
| Solo texto — sin multimedia | ✅ PASS | El expediente y el PDF contienen solo texto y metadatos |
| Presunción de inocencia en el lenguaje | ✅ PASS | El expediente no emite veredictos; muestra conductas descritas |
| Clasificación de conductas, no scoring | ✅ PASS | Esta SPEC no toca el motor; muestra la clasificación existente |
| LLM local — textos no salen del servidor | ✅ PASS | Sin cambios al motor de IA |
| Ley 1581 — privacidad de terceros | ✅ PASS | FR-009: payload de "otros" excluye texto y autor en el SELECT |
| Canales oficiales visibles | ✅ PASS | El PDF reutiliza la estructura de `pdf-denuncia.ts` con canales |

---

## Architecture Decisions

### AD-1: Respuesta del endpoint de reportes al detectar duplicado

**Contexto**: Hoy `POST /api/reportes` retorna 429 con `{error: {code: "DUPLICATE_REPORT", reporteExistenteId}}` cuando detecta duplicado.

**Decisión**: Para el **padre autenticado** (PARENT), en lugar de 429, retornar **HTTP 200** con `{oferta: true, reporteExistenteId: string, identificador: string}`. El código HTTP 200 diferencia la oferta de un error y permite que el cliente lo procese sin catch.

Para el **usuario anónimo** y para otros errores: sin cambio.

**Alternativa descartada**: HTTP 202 (accepted) — introduce ambigüedad semántica. HTTP 200 con cuerpo diferenciado es más claro.

### AD-2: Flag de vinculación intencional (`reportePrevioId`)

**Contexto**: Cuando el padre acepta la oferta, el cliente envía de nuevo `POST /api/reportes`. Sin un flag, el servicio vuelve a detectar el duplicado y retorna la oferta → loop infinito.

**Decisión**: El cliente incluye `reportePrevioId: string` en el body del 2.º request. El servicio detecta el duplicado como siempre; si `input.reportePrevioId === existente.id` **y** `existente.usuarioId === usuarioId` (seguridad: el reporte previo le pertenece), procede a crear el reporte y el expediente.

**Seguridad**: Para pasar `reportePrevioId`, el cliente debe haber recibido el `reporteExistenteId` en la respuesta de oferta — que el servidor generó para ese padre. Un atacante externo que pase un `reportePrevioId` arbitrario: el guard `existente.usuarioId === usuarioId` lo bloquea.

### AD-3: Texto del evento retroactivo (event #1)

**Contexto**: Al crear el expediente en el 2.º reporte, el evento #1 debe vincularse al reporte original. Pero el texto del reporte original está cifrado (`cifrarTextoReporte`) — no disponible en plaintext.

**Decisión**: El evento #1 usa `texto = ""` (campo vacío permitido por el schema) y el `reporteId` apunta al reporte original. El endpoint GET de detalle del expediente muestra, para cada evento propio, los datos del Reporte vinculado: `ciudad`, `pais`, `fechaIncidente` (siempre en plaintext en la BD). Para "lo que escribió", muestra `EventoExpediente.texto` cuando no está vacío, o un descriptor de contexto cuando lo está.

**✅ RESUELTO por CEO · 30-08-2026 22:15 COT · Opción C**:
Descifrar `reporte.texto` con `descifrarTextoReporte()` **al leer**, server-side, en memoria — sin persistir plaintext.
`EventoExpediente.texto` almacena `""`. El `textoDescifrado` se inyecta en el DTO de respuesta del GET y en el PDF.

Límites duros (no negociables):
- Solo para el dueño (`padreUsuarioId === usuarioId`)
- Solo en expediente y PDF — `/mis-reportes` y `detallePadre` NO cambian
- Jamás para reportes ajenos (contexto de terceros sigue siendo solo fecha/ciudad/país/clasificación)
- Comentario obligatorio en el código: `// C/AD-3: el expediente es documento probatorio del dueño (spec 090/116 acotada, no derogada); descifrado server-side solo para el padreUsuarioId dueño, nunca para ajenos, sin persistir.`

### AD-4: Convergencia de camino de creación de reporte

`crearReporteVinculado` (método privado de `ExpedienteRepository`) está muerto — cero callers. El flujo de vinculación usa:
1. `POST /api/reportes` con `reportePrevioId` → crea Reporte #2 normalmente (con encriptación, encolado, ciudad/pais reales)
2. Dentro del mismo `withUnitOfWork`: `crearExpediente({padreUsuarioId, identificadorReportado})` → crea Expediente
3. `agregarEvento({expedienteId, texto: "", reporteId: reporte1.id, fechaEvento: reporte1.creadoEn})` → event #1 retroactivo
4. `agregarEvento({expedienteId, texto: input.texto, reporteId: reporte2.id})` → event #2

`crearReporteVinculado` **no se toca** (queda dead en el source; eliminarlo es fuera de alcance de esta SPEC).

### AD-5: PDF del expediente

`pdf-denuncia.ts` está diseñado para denuncia formal ante autoridades (carátula institucional, conductas, canales). La estructura es diferente a la del "expediente del padre" (eventos propios, contexto de otros). 

**Decisión**: Crear un nuevo módulo `src/lib/expediente/pdf-expediente.ts` siguiendo el mismo patrón (pdfmake, `renderPdfBuffer`, determinista con `fechaGeneracion`). `pdf-denuncia.ts` no se modifica.

### AD-6: Expediente para 3.er y posteriores reportes

Si el padre reporta el mismo identificador una 3.ª vez (nuevo duplicado detectado), el expediente ya existe. La detección `findDuplicadoReciente` seguirá detectando el duplicado del reporte más reciente (30 días). El sistema ofrece de nuevo y el padre puede vincular un 3.er evento. Antes de `crearExpediente`, el flujo busca si ya existe un expediente activo para `(padreUsuarioId, identificadorReportado)`. Si existe, lo usa. Si no, lo crea.

---

## Phases

### Fase 1 · Cambio de respuesta y flag de vinculación (US1)

Archivos a modificar:
- `src/app/api/reportes/route.ts` — detecta duplicado+padre autenticado → 200 con `{oferta: true, ...}`
- `src/lib/dal/services/reporte-creation.ts` — nuevo campo `reportePrevioId?` en `CrearReporteInput`; lógica de bypass cuando `reportePrevioId === existente.id && existente.usuarioId === usuarioId`
- `src/lib/validators.ts` — `crearReporteSchema` agrega campo opcional `reportePrevioId: z.string().uuid().optional()`
- `src/components/modules/ReporteWizard.tsx` — detecta respuesta `{oferta: true}`, muestra el card de oferta, lleva al formulario con `identificadorInicial` fijo
- `tests/e2e/reportes.spec.ts:81-107` — actualizar aserción: 429 → 200 con `oferta: true` y `reporteExistenteId`

### Fase 2 · Cableado del expediente (US2)

Archivos a modificar:
- `src/app/api/reportes/route.ts` — en el flujo de vinculación aceptada, después de crear Reporte #2: buscar expediente existente o crear uno nuevo; agregar dos eventos
- `src/lib/dal/repositories/expediente-repository.ts` — nuevo método `buscarExpedienteActivo(padreUsuarioId, identificadorReportado)` para evitar duplicar expedientes
- `src/lib/dal/services/reporte-creation.ts` — tipo de retorno ampliado: `ResultadoCreacion` agrega `| { ok: true; reporte: ReporteCreadoDto; expediente: ExpedienteDto }` cuando hay vinculación

### Fase 3 · Endpoint de detalle del expediente (US3)

Archivos a crear/modificar:
- `src/app/api/padre/expedientes/[id]/route.ts` — GET: verifica titularidad; retorna eventos propios completos + contexto de otros con SELECT explícito (solo fecha, país, ciudad, clasificación)
- `src/lib/dal/repositories/expediente-repository.ts` — método `obtenerDetalleExpediente(id, padreUsuarioId)` con la query anónima separada

### Fase 4 · Endpoint de PDF (US4)

Archivos a crear:
- `src/lib/expediente/pdf-expediente.ts` — generador de PDF (pdfmake, `renderPdfBuffer`)
- `src/app/api/padre/expedientes/[id]/pdf/route.ts` — GET: genera y retorna el Buffer con headers de descarga

### Fase 5 · Tests y disciplina de specs

- Vitest para las nuevas rutas y el servicio ampliado (candado 24 v2)
- `tests/e2e/reportes.spec.ts` — actualización obligatoria (candado 24 v2)
- `specs-discipline.test.ts` — verificar que la SPEC-323 aparece en el catálogo con status correcto
- Fila en `specs/README.md`

---

## Dependency Order

```
Fase 1 (respuesta + flag) → Fase 2 (expediente) → Fase 3 (vista) → Fase 4 (PDF) → Fase 5 (tests)
```

Fase 1 y Fase 2 comparten `reporte-creation.ts` y `route.ts` — deben implementarse en secuencia.
Fase 3 y Fase 4 son independientes entre sí y pueden implementarse en paralelo una vez completa la Fase 2.
