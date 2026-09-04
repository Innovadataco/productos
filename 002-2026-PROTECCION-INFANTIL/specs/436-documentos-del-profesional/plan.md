# Plan · SPEC-436 — Los documentos del profesional

## Análisis en fuente, antes de codificar (candado 15 v5)

| Archivo | Qué se sacó |
|---|---|
| `lib/profesional/autorizacion-storage.ts` | Ya hace TODO lo que pide el radicado: cifrado AES-256-GCM, nombre opaco `<uuid>.enc`, tope 5 MB, validación por magia de bytes (PDF/PNG/JPG). **Se reusa entero.** `leerAutorizacion:96` es la función muerta. |
| `api/profesional/autorizacion/route.ts:93` | Persiste `autorizacionArchivoUrl: guardado.archivoId` — confirma que la columna guarda un **id**. Y **no persiste la extensión**: el `Content-Type` hay que deducirlo del contenido. |
| `FichaVerificacionClient.tsx:161-164` | `href={ficha.autorizacionArchivoUrl}` → el 404. |
| `verificador/requisitos.ts` | `leerRequisitosVerificacion()` ya lee el parámetro y valida con Zod. La lista sale de ahí, nunca de una constante. |
| `verificador/service.ts:125-160` | `abrirFicha` arma la ficha; ahí se agrega el estado de cada documento. `decidirVerificacion` valida el checklist: es el lugar de la guardia «sin documento no hay CUMPLE». |
| `schema.prisma:360` | **`PROFESIONAL_AUTORIZACION_ACCESO` ya existe en `AccionAudit` y no lo emite nadie.** Se usa para auditar la apertura → **cero valores de enum nuevos, cero coordinación con BI**. |
| `profesional/dto.ts:88` | `perfilCompletoParaRevision` exige la autorización; los documentos por requisito NO la bloquean (decisión: el Verificador los pide en la devolución). |

## Decisiones

| Decisión | Por qué |
|---|---|
| Tabla `DocumentoProfesional` con `@@unique([perfilProfesionalId, requisitoClave])` | Un documento por requisito; reemplazar es un upsert, no una fila nueva que ensucie. |
| `Content-Type` deducido del buffer descifrado | El dato guardado puede mentir; el contenido no. Reusa `validarAutorizacion`. |
| Renombrar a `autorizacionArchivoId` | El nombre decía URL y guardaba un id. Guardar una URL servible sería peor: una dirección en la base. |
| Auditar con `PROFESIONAL_AUTORIZACION_ACCESO` | Ya existe sin emisor. Evita un `ADD VALUE` que congelaría la réplica de BI hasta coordinar con Kimi. |
| La guardia de CUMPLE va en el **servidor** | Una guardia solo en la pantalla se saltea con una petición directa. |

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| Servir el archivo a quien no debe | Autorización por rol Y por pertenencia a la ficha; contraprueba con otro profesional y con un padre. |
| Que la apertura no quede auditada | Test que lee la fila en BD, no el texto del código. |
| Que `leerAutorizacion` vuelva a quedar muerta | Candado con llamador real que muere al quitarlo. |
| Que el rename rompa referencias | 41 referencias; `tsc` + suite completa antes del push. |
