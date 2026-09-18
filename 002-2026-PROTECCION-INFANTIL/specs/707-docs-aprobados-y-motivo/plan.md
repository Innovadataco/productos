# SPEC-707 · Plan

## Impacto en arquitectura

- **Lectura única** — `PerfilProfesionalRepository.estadoYUltimaRevision(perfilId)`: estado del perfil + checklist de la última verificación. La consumen el bloqueo y la vista.
- **Bloqueo (servidor)** — `guardarDocumentoDeRequisito`: si `enCiclo` (BORRADOR/EN_REVISION) y el requisito es `CUMPLE` en la última revisión → 409. El ACTIVO/VENCIDO no entra al bloqueo (renovación SPEC-693).
- **Vista** — `estadoDeDocumentos`: cada requisito gana `bloqueado` (aprobado en ciclo) y `observacion` (motivo del `NO_CUMPLE`). `DocumentosRequisitos.tsx` muestra el motivo junto al devuelto y no ofrece reemplazar los bloqueados (en *usted*; Diseño afina la forma).
- Sin esquema, sin migración, sin ruta nueva.

## Orden

1. Lectura `estadoYUltimaRevision`.
2. Bloqueo en el servicio (con la excepción ACTIVO/VENCIDO).
3. `observacion` + `bloqueado` en la vista + la pantalla.
4. Candado de conducta (bloqueo + motivo + control positivo ACTIVO); mutación.
5. Preflight + PR. Diseño refina la forma del aviso; Calidad camina el ciclo (devolver → el profesional ve el motivo, no puede tocar los aprobados, sube el devuelto).

## Verificación

- Candado verde + mutación (neutralizar el bloqueo → rojo).
- `documentos.integracion` sin regresión; voz-usted del componente verde.
- El recorrido en vivo lo camina Calidad tras el deploy.
