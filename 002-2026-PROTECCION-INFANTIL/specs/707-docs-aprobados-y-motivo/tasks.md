# SPEC-707 · Tasks

## Candado antes del fix
- [x] T1 · `documentos-aprobados-bloqueados.candado.test.ts` — conducta con `decidir` real. Mutación: neutralizar el bloqueo → (a), (a·en revisión) y (b) rojo; el control ACTIVO queda verde.

## Fix (Dev 1)
- [x] T2 · Lectura única `PerfilProfesionalRepository.estadoYUltimaRevision(perfilId)` (estado + checklist de la última verificación).
- [x] T3 · Bloqueo en `guardarDocumentoDeRequisito`: `enCiclo` (BORRADOR devuelto / EN_REVISION) ∧ requisito `CUMPLE` → 409 (mensaje en usted). ACTIVO/VENCIDO exento (renovación SPEC-693).
- [x] T4 · `estadoDeDocumentos` gana `bloqueado` + `observacion` + `revision`; `DocumentosRequisitos.tsx` muestra el motivo junto al devuelto y no ofrece reemplazar los bloqueados (usted).

## Diseño
- [x] T5 · Forma publicada por Diseño (`FORMA-SPEC707-…`, commit 573de54) e implementada: insignia por revisión (`aprobado` ✓ pino · `devuelto` ámbar con «Qué revisar» + motivo verbatim · `en_revision` ámbar, solo lectura), «Volver a subir» como único botón del devuelto, y la línea que DICE por qué el aprobado no tiene botón. El discriminante es el estado de la SOLICITUD: EN_REVISION → la pantalla es de solo lectura; DEVUELTA → solo el devuelto se vuelve a subir.

## Cierre
- [ ] T6 · Preflight (tsc · lint · arch:check · specs-discipline · voz-usted) · PR verde · reportar al CEO. Calidad camina el ciclo devolución → el profesional ve el motivo y no toca los aprobados.

## Fuera
- Renovación del ACTIVO (SPEC-693) no se toca. · Aviso por correo (SPEC-418) ya existe.
