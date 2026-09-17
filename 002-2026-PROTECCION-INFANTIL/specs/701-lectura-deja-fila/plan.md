# SPEC-701 · Plan

## Impacto en arquitectura

El descifrado del relato tiene DOS capas: el primitivo `descifrarCampo(s)` (`reporte-texto-contenido.ts`, sin auditoría) y la frontera AUDITADA `descifrarCampoReporte(s)` (`descifrar-contenido.ts`, que deja fila en `LecturaReporte`). El arreglo lleva los caminos del personal a la frontera auditada y canda que ninguno se la salte.

- **Parte 1a** — `reportes-revision/[id]/route.ts`: quitar `registrarLectura:false`. Ya corría en `conActor`, así que la fila lleva el actor. Declarar la ruta en `superficie-get-muta` (ahora es GET que audita).
- **Parte 1b** — `comite-apelaciones.ts`: `descifrarCampos` (crudo) → `descifrarCamposReporte` (auditado); la ruta `apelaciones/[id]` envuelve `obtenerDetalle` en `conActor`. Declarar en `superficie-get-muta`.
- **Parte 2** — `codigo-acceso.ts`: `dueno: { eventoId }` → `dueno: { eventoId, reporteId }` cuando el evento tiene reporte (`DuenoContenido` ya admite ambos; `registrarLecturaTexto` ya escribe ambos).
- **Parte 3 (Datos, D-121)** — `LecturaReporte.reporte`/`evento` FK `Cascade → SetNull`. Columnas ya `String?`. Migración a mano. **Se coordina con Datos ANTES del PR.**
- **Parte 4** — candado `lectura-relato-deja-fila.candado.test.ts`.

## Orden de trabajo (candado antes del fix)

1. Candado que hoy queda ROJO (bandeja y comité se saltan la fila). ✔ (mutación: `registrarLectura:false` en la bandeja → rojo).
2. Partes 1a/1b/2 + `superficie-get-muta`.
3. Corregir el test que fijaba «el detalle ni audita ni notifica» → ahora audita (1 fila) pero NO notifica.
4. Parte 3: esquema a Datos (D-121). Mi PR verde después.

## Verificación

- Candado verde + mutación (`registrarLectura:false` → rojo; llamador nuevo sin declarar → rojo).
- Suite de `reportes-revision`, `comite/apelaciones`, `acceso` (pase) sin regresión; el pase deja `reporteId`.
- `arch:check (h)` verde con las dos rutas nuevas en la superficie.
- El recorrido (bandeja/comité/pase dejan fila; borrar reporte conserva la fila) lo camina Calidad tras el deploy.
