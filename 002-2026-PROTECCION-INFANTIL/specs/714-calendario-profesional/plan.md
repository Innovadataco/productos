# SPEC-714 · Plan

## Impacto en arquitectura

- **Lectura de calendario** — `FranjaDisponibleRepository.listarConSolicitud(profesionalId, desde, hasta)` (incluye `solicitud` con `estado`, `presentacion`, `padreUsuario{nombre,email}`). Un loader server (`calendario.service.ts` → `calendarioDelProfesional(usuarioId, desde, hasta)`) arma el DTO: bloques (libre/validando/esperando/confirmada) + `venceEn` + `diasBloqueados` (vacío hasta el modelo). Respeta H-2: correo del padre solo en `CONFIRMADA` (reusa el criterio de `toCitaParaProfesional`).
- **Materializar en lote** — `franjas.service.ts` `materializar(perfilId, {inicio,fin,modalidad,dias[]})` en `withUnitOfWork`: por cada día valida modalidad + `fin<=venceEn` + no-solape (repo) y crea; devuelve `{creadas, omitidas:{vigencia,solape}}`. Expuesto por `POST /api/profesional/franjas/lote` (nunca GET-que-muta). El `POST` unitario y el `DELETE` siguen igual.
- **Componente único** — `CalendarioProfesional` (reescrito, client). Props: config del perfil + `datos` (bloques, venceEn, diasBloqueados) + `modo: "calendario" | "citaciones"`. Rejilla semana/día + móvil; drag-crear (pointer events, snap 30); popover; repetir/copiar/seleccionar; estados en la cuadrícula; responder (Confirmar/No puedo con el relato); detalle de confirmada (contacto, sin código de cierre); campanita→buzón. Acciones por estado (ningún botón donde daría 409, patrón de `SolicitudAcciones`).
- **Páginas** — `/calendario` (lidera publicar) y `/citaciones` (antepone «Esperando su respuesta») montan el MISMO componente con `modo` distinto.

## Orden

1. Backend: repo `listarConSolicitud` + `calendario.service` (lectura) + `franjas.service.materializar` + `POST /franjas/lote`. Candados c3/c4 ya viven en el servidor; c1 sobre `materializar`.
2. Componente: rejilla + drag-crear + publicar (unit) → repetir/copiar/seleccionar (lote) → estados + responder + detalle + campanita/buzón.
3. Montar en las dos páginas con `modo`.
4. Candados con mutación (c1, c3, c4; c2 con el botón de bloquear si el modelo está).
5. Voz-usted (candado 550/719 ya cubre el árbol). Preflight + PR.

## Verificación

- Candados c1/c3/c4 verdes + mutación (rojo). c2 difiere si no hay modelo.
- tsc · lint · arch:check (materializar es POST, no GET) · specs-discipline · voz-usted.
- Recorrido lo camina Calidad; Diseño certifica contra el mockup.

## Deferido (no bloquea)

- Bloquear día (modelo `DiaBloqueado` de Datos) → botón + c2 en PR chico posterior. Núcleo sale sin botón falso.
- Cierre con código (L6), plata (L7), dirección/enlace (SPEC-708).
