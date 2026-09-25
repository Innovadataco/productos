# SPEC-732 · Unificar «Calendario» y «Citaciones» del profesional en una sola pantalla

**Status**: DESARROLLO

**Origen:** Jelkin (24-09): «/calendario y /citaciones — ¿cuál es la diferencia? ¿se puede unificar?». **Carril:** Dev 1 (dueño del calendario, SPEC-714/730) · Diseño. **Radicado:** `RADICADO-SPEC-732-2026-09-24.md`. **Forma:** `FORMA-SPEC732-CALENDARIO-CITACIONES-UNA-PANTALLA-2026-09-24.md`. Sobre la rejilla ya extraída en SPEC-730 (main `d01f19df`). Voz **usted** (profesional).

## Por qué nace

`/calendario` y `/citaciones` ya montaban el MISMO componente (`CalendarioProfesional`), solo cambiaba con qué lideraba (`modo="calendario"` publicar vs `modo="citaciones"` responder). Dos ítems de menú para una pantalla es la confusión que Jelkin encontró. Se unifican en UNA entrada — un calendario, no dos.

## Qué se hace

1. **Un solo ítem «Calendario»**, una sola pantalla: el profesional publica franjas **Y** ve/responde solicitudes sin cambiar de lugar.
2. **Las solicitudes suben como aviso DENTRO del calendario** (no se pierden): cuando hay pendientes, la tira «Esperando su respuesta · N por responder» lidera arriba, y las franjas ámbar (`PAGADA_PENDIENTE`) → Confirmar / No puedo. La campanita con su badge sigue igual. Esto absorbe el antiguo `modo="citaciones"` — ya no es una pantalla aparte, es el énfasis de arriba cuando toca.
3. **Retirar la entrada duplicada sin dejar hueco:** «Citaciones» sale del menú (`menu-por-estado.ts`, `nav-items.ts`); `/dashboard/profesional/citaciones` **redirige** a `/calendario` (no 404, disciplina SPEC-723) como stub de redirect puro.
4. **El módulo se unifica:** `profesional_citaciones` se retira del grant, del nav y del catálogo; responder solicitudes lo gatea ahora `profesional_calendario` (mismo módulo que la pantalla). Sin catálogo, ADMIN deja de recibirlo y ningún módulo queda solo-NAV (SPEC-496).

## Candado

`calendario-unificado.candado.test.ts`: el menú no tiene «Citaciones» y lleva al calendario por UNA entrada; `/citaciones` redirige a `/calendario` (no monta pantalla); la única pantalla publica (`POST /api/profesional/franjas`) Y responde (`/api/profesional/solicitudes/…`); responder lo gatea `profesional_calendario`. Ajustados: `menu-por-estado.candado` (labels/OPERATIVAS), `guardia-habilitado.candado` (exención de stub de redirect puro), `menu.candado` (4 módulos del profesional).

## Impacto en arquitectura: 

Sin modelo de datos nuevo. Se retira el módulo de permiso `profesional_citaciones` (catálogo + grant); su superficie de responder pasa a `profesional_calendario`. La ruta `/dashboard/profesional/citaciones` pasa a redirect. `arch:check` (puerta≡predicado, menú honesto) queda verde sin regenerar artefactos. **Nota (Datos/CEO):** en BD viva puede quedar un grant/ModuloPermiso de `profesional_citaciones` inerte (nada lo exige); reconciliarlo es limpieza opcional por el carril de seed/scripts (no bloquea, no cambia acceso).
