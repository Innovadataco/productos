# Plan — SPEC-778 · El padre (y el profesional) ven el enlace de la reunión

> Compuerta §4: PARO tras spec+plan+tasks para OK del CEO + copy de Diseño (estados). Implementación DESPUÉS.
> Orden: **778 → 752 → 754**. #743 (754) queda SIN mergear hasta que 778 exista.

## Punto de partida (medido en main, no supuesto)

- `enlaceVisibleParaCita(publicado, franjaFin, now)` ya existe (SPEC-750, `enlace-validacion.ts`) — la regla de los §7. Se REUSA.
- Operador ya deriva `enlaceEstado` (`publicado`/`sin-enlace`) en `calendario-operador.service.ts:75`.
- Columnas `enlaceReunion`/`enlaceOperadorId`/`enlacePublicadoEn` existen (SPEC-758) y están reservadas por nombre (`CAMPOS_INTERNOS_CITA` + `dto-reserva.candado`).
- Padre y profesional NO ven el enlace (medido). Fallback `: nueva` de reasignar/reprogramar YA fail-closed (SPEC-750).

## Diseño (contrato — lo que aprueba el CEO)

### Derivación (fuente única)
1. `derivarEnlaceParaCita(cita, now) → { estado: "SIN_PUBLICAR" | "PUBLICADO" | "CERRADO_POR_HORA", url?: string }`:
   - `url` presente SOLO si `enlaceVisibleParaCita(cita.enlacePublicadoEn != null, cita.franja.fin, now)`.
   - estado: publicado+futuro → PUBLICADO(url); publicado+pasado → CERRADO_POR_HORA; no publicado → SIN_PUBLICAR.
   - fail-closed: sin `now`/`franjaFin` → sin `url`.
   - vive en un módulo import-light (como `enlace-validacion.ts`) para que el candado la pruebe unit.

### Superficies (consumo)
2. `toCitaParaPadre` (dto.ts): agrega `enlace = derivarEnlaceParaCita(solicitud, now)`. El `now` ya entra a `toCitaParaPadre`.
3. `toCitaParaProfesional` (dto.ts): idem (usado por `/api/profesional/solicitudes`).
4. `BloqueCalendario` / `calendarioDelProfesional` (calendario.service.ts): agrega `enlace` al bloque, misma derivación.
5. `CitaParaPadreDto`/`CitaParaProfesionalDto`/`BloqueCalendario` ganan el campo `enlace?` (tipo compartido).

### Reserva (mantener)
6. `enlaceOperadorId`/`enlacePublicadoEn` NO se exponen (ni valor). `enlaceReunion` sigue reservado por NOMBRE; su VALOR sale solo bajo `enlace.url`. Ajustar `dto-reserva.candado` para permitir el valor gateado bajo la clave derivada sin aflojar la prohibición de los nombres crudos.

### UI (copy = Diseño)
7. Padre: `EsperaCitaPanel` pinta el bloque de enlace según `cita.enlace.estado` (link cuando hay `url`; texto de estado si no). Copy [DISEÑO].
8. Profesional: el panel del calendario (`Paneles.tsx`, «Cita confirmada») y/o la vista de solicitudes pintan lo mismo. Copy [DISEÑO].
9. Render: `url` como `href` escapado; nunca `dangerouslySetInnerHTML`.

## Candados (fase implementación)
- C-visible por superficie (padre, profesional-solicitudes, profesional-calendario): url real plantada; cruzar el vivo (now antes/después de `franjaFin`); publicado/no publicado. Control positivo y negativo.
- C-fuente-única: barrido de decisores de visibilidad del enlace = exactamente los que el candado ejerce.
- C-reserva (mantener) + C-no-crudo (fail-closed) + C-no-BI/no-HTML.

## Gates (antes de cerrar)
`tsc` + `lint` + `arch:check` + `test:unit` COMPLETO. Sin migración (schema intacto).

## Orden / dependencias / riesgos
- Bloquea 754: sin 778 no se cierra el contacto (deja al padre sin vía). Orden 778 → 752 → 754.
- Riesgo: reabrir la fuga del enlace al exponerlo → mitigado por derivación única + C-visible + C-reserva + fail-closed.
- Riesgo: inventar copy de estados → prohibido; [DISEÑO].
