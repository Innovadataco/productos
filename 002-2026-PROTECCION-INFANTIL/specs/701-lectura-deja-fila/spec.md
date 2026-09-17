# SPEC-701 (I-421) · Toda lectura del relato por el personal deja rastro, nombra el reporte y sobrevive al borrado

**Status**: DESARROLLO

**Origen:** I-421 y su ampliación (CEO, 16 y 17-09). **Carril:** Dev 1 · Datos (D-121 del cambio de FK) · Calidad. **Orden:** después de #698; es protección del relato, va antes que lo nuevo.

## El defecto

Los delitos sexuales contra menores no prescriben (Ley 2081/2021). La pregunta «¿quién del personal leyó este relato?» puede aparecer años después. Hoy hay caminos por donde el personal ve el relato completo y NO queda fila en `LecturaReporte`:

- **Bandeja de revisión** (`api/admin/reportes-revision/[id]/route.ts`) descifra con `registrarLectura:false` (SPEC-592, «el render no es una acción de lectura»). Se puso para no avisarle al padre en cada vista — pero SPEC-594 ya sacó el aviso de esta frontera, así que quedaban ACOPLADOS dos asuntos distintos (el aviso al padre y el rastro) sin razón.
- **Detalle de apelaciones del comité** (`comite-apelaciones.ts`) leía por la primitiva cruda `descifrarCampos`, sin pasar por la frontera auditada. El comité ve los relatos de TODOS los reportes del identificador — sin rastro.

Además: la lectura por PASE (SPEC-699) audita con `dueno: { eventoId }` y deja `reporteId` NULL; y las FK `LecturaReporte.reporteId`/`eventoId` son `Cascade`, así que borrar un reporte o una anotación borra el rastro de quién los leyó.

## El arreglo (4 partes)

1. **Cada lectura del personal deja fila.** La bandeja deja de usar `registrarLectura:false` (pasa por la frontera auditada, deja fila con el actor). El detalle del comité pasa por `descifrarCamposReporte` (frontera auditada) dentro de `conActor` (actor del comité). Ambas rutas se declaran en `superficie-get-muta` (GET que audita).
2. **La fila nombra el reporte.** El pase pasa `dueno: { eventoId, reporteId }` cuando el evento tiene reporte (un evento MANUAL queda solo con `eventoId`).
3. **Conservación de 20 años.** Las FK `LecturaReporte.reporteId` y `eventoId` pasan de `Cascade` a `SetNull`: la fila sobrevive al borrado del reporte/evento, con su `contenidoId` y su `hashContenido`. **Migración a mano · D-121 de Datos** (coordinado antes del PR — «esquema a Datos primero»).
4. **Candado derivado de los llamadores.** Ningún camino de descifrado hacia una persona del personal se salta la fila.

## El candado (`lectura-relato-deja-fila.candado.test.ts`)

Dos checks, derivados de los llamadores del descifrado:
- **(1)** Todo llamador DIRECTO del primitivo `descifrarCampo(s)` (que NO deja fila) está declarado con su razón. Excepciones escritas: la propia frontera auditada, las lecturas del **propio padre** (su relato, su PDF, su timeline) y los procesos **automáticos** (clasificar, anonimizar, motor, re-sellar, reactivar-embedding, arnés E2E). Un llamador nuevo del personal sin declarar → rojo.
- **(2)** Ningún camino usa `registrarLectura:false` — la frontera auditada SIEMPRE deja fila. **Control positivo:** volver a ponerlo en la bandeja → rojo.

El candado ya cazó dos llamadores que la enumeración a mano se saltó (`expediente-vivo`, `e2e/helpers`): la propiedad «derivado del árbol, no de una lista» funcionando.

## Impacto

**Impacto en arquitectura:** el rastro de lectura del relato queda gobernado por la FRONTERA AUDITADA (`descifrar-contenido.ts`), no por cada ruta; un candado derivado de los llamadores impide que un camino nuevo del personal se la salte. El único cambio de esquema (parte 3) es de FK (`Cascade → SetNull`, columnas ya nullable) y va por el carril de Datos (D-121). Las lecturas del propio padre y las automáticas son EXCEPCIONES escritas, no omisiones.

## Fuera

- El **motor** no se toca (proceso automático). · El **aviso al padre** sigue reservado a las acciones explícitas (SPEC-594): el rastro y el aviso son cosas distintas. · La reactivación de un reporte purgado (embedding) sigue siendo automática.
