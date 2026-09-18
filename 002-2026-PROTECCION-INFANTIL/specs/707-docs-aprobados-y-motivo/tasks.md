# SPEC-707 · Tasks

## Candado antes del fix
- [x] T1 · `documentos-aprobados-bloqueados.candado.test.ts` — conducta con `decidir` real. Mutación: neutralizar el bloqueo → (a) rojo.

## Fix (Dev 1)
- [x] T2 · Lectura única `PerfilProfesionalRepository.estadoYUltimaRevision(perfilId)` (estado + checklist de la última verificación).
- [x] T3 · Bloqueo en `guardarDocumentoDeRequisito`: `enCiclo` (BORRADOR/EN_REVISION) ∧ requisito `CUMPLE` → 409 (mensaje en usted). ACTIVO/VENCIDO exento (renovación SPEC-693).
- [x] T4 · `estadoDeDocumentos` gana `bloqueado` + `observacion`; `DocumentosRequisitos.tsx` muestra el motivo junto al devuelto y no ofrece reemplazar los bloqueados (usted).

## Diseño
- [ ] T5 · Diseño afina la FORMA del aviso del motivo y del estado bloqueado (la versión actual es funcional).

## Cierre
- [ ] T6 · Preflight (tsc · lint · arch:check · specs-discipline) · PR verde · reportar al CEO. Calidad camina el ciclo devolución → el profesional ve el motivo y no toca los aprobados.

## Fuera
- Renovación del ACTIVO (SPEC-693) no se toca. · Aviso por correo (SPEC-418) ya existe.
