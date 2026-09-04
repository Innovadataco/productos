# SPEC-434 · La ficha del profesional, usable de verdad — cierra I-302

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: Jelkin probando en vivo prod `d0b30369` el 04-09 ~13:4x con `jelkin.carrillo+psico1@gmail.com`. Radicado por CEO idc-66.
**Prueba dura del hueco**: `SELECT count(*) FROM "PerfilProfesional"` = 0 en producción — nadie completó ficha en toda la historia.

## Cambios

### Punto 1 · BLOQUEANTE · país + ciudad (I-302)

- Reemplazado el `<Input label="ID de tu ciudad">` (texto libre, esperaba cuid) por **selector país + `CiudadSearchSelect`** — mismo componente que el reporte y `PerfilPadreForm` (SPEC-115 / SPEC-334). Endpoints `/api/paises` y `/api/ciudades/buscar`.
- **Candado server-side** en `PUT /api/profesional/perfil`: si `ciudadId` no corresponde a una fila en `Ciudad`, devuelve **400 con mensaje humano** ("La ciudad seleccionada no existe. Usá el buscador para elegirla."). Antes: Prisma explotaba con "no Ciudad record found" → 500.
- `PerfilProfesionalPropioDto.ciudad` gana `paisId` (vista propia; H-2 no aplica sobre paisId — igual queda fuera del DTO público) para que la recarga arme el `CiudadSearchSelect` sin fetch extra.

### Punto 2 · Voz Colombia (sin voseo)

- Reemplazado todo verbo en voseo: «Completá»→«Complete», «querés»→«desea», «Subí»→«Suba», «cuando termines/subas»→«cuando termine y suba», etc.
- **Candado permanente** `voz.candado.test.ts` que caza las formas exactas en voseo (comentarios excluidos por `sinComentarios` para no dar falsos positivos con descripción del componente).

### Punto 3 · «Emito factura» fuera de la pantalla

- Retirado el checkbox del formulario. El campo persiste en el modelo, no se pregunta.

### Punto 4 · Años de experiencia · selector 1–50

- Reemplazado `<Input type="number">` por `<Select>` con opciones «1 año», «2 años», …, «50 años».

### Punto 5 · Modal al pasar a EN_REVISION

- Al pasar de `BORRADOR` a `EN_REVISION`, se abre modal con: "Su ficha quedó entregada", explicación de la revisión y del correo pendiente, y un solo botón «Entendido». En ningún momento aparece la cadena `EN_REVISION` a la vista del usuario.
- Si el usuario recarga la pantalla estando ya `EN_REVISION`, se pinta un mensaje humano (no el nombre técnico del estado).

## Candados

- **`route.test.ts`** (2 casos, comportamiento no texto):
  - Ciudad válida (cuid del selector) → 201; fila creada con el `ciudadId` correcto.
  - Ciudad inválida → 400 con mensaje humano; **contraprueba: la respuesta NO contiene "Invalid \`prisma"**.
  - Regresión mostrada: sacar el bloque `if (parsed.data.ciudadId !== undefined ...)` del route pone el test rojo (respuesta 500 con stack de Prisma).
- **`voz.candado.test.ts`**: lista de patrones exactos de voseo con acento agudo final. Excluye comentarios. Se prueba con `[Cc]ompletá`, `querés`, `Subí`, etc. Contrapruebas verificadas: `«completa»` en un JSDoc y `«subió»` (formal, 3ra persona) NO son falsos positivos.

## Verificación

- `tsc --noEmit`: verde.
- `arch:check`: VERDE en los 7 gates.
- `tokens:check`: piso 1079 intacto.
- `npm run lint`: 0 errors.
- Suites nuevas 4/4 (2 route + 2 voz).

## Verificación final (la hace el CEO)

Que exista al menos **una fila en `PerfilProfesional` creada desde la pantalla en producción** (hoy son cero).

## Impacto en arquitectura:

- El DTO propio del profesional expone `ciudad.paisId` — cambio compatible hacia atrás (el público NO cambia, así el candado H-2 del directorio abierto queda intacto).
- La pantalla ya no depende de que el usuario conozca un cuid. Cualquier campo con esa forma («ID de tu X») queda como antipatrón — usar selector con búsqueda del catálogo real.
- El endpoint blinda ciudad inválida antes de tocar Prisma. Patrón aplicable a otras relaciones que hoy caen como 500 (`connect: { id: <input> }` sin validar existencia).

## Observación secundaria del radicado (no bloquea, no incluida)

`GET /api/me → 401` con encabezado «Iniciar sesión» estando dentro de una pantalla que exige sesión. CEO pidió confirmar antes de radicar aparte. No lo toco en este PR — si es real, sale como SPEC follow-up.

## Fuera de alcance

- Modificar el DTO público del profesional (H-2 no lo permite y no es necesario).
- Migrar todos los formularios con el patrón `type=number` de `aniosExperiencia` a `<Select>`. Solo la pantalla del profesional está en el radicado.
- Cambiar la voz de otras pantallas del profesional (verificación, panel). SPEC follow-up si Jelkin lo pide.

## Referencias

- **I-302** (verificado por CEO en logs de prod).
- **SPEC-391** — la ficha original del profesional.
- **SPEC-115** — CiudadSearchSelect (búsqueda en servidor).
- **SPEC-334** — PerfilPadreForm con el mismo patrón país+ciudad.
- Worktree `.worktrees/pi-SPEC-434` desde `origin/main d0b30369d`.
