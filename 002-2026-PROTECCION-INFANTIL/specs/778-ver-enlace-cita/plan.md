# Plan — SPEC-778 · El padre (y el profesional) ven el enlace de la reunión

> Compuerta §4: PARO tras spec+plan+tasks para OK del CEO + copy de Diseño (estados). Implementación DESPUÉS.
> Orden: **778 → 752 → 754**. #743 (754) queda SIN mergear hasta que 778 exista.

## Punto de partida (medido en main, no supuesto)

- `estadoEfectivoDeCita` (SPEC-746, `estado-efectivo.ts`) es la FUENTE ÚNICA del reloj — su doc ya nombra el enlace. **De acá deriva 778** (condición 1 del CEO).
- `enlaceVisibleParaCita` (750) NO tiene llamadores vivos (solo re-export + test); frontera duplicada → NO se usa (queda redundante; retiro/delegación posterior, no en esta SPEC).
- Operador deriva `enlaceEstado` (`publicado`/`sin-enlace`) en `calendario-operador.service.ts:75` (2 estados, sin reloj).
- Columnas de enlace existen (758) y reservadas por nombre (`CAMPOS_INTERNOS_CITA` + `dto-reserva.candado`).
- Padre y profesional NO ven el enlace (medido, alcance DOBLE). Fallback `: nueva` YA fail-closed (750).
- FORMA de Diseño: padre `160fa5f` (3 estados) + profesional §5 `50384ba` («casi nada»).

## Diseño (contrato — lo que aprueba el CEO)

### Derivación (fuente única — condiciones 1 y 2)
1. `derivarEnlaceParaCita(cita, now) → { estado: "SIN_PUBLICAR" | "PUBLICADO" | "PASADA" | "INDETERMINADO", url?: string }` en módulo import-light:
   - `publicado = cita.enlacePublicadoEn != null` (hecho de datos, sin reloj).
   - `relojOK` = validez de `now`/`franjaFin` reusando el normalizador de 746 (input-validity, NO una frontera nueva).
   - `fase = estadoEfectivoDeCita(estado, inicio, fin, now)` (fuente única del reloj — condición 1).
   - **Orden de decisión (condición 2, no miente):**
     - `!relojOK` → **INDETERMINADO** (sin `url`; ni «se pasó» ni «aparecerá»-como-tiempo). Defensivo.
     - `fase == PASADA` (reloj OK) → **PASADA** (sin `url`; la vista de cita de FR-2 muestra «ya pasó»).
     - `!publicado` → **SIN_PUBLICAR** (sin `url`).
     - resto (publicado, fase ∈ {PROXIMA, EN_CURSO}) → **PUBLICADO** + `url`.
   - Exportar de `estado-efectivo.ts` un `relojUtilizable(now)` (o `aEpochMs`) para no reimplementar la validez.

### Superficies (consumo)
2. `toCitaParaPadre` (dto.ts): agrega `enlace = derivarEnlaceParaCita(solicitud, now)`. El `now` ya entra a `toCitaParaPadre`.
3. `toCitaParaProfesional` (dto.ts): idem (usado por `/api/profesional/solicitudes`).
4. `BloqueCalendario` / `calendarioDelProfesional` (calendario.service.ts): agrega `enlace` al bloque, misma derivación.
5. `CitaParaPadreDto`/`CitaParaProfesionalDto`/`BloqueCalendario` ganan el campo `enlace?` (tipo compartido).

### Reserva (mantener)
6. `enlaceOperadorId`/`enlacePublicadoEn` NO se exponen (ni valor). `enlaceReunion` sigue reservado por NOMBRE; su VALOR sale solo bajo `enlace.url`. Ajustar `dto-reserva.candado` para permitir el valor gateado bajo la clave derivada sin aflojar la prohibición de los nombres crudos.

### UI (copy VERBATIM de la FORMA de Diseño)
7. Padre (`EsperaCitaPanel`): SIN_PUBLICAR (ámbar) / PUBLICADO (cielo, botón **[ Entrar a la reunión ]** + «no lo compartas») / PASADA = la vista «ya pasó» de FR-2 (enlace ausente). Copy `160fa5f`.
8. Profesional (`Paneles.tsx` calendario y vista de solicitudes): §5 `50384ba` — botón cuando está, renglón factual cuando no, «ya pasó su hora» cuando pasó; NADA MÁS, sin «no lo compartas».
9. Render: `url` como `href` escapado; nunca `dangerouslySetInnerHTML`. En PUBLICADO NO se pintan adjetivos no controlados (sala/segura/caduca/un solo uso/admisión).
10. INDETERMINADO: rama defensiva; mensaje mínimo honesto (copy a pedir a Diseño si necesita línea propia).

## Candados (fase implementación)
- C-visible por superficie (padre, profesional-solicitudes, profesional-calendario): url real plantada; **cruzar el vivo** (now antes/después de `franjaFin`); publicado/no publicado.
- C-sin-reloj (condición 2): now basura + publicado → sin `url` y la cara NO dice «se pasó»/afirma tiempo (INDETERMINADO).
- C-fuente-reloj (condición 1): la noción de «pasó» sale de `estadoEfectivoDeCita`; un `now < X` nuevo en la derivación → rojo.
- C-copy-sin-adjetivos (FR-008): en PUBLICADO (padre y profesional) buscar «sala|segura|caduca|un solo uso|admit» en la cara del usuario → CERO.
- C-fuente-única + C-reserva (mantener) + C-no-crudo (fail-closed) + C-no-BI/no-HTML.

## Gates (antes de cerrar)
`tsc` + `lint` + `arch:check` + `test:unit` COMPLETO. Sin migración (schema intacto).

## Orden / dependencias / riesgos
- Bloquea 754: sin 778 no se cierra el contacto (deja al padre sin vía). Orden 778 → 752 → 754.
- Riesgo: reabrir la fuga del enlace al exponerlo → mitigado por derivación única + C-visible + C-reserva + fail-closed.
- Riesgo: inventar copy de estados → prohibido; [DISEÑO].
