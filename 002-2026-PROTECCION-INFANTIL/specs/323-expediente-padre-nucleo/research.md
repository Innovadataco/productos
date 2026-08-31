# Research — SPEC-323: El expediente del padre · NÚCLEO

**Date**: 2026-08-30

---

## Decisión R-1: Código HTTP para la oferta de vinculación

**Decision**: HTTP 200 con `{oferta: true, reporteExistenteId, identificador}`.

**Rationale**: Un status de éxito (2xx) diferencia semánticamente la oferta de un error (4xx/5xx). El cliente puede procesarlo en el flujo normal sin catch de error. HTTP 202 introduce ambigüedad ("aceptado, pendiente de procesamiento"). HTTP 200 es inequívoco: la solicitud fue procesada y la respuesta contiene una acción para el usuario.

**Alternatives considered**: HTTP 429 (estado actual, rechazado: bloqueo en lugar de oferta). HTTP 202 (rechazado: semántica de procesamiento asíncrono). HTTP 409 Conflict (rechazado: implica error, no oferta).

---

## Decisión R-2: Mecanismo de bypass del dedup para vinculación intencional

**Decision**: Campo `reportePrevioId: string (uuid, opcional)` en el body del request. Validado en Zod. El servicio compara `reportePrevioId === existente.id` Y `existente.usuarioId === usuarioId`.

**Rationale**: La detección (SPEC-137 lock + `findDuplicadoReciente`) se conserva intacta (candado 26). La distinción entre "duplicado no intencional" y "vinculación intencional" se expresa en el payload del cliente. El doble guard (ID + titularidad) impide que un atacante pase un `reportePrevioId` arbitrario.

**Alternatives considered**: Token de vinculación firmado (HMAC) — más seguro pero innecesariamente complejo para este contexto; el guard de titularidad es suficiente. Flag booleano `confirmarVinculacion` — sin referencia al reporte previo, no se puede validar la titularidad.

---

## Decisión R-3: Texto del evento retroactivo (event #1)

**Decision**: `texto = ""` (vacío). El evento se vincula al Reporte original vía `reporteId`. El endpoint de detalle muestra `ciudad`, `pais`, `fechaIncidente` del Reporte vinculado. El campo "lo que escribió" se muestra solo si `EventoExpediente.texto` no está vacío.

**Rationale**: El texto original del reporte está cifrado con dos capas (`encryptParameter` + `cifrarTextoReporte`). Descifrar en este flujo requeriría importar las claves de descifrado en la ruta de creación del expediente — riesgo innecesario. Para v1, mostrar los metadatos del reporte (ciudad, fecha, clasificación) es suficiente. El texto en plaintext solo existe en el momento del POST original.

**Alternatives considered**: Placeholder string ("Primer reporte vinculado") — redundante si el GET ya muestra los metadatos del Reporte. Almacenar plaintext en el evento del 1.er reporte al momento del 1.er POST — requiere cambio en el flujo del 1.er reporte, fuera de alcance de SPEC-A; puede hacerse en SPEC-B.

**✅ RESUELTO CEO 30-08-2026 22:15 COT**: Opción C — descifrar al leer (server-side) sin persistir plaintext. `EventoExpediente.texto = ""`. El `textoDescifrado` se inyecta en el DTO del GET y en el PDF. Solo para el dueño (`padreUsuarioId`), nunca para ajenos. `/mis-reportes` y `detallePadre` no cambian.

---

## Decisión R-4: PDF — nuevo módulo vs reutilizar `pdf-denuncia.ts`

**Decision**: Nuevo módulo `src/lib/expediente/pdf-expediente.ts`.

**Rationale**: `pdf-denuncia.ts` está diseñado para denuncia formal ante autoridades (conductas, canales oficiales, lenguaje institucional). El "expediente del padre" tiene una estructura diferente: es el registro personal del padre, no un borrador de denuncia. Reutilizar `pdf-denuncia.ts` requeriría adaptar su API de forma no natural (forzar datos de conductas donde hay eventos personales). El patrón `renderPdfBuffer` + pdfmake ya está disponible y es el que se usa.

**Alternatives considered**: Reutilizar `pdf-denuncia.ts` con wrapper — rechazado por acoplamiento forzado de estructuras distintas. Usar la misma función con parámetros diferentes — rechazado por violación del SRP.

---

## Decisión R-5: Búsqueda de expediente existente antes de crear

**Decision**: Nuevo método `buscarExpedienteActivo(padreUsuarioId, identificadorReportado)` en `ExpedienteRepository`. Retorna el expediente activo si existe, `null` si no.

**Rationale**: El flujo del 3.er reporte y posteriores debe agregar eventos al expediente existente, no crear uno nuevo. Sin este método, el código de la ruta tendría que hacer la búsqueda directamente — violando la capa DAL. El método se encapsula en el repositorio donde corresponde.

**Alternatives considered**: Unique constraint en BD (padreUsuarioId, identificadorReportado) — no aplica porque el schema actual no tiene esa constraint y agregar una requeriría migración. Buscar desde la ruta directamente — rechazado por violación SPEC-053 (la ruta no toca Prisma directamente).
