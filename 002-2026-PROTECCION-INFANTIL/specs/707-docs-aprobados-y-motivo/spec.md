# SPEC-707 · Devolución de documentos: se bloquean los aprobados y se le dice al profesional por qué le devolvieron el suyo

**Status**: DESARROLLO

**Origen:** Jelkin probando el ciclo completo (17-09): como admin devolvió solo el documento 3 y encontró dos cosas. **Carril:** Dev 1 · Diseño (la forma del aviso) · Calidad. **Orden:** ya.

## Lo que encontró

- *«el profesional ingresa y puede modificar los 2 doc aprobados»* — un aprobado no debería tocarse mientras la verificación está devuelta.
- *«no muestra el motivo de rechazo del doc 3»* — el profesional no ve por qué le devolvieron el suyo.

## El arreglo

1. **Los aprobados se bloquean en el SERVIDOR** mientras la solicitud está DEVUELTA (BORRADOR tras `MAS_INFORMACION`) o EN_REVISION. Solo el documento DEVUELTO (`NO_CUMPLE`) se vuelve a subir. La regla vive en `guardarDocumentoDeRequisito` (servicio), no solo en la pantalla — Jelkin comprobó que la pantalla no bastaba.
   - **Excepción (SPEC-693, no se toca):** un profesional ACTIVO/VENCIDO SÍ sube una versión nueva de un aprobado (renovación). Por eso el bloqueo es `enCiclo` (BORRADOR/EN_REVISION), no «tiene un aprobado».
2. **El motivo se muestra.** `estadoDeDocumentos` trae, por requisito, la `observacion` que el verificador escribió (del checklist `NO_CUMPLE` de la última devolución) y `bloqueado` (aprobado en ciclo). La pantalla del profesional muestra el motivo JUNTO al documento devuelto y no ofrece reemplazar los bloqueados. **Diseño define la forma del aviso** (la versión actual es funcional, en *usted*).

## Fuente única

El bloqueo (al subir) y la vista (`estadoDeDocumentos`) leen lo mismo: `PerfilProfesionalRepository.estadoYUltimaRevision` (estado + checklist de la última verificación). No pueden divergir — que la pantalla muestre editable lo que el servidor bloquea (o al revés) era el riesgo.

## Candados

- `documentos-aprobados-bloqueados.candado.test.ts` (conducta, con `decidir` real):
  (a) con la solicitud devuelta, reemplazar el aprobado → 409; el devuelto sí se vuelve a subir. **Control positivo por el otro lado:** un ACTIVO sí renueva el aprobado.
  (b) tras devolver con observación, `estadoDeDocumentos` trae el motivo real del devuelto y marca el aprobado como bloqueado.
  Mutación-verificado: neutralizar el bloqueo → (a) rojo.

## Impacto

**Impacto en arquitectura:** el bloqueo de reemplazo y el motivo derivan de UNA lectura (`estadoYUltimaRevision`), consumida por el servicio (al subir) y por la vista — sin duplicar la regla. Sin cambio de esquema. El aviso al profesional va en *usted* (SPEC-550). El motivo ya lo escribía el verificador (`MAS_INFORMACION` + checklist); acá se le hace llegar.

## Fuera

- La renovación del ACTIVO (SPEC-693) no se toca. · La forma visual del aviso la afina Diseño. · El aviso por correo al profesional (SPEC-418) ya existe.
