# SPEC-436 · Los documentos del profesional: se cargan, se guardan y SE PUEDEN LEER

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-80`) · **Origen**: **I-303** + **I-304** · radicado del 04-09 · brief A-75 §5-bis

**Impacto en arquitectura:** tabla nueva `DocumentoProfesional`; la columna `autorizacionArchivoUrl` **se renombra** a `autorizacionArchivoId` (guardaba un id, no una URL) en `PerfilProfesional` y `VerificacionProfesional`. Cuatro endpoints nuevos. **Ningún valor de enum nuevo**: la auditoría de apertura reusa `PROFESIONAL_AUTORIZACION_ACCESO`, que existía sin emisor desde SPEC-391 — así que **no hace falta coordinar con BI**.

---

## Lo que está roto

**1 · El enlace lleva a 404.** `autorizacionArchivoUrl` guarda el **identificador** del archivo, no una dirección. `FichaVerificacionClient.tsx:161-164` lo pone como `href`, el navegador lo resuelve relativo a la página y cae en `/dashboard/admin/verificacion/<uuid>`.

**2 · No hay forma de leer el archivo.** `/api/profesional/autorizacion` **solo tiene POST**. `leerAutorizacion` —la función que descifra— **no tiene un solo llamador**. El botón prometía «descargar autorización firmada» y esa capacidad nunca existió.

**3 · Los 4 requisitos nunca se le piden al profesional.** El parámetro `verificacion.requisitos` los tiene configurados, pero el formulario sube **un solo archivo** y no hay endpoint para los otros. Al Verificador se le pide decidir sobre documentos que nadie recolectó.

---

## Qué trae

**El profesional carga sus documentos.** Un bloque en `/perfil-profesional/completar` **derivado del parámetro**: si mañana se agrega un quinto requisito, la pantalla lo muestra sola. Por requisito: subir, reemplazar, y ver si ya está cargado. Mismo tratamiento que la autorización —cifrado en reposo, nombre opaco, 5 MB, validación por número mágico— **reusando `autorizacion-storage`**, sin reescribir criptografía.

**Alguien puede leerlos.** Un endpoint sirve el documento **descifrado al vuelo**. Solo **VERIFICADOR y ADMIN de esa ficha**, y el **profesional dueño** los suyos. Nunca se sirve el cifrado crudo ni se expone la ruta en disco. El `Content-Type` se deduce del contenido descifrado (mismo número mágico que valida la subida), no de un dato guardado que podría mentir.

**Cada apertura se audita.** Quién, cuándo, cuál documento. Son datos personales sensibles y el certificado de antecedentes es **reservado por ley** (Ley 1918/2018 · 2375/2024 §5).

**La ficha muestra cada documento junto a su requisito**, y **sin documento no se puede marcar CUMPLE** — hoy se puede aprobar sin haber visto nada. La guardia vive en el servidor, no solo en la pantalla.

**El nombre deja de mentir.** `autorizacionArchivoUrl` → **`autorizacionArchivoId`**. Se eligió renombrar (no guardar una URL) porque el id opaco es justamente lo que protege el archivo: una URL servible en la columna sería una dirección adivinable en la base.

---

## Verificación

Candados de **conducta**, no de palabras:

- **El 404, reproducido:** abrir el documento desde la ficha responde el **archivo**, con su `Content-Type`, no una página de la aplicación.
- **`leerAutorizacion` deja de ser código muerto:** candado que exige llamador real y **muere si se lo quitan** (mismo molde que el de los barredores de SPEC-427).
- **Permisos con contraprueba:** un profesional NO lee los documentos de otro (403); un padre tampoco (403); el verificador sí (200).
- **Auditoría leída EN BASE:** tras abrir un documento se consulta la fila de `AuditLog` — no se afirma que el código «tiene la llamada».
- **Requisito sin documento:** no se puede marcar CUMPLE (rechazo del servidor).
- **La lista sale del parámetro:** se agrega un quinto requisito y aparece su casilla **sin tocar código**.

> **Verde en CI ≠ funciona.** Cierra cuando un verificador abra documentos de una ficha real **en producción** y decida con ellos a la vista, con la traza de esa apertura en la auditoría.
