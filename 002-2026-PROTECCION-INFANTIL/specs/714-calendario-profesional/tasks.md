# SPEC-714 · Tasks

## Backend
- [x] T1 · `FranjaDisponibleRepository.listarConSolicitud(perfilId, desde, hasta)` (incluye `solicitud` + `padreUsuario{nombre,email}`).
- [x] T2 · `calendario.service.ts` · `calendarioDelProfesional(usuarioId, desde, hasta)` → bloques (libre/validando/esperando/confirmada, relato en esperando, contacto en confirmada por H-2) + `venceEn` + `diasBloqueados`.
- [x] T3 · `franjas.service.ts` · `materializar(perfilId, patron)` en `withUnitOfWork` → `{creadas, omitidas}`; `POST /api/profesional/franjas/lote`.

## Componente (uno solo)
- [x] T4 · `CalendarioProfesional` reescrito: rejilla semana/día + móvil (tira), cabecera Hoy/Día-Semana.
- [x] T5 · Drag-crear (snap 30, fantasma) + popover (modalidad/repetir/publicar) → POST unitario; muro de vigencia + no-solape + modalidad a la vista.
- [x] T6 · Repetir / copiar día / seleccionar-lote / quitar → `POST /lote` + DELETE; «cuántas caben».
- [x] T7 · Estados en la cuadrícula + Responder (relato + Confirmar/No puedo → PATCH confirmar/rechazar) + detalle de confirmada (contacto, SIN código de cierre) + campanita→buzón.
- [x] T8 · Montar en `/calendario` (publicar) y `/citaciones` (responder, antepone «esperando») con `modo`.

## Candados (mutación)
- [x] T9 · c1 materializar (exacto + vigencia), c3 borrar-reservada (409), c4 modalidad-no-atendida (400). c2 bloquear difiere con el botón.

## Cierre
- [ ] T10 · Preflight (tsc · lint · arch:check · specs-discipline · voz-usted) · PR verde · avisar al CEO. Diseño certifica contra el mockup; Calidad camina.

## Bloquear día (PR chico de seguimiento — HECHO, tras el modelo de Datos)
- [x] T11 · `diasBloqueados` real (DiaBloqueadoRepository) en calendario.service; `fechaBogota`→`diaBogota`.
- [x] T12 · Regla de día-bloqueado en el camino LOTE (`materializarFranjas`) — la puerta hermana del single (Datos ya la puso en franjas/route.ts).
- [x] T13 · Endpoint `POST/DELETE /api/profesional/dias-bloqueados` + botón bloquear/reabrir + rayado durable + no-crear en día cerrado.
- [x] T14 · Candado c2 (lote omite día bloqueado) mutación-verificado; «bloquear no borra citas» ya lo cubre `dia-bloqueado.candado.test.ts` (Datos).

## Deferido (no bloquea)
- Cierre con código (L6). · Dirección/enlace (SPEC-708, Dev 2).
