# Plan técnico — SPEC-754

> Compuerta §4: se aprueba ANTES de implementar. La fuente única ya existe (SPEC-395/#715);
> este plan la voltea y migra el reembolso al canal (752). **No se despliega antes que 752.**

## Anclajes (código real, en `main`)

- `src/lib/profesional/cita/contacto-visible.ts` — `contactoVisiblePorSesion(estado)` → hoy `estado === "CONFIRMADA"`. FUENTE ÚNICA.
- `src/lib/profesional/cita/dto.ts` — `debeExponerContacto` (guard perfil + `contactoVisiblePorSesion` + rama reembolso `VENCIDA_SIN_RESPUESTA`+48h) y `toCitaParaProfesional` (usa `contactoVisiblePorSesion`).
- `src/lib/profesional/calendario/calendario.service.ts` — usa `contactoVisiblePorSesion` para el correo del padre.
- Superficies: `EsperaCitaPanel.tsx` (padre → `cita.contactoProfesional`) · `Paneles.tsx` (profesional → `b.contactoEmail`).
- Tests que fijan la conducta VIEJA: `contacto-visible.test.ts`, `dto.test.ts`, y el candado `contacto-fuente-unica.candado.test.ts` (mock, sigue válido).

## Cambios (por pieza)

### 1. Voltear la fuente única (FR-001/002/003)
- `contactoVisiblePorSesion` → `return false`. Reescribir el doc: el DESTINO llegó (SPEC-754); el
  contacto se cierra; el canal es el enlace (750) + PQR (752). Ya no «CONFIRMADA basta».
- Los tres consumidores cierran solos (una función). El complemento de decisores (barrido) confirma
  que no hay un cuarto punto (si aparece → hallazgo).

### 2. Retirar la excepción de reembolso (FR-004 · D-1)
- En `debeExponerContacto`, eliminar la rama `if (estado === "VENCIDA_SIN_RESPUESTA") {…}`. **Comentario
  de DECISIÓN, no línea borrada:** el reembolso MIGRA al canal (752, motivo 2 «Un pago o un cobro»);
  la razón es legal —la reversión corre con plazos contados desde el reclamo y un correo no deja
  constancia de CUÁNDO; la PQR sí—. Enlazar a SPEC-752.
- Resultado: `debeExponerContacto` → `false` (guard perfil + `contactoVisiblePorSesion` false, sin rama
  reembolso). **Decisión de forma del código:** conservar el guard de perfil VENCIDO/SUSPENDIDO como
  defensa documentada (subsumida) **o** simplificar `debeExponerContacto` a delegar en la fuente. Recomiendo
  conservar el guard con un comentario «subsumido por el cierre» para no perder la intención si algún día
  se reabre; no cambiar la firma (evita churn en sus llamadores). → confirmar en revisión.

### 3. Superficies (FR-005)
- Tras el cierre, `cita.contactoProfesional` y `b.contactoEmail` quedan SIEMPRE ausentes → los bloques
  condicionales no pintan. **Revisar encabezados/copys que queden colgando** (p. ej. un título «Contacto»
  sin cuerpo) — si la pantalla afirma algo que ya no es cierto, **PARAR y pedir copy a Diseño** (el copy
  del nuevo estado —«se reúnen por el enlace» / «para un pago o cobro, escríbenos»— es de Diseño).
- No inventar copy. Quitar solo el bloque muerto; el reemplazo lo pone Diseño.

### 4. Candado (C-mutuo · FR-006 de auditoría)
- El candado `contacto-fuente-unica.candado.test.ts` (SPEC-395) YA fuerza la fuente a `false`→ausente y a
  `true`→presente, con el dato REAL plantado, en las TRES superficies (padre, profesional, calendario).
  Eso ES el candado de 754 en las dos direcciones + control positivo. Se conserva; se ajusta el texto a
  «cerrado por defecto».
- Actualizar los tests que fijaban la conducta vieja: `contacto-visible.test.ts` (real → `false` para todos
  los estados, incluido CONFIRMADA), `dto.test.ts` (CONFIRMADA ya no adjunta `contactoProfesional`; la rama
  reembolso ya no expone; `toCitaParaProfesional` no expone el correo). Deben afirmar el estado CERRADO.

### 5. Orden (FR-006 de producto)
- Implementable ya; **deploy después de 752**. No es un mecanismo de código: lo controla el CEO. Lo dejo
  escrito en el PR y en el commit; no despliego.

## Plan de pruebas
- Unit: `contacto-visible.test.ts` (fuente → false), `dto.test.ts` (cerrado en ambos DTOs + reembolso retirado).
- Integración: candado `contacto-fuente-unica` (3 superficies, dato real, ambos controles).
- Gate: `test:unit` COMPLETO + tsc + eslint + arch:check.

## Compuerta
`§4 listo · PARO`. Espero aprobación del CEO (+ el copy de Diseño para las superficies) antes de implementar.
