# SPEC-772 · Habeas data registrado y venceable

**Status**: DESARROLLO

**Origen:** Dev-3 midiendo el código para SPEC-752. `src/app/privacidad/page.tsx` §6 (L62-65) promete el derecho de eliminación y lo rutea a «escribir al administrador» — un correo que **no se cuenta, ni se rastrea, ni se vence**. La Ley 1581 fija términos (**consulta 10 · reclamo 15 días hábiles**, arts. 14-15) y hoy **no hay forma de saber si los incumplimos**. Consultar y suprimir NO existen; corregir existe **parcial**. **Carril:** Dev 1 (mecanismo de atrás) · Dev-3 (la puerta, SPEC-752) · Diseño (copy) · Estrategia/[ABOGADO]. **Radicado:** `RADICADO-SPEC-772` · matriz `MATRIZ-CONSERVACION-POR-TIPO-DE-DATO-v2` (leída). **Base:** `main`.

> **Compuerta §4 (DISEÑO):** este `spec.md` + `plan.md` PARAN — el CEO aprueba antes de `tasks.md`+implementación. **La puerta de entrada NO se construye acá:** es el **motivo 1 («Mis datos personales») de la PQR de SPEC-752** (Dev-3). Esta SPEC es el **mecanismo de atrás** (registro venceable + cumplimiento). No se hace una segunda puerta. **Prioridad:** el edit de `ci.yml` de SPEC-774 (cuando entre #752 de Calidad) PREEMPTA esto.

## El patrón a espejar — la Apelación (SPEC-110), no una forma nueva

`src/lib/apelaciones.ts` es exactamente esta forma y funciona: **registrada** y **venceable**, plazo en días hábiles vía **SPEC-768** (`sumarDiasHabilesColombia`, en `main`), estados en enum, `venceEn` calculado al crear. Se **espeja**. Diferencia de sujeto: la apelación es sobre el **identificador reportado**; esta es sobre **los datos del propio titular**. Misma forma, otro sujeto y otro término (10/15 LEGAL, no el interno de 5 de SPEC-752).

## Lo medido (código + matriz, verificado — no de memoria)

### «Corregir» — los cuatro casos fuera del perfil, medidos uno por uno
`PATCH /api/padre/perfil` (SPEC-590) cubre **8 campos del `Usuario`**: email, nombre, apellidos, documentoTipo, documentoNumero, fechaNacimiento, telefono, ciudadId. Fuera de él:

| Dato del titular | ¿Corregible? | Ruta HOY | Para 772 |
|---|---|---|---|
| **Perfil (`Usuario`)** | Sí | `PATCH /api/padre/perfil` (8 campos) | **Reusar** |
| **Hijos/menores (`Alumno`)** | Sí | `PATCH /api/padre/hijos/[id]` **existe** | **Reusar** |
| **Círculo de confianza** | Vista DERIVADA | sin CRUD de «círculo»; el dato base son los **identificadores del acudiente** (`hijos/identificadores/[id]`) | **Reusar** la ruta del dato base |
| **Relato de cita (`SolicitudCita.presentacion`)** | Sí (texto libre del titular, sin ser evidencia) | **NO hay ruta de escritura post-creación** — se fija al crear; reprogramar lo COPIA verbatim; el repo solo actualiza `estado`/`enlaceOperadorId`; ninguna ruta admin/operador lo edita | **→ SPEC-780 (CEO):** se construye el camino sancionado; 772 acepta el motivo de petición y puede cumplirse (2º hallazgo: reprogramar multiplica el dato) |
| **Reporte (`ContenidoReporte`)** | **NO** — inmutable por constitución (evidencia) | — | **3ª TENSIÓN LEGAL** (ver [ABOGADO]) |

> **Falso amigo (barrido):** existe `CorreccionAdmin` pero **NO es ruta de rectificación del titular** — es el admin corrigiendo la **clasificación de la IA**, no el titular corrigiendo **su propio texto**. Sujeto y objeto distintos; no se cuenta como ruta.

### «Suprimir» — por qué NO puede ser por fila ni por tipo (matriz + schema)
- `ContenidoReporte` guarda en la **misma fila** `textoCifrado` (relato, purgable) **y** `textoOriginalCifrado` (**NOT NULL**, evidencia legal), y **una sola `LlaveReporte` (DEK) 1:1** cifra **ambos**. **Hallazgo (verificado en schema):** el cripto-shred (quemar la DEK) es **all-or-nothing de la fila** — NO puede purgar el relato conservando la evidencia con una DEK compartida. Y el original **contiene** el relato: purgar uno dejando el otro no reduce la exposición. → la supresión de contenido de reporte es **[ABOGADO]**, no la resuelve 772.
- El mecanismo de purga EXISTE (`purgadoEn`, cripto-shred vía `LlaveReporte onDelete:Cascade`, política D4) pero es **por política/pedido, no por edad**, y **row-level**.
- **Copias derivadas sobreviven** (matriz p.2): la purga cascada a `DatasetEntrenamiento`/embeddings (SPEC-702) salvo **1 huérfano histórico medido en prod** — «cifrar/purgar el campo no cifra sus derivados»; barrer dataset, embeddings, resúmenes, auditoría antes de afirmar «se purgó».
- **Auditoría de menores = evidencia imprescriptible** (matriz p.3): la purga NO puede alcanzarla — **imposibilidad estructural** (la consulta no la toca por construcción), no un `WHERE`.

### El defecto de la política
`privacidad/page.tsx` §6 promete eliminación «escribiendo al administrador» — sin registro, conteo ni plazo. Afirma una conducta que no existe.

## El arreglo

1. **Modelo REGISTRADO y VENCEABLE** (`SolicitudHabeasData`, espejo de `ApelacionIdentificador`) **con EJE DE SUJETO** (crítico — si entra después es cambio de esquema): `tipo` (`CONSULTA` | `RECTIFICACION` | `SUPRESION`), `estado`, `creadoEn`, **`venceEn` NOT NULL**, `resueltaEn?`, `resultado?`, **+ quién pide y en qué calidad**:
   - `peticionarioUsuarioId` (FK `Usuario`, **NULLABLE** — el caso 3 puede no tener cuenta), `calidad` (`TITULAR_CUENTA` | `REPRESENTANTE_LEGAL` | `TITULAR_MAYORIA_EDAD`).
   - `sujetoDelDato` — de quién es el dato: **puede NO ser el titular de la cuenta que lo contiene** (un menor es un `Alumno`, no un `Usuario`; un ex-menor mayor de edad puede tener cuenta propia o ninguna). El modelo **admite** `peticionario ≠ dueño de la cuenta del dato`. NO se ata la petición a «el peticionario es el padre de la cuenta».
   - **Titulares = TRES** (medido por Estrategia): (1) el reportante, (2) el representante legal del menor (Decreto 1377 art. 12), (3) **el menor que llegó a la mayoría de edad** — titular pleno de datos que otro registró sobre él. El **caso 3 va [NEEDS CLARIFICATION]** (identidad/vínculo — ver [ABOGADO]); §4 **no lo construye**, pero el modelo **no lo hace imposible**.
   - Cuelga del titular/sujeto → **es PII** (seguir FKs, no llamarla «sin PII»).
2. **Término LEGAL, no nuestro:** `CONSULTA` = **10** días hábiles (art. 14); `RECTIFICACION`/`SUPRESION` = **15** (art. 15, «reclamo»). `venceEn = sumarDiasHabilesColombia(creadoEn, plazo)`. **Nunca a mano.** *(Distinto del término interno de 5 de SPEC-752.)*
3. **Estado EFECTIVO — fuente única** (`estadoEfectivoSolicitud`, espejo de `estadoEfectivoDeCita`/#718): deriva de (estado + `venceEn` + `resueltaEn`/`now`) → `EN_TERMINO` | `VENCIDA_SIN_RESOLVER` | `RESUELTA_A_TIEMPO` | `RESUELTA_TARDE`. **Resolver después de `venceEn` NO es «resuelta»: es «resuelta tarde»** — y ningún conteo pierde las tardías (son la prueba del incumplimiento). `now` inyectable, falla conservador.
4. **Los tres derechos, sobre el registro:**
   - **CONSULTAR:** la solicitud se registra; el cumplimiento = exponer/exportar los datos del titular (alcance por la matriz). §4 diseña el registro; el «qué se muestra» referencia las ubicaciones medidas.
   - **RECTIFICAR:** se registra; se ejecuta reusando las rutas que EXISTEN (perfil, hijos, identificadores del círculo). El **relato de cita** no tiene ruta (D-2); el **reporte** es inmutable → 3ª tensión.
   - **SUPRIMIR:** compuerta en el **SERVIDOR** + **identidad verificada del titular** (irreversible). Para datos no-evidencia (perfil, hijos, círculo, cita): supresión registrada. Para **contenido de reporte**: [ABOGADO] (DEK compartida + evidencia + imprescriptibilidad).
5. **Política de privacidad corregida en el MISMO PR:** §6 describe el mecanismo real, no un correo. **Copy = Diseño** ([NEEDS CLARIFICATION]).

## Requisitos funcionales (FR)

- **FR-1:** existe `SolicitudHabeasData` con `venceEn` NOT NULL, calculado con SPEC-768 según el tipo (10/15 hábiles).
- **FR-2:** `estadoEfectivoSolicitud` es la fuente única que distingue resuelta-a-tiempo de resuelta-TARDE e incluye las vencidas-sin-resolver; ningún conteo pierde una tardía.
- **FR-3 (rectificar):** reusa las rutas existentes (perfil/hijos/identificadores); NO duplica. Los huecos (relato de cita) y los bloqueos (reporte inmutable) quedan marcados, no inventados.
- **FR-4 (suprimir):** compuerta servidor + identidad verificada; la supresión de contenido de reporte NO se ejecuta acá (bloqueo [ABOGADO]); las copias derivadas y la auditoría de menores quedan cubiertas por barrido/imposibilidad estructural cuando se implemente.
- **FR-5:** la política de privacidad deja de prometer «escribir al administrador» y describe el mecanismo real (copy de Diseño).
- **FR-6 (eje de sujeto):** el modelo registra **quién pide** (`peticionarioUsuarioId` nullable) y **en qué calidad** (`calidad`), y **admite** que el peticionario NO sea el titular de la cuenta que contiene el dato. El caso 3 (titular mayor de edad) queda [NEEDS CLARIFICATION] pero el modelo no lo hace imposible.

## Criterios de éxito (SC)

- **SC-1:** cada solicitud tiene `venceEn` y su estado efectivo dice la verdad sobre el reloj (una resuelta tarde se cuenta como tarde, no como resuelta).
- **SC-2:** una supresión no se ejecuta sin identidad verificada del titular (compuerta servidor).
- **SC-3:** la política de privacidad no afirma una conducta inexistente.
- **SC-4:** las tres tensiones legales quedan marcadas [ABOGADO], no resueltas por código.

## Escenarios de aceptación (candados)

- **A-1 (estado no miente sobre el reloj):** solicitud resuelta con `resueltaEn > venceEn` → `estadoEfectivoSolicitud` = `RESUELTA_TARDE`, no `RESUELTA_A_TIEMPO`. Mutación: contar «resueltas» sin la distinción → pierde el incumplimiento → el candado lo caza.
- **A-2 (venceEn NOT NULL):** no se puede crear una solicitud sin vencimiento (compuerta de inserción).
- **A-3 (vencimiento, dos direcciones, ancla en finde y festivo):** `venceEn` con `sumarDiasHabilesColombia` cruza correctamente un ancla en sábado y en festivo (los casos que destaparon SPEC-768).
- **A-4 (supresión con identidad):** un pedido de supresión sin la identidad verificada del titular → rechazado en el servidor. Control positivo por remoción de la identidad.
- **A-5 (PII / FKs):** la tabla nueva cuelga del titular y por él del menor → se trata como PII (no «sin PII»).
- **A-6 (término con TECHO estructural, D-3):** guardar un valor operativo **mayor** al máximo legal (10/15) **no se puede** — imposibilidad estructural, no un `WHERE`/comentario. Control positivo: intentar setear 30 → rechazado; setear 7 (≤ techo) → aceptado.
- **A-7 (`esIncumplimiento` coherente resumen↔detalle, D-4):** una solicitud vencida-sin-resolver o resuelta-tarde se ve incumplida **igual** en el conteo/resumen y en el detalle — ambos leen `estadoEfectivoSolicitud`. Mutación: si el resumen contara por `estado` crudo y el detalle por el efectivo → divergen → ROJO.
- **A-8 (negativa por DEBER LEGAL, no por esquema, D-1):** el copy de una supresión denegada de reporte cita el deber de conservación/imprescriptibilidad; **no** menciona cifrado/DEK/esquema. Control positivo: buscar «cifr»/«DEK»/«esquema» en esa cara → no están.
- **A-9 (eje de sujeto, FR-6):** se puede crear una solicitud cuyo `peticionarioUsuarioId` NO sea el dueño de la cuenta que contiene el dato (peticionario ≠ titular de la cuenta). Control positivo: el modelo/insert acepta esa combinación → el caso 3 no es imposible. Mutación: si el modelo atara la petición al `usuarioId` de la cuenta del dato → esa combinación sería inconstruible → ROJO.

## Impacto en arquitectura

**Impacto en arquitectura:** agrega una entidad de proceso (`SolicitudHabeasData`) y su servicio, espejo de la Apelación (SPEC-110), con término LEGAL vía SPEC-768 y una fuente única de estado efectivo (espejo de #718) que distingue lo resuelto-tarde. Reusa las rutas de rectificación existentes (perfil/hijos/identificadores). No construye la puerta de entrada (es SPEC-752). No implementa la supresión de contenido de reporte (bloqueo [ABOGADO] por DEK compartida + evidencia + imprescriptibilidad). Corrige la política de privacidad para que no prometa un mecanismo inexistente.

## [ABOGADO] — CUATRO puntos, marcados, no resueltos por código

1. **Supresión vs conservación** (imprescriptibilidad de delitos contra menores) — matriz 2.7, paquete v5 del abogado.
2. **Consentimiento del operador** (ya en el paquete).
3. **Rectificación vs inmutabilidad del reporte (NUEVA, hallada acá):** la Ley 1581 da derecho de rectificación; la constitución hace el texto del reporte INMUTABLE (evidencia). Un titular que dice «mi reporte tiene un error» no puede corregirlo sin romper la prueba. **HIPÓTESIS del CEO (escrita como hipótesis, NO como diseño):** registrar la corrección como **ADENDA** — el original queda, la corrección se agrega — preserva la evidencia y honra el derecho. **Si eso alcanza legalmente lo decide el abogado, no esta SPEC.** [NEEDS CLARIFICATION]
4. **El titular que llegó a la mayoría de edad (caso 3, hallado por Estrategia):** un ex-menor es hoy titular pleno de datos que otro registró sobre él cuando era menor, y puede tener cuenta propia o ninguna, sobre un expediente que cuelga de la cuenta de su padre. **Cómo se verifica su identidad y se vincula a esos datos** es [NEEDS CLARIFICATION]. §4 **no lo construye**; el modelo solo **lo admite** (eje de sujeto, FR-6) para que no sea imposible después.

## Decisiones (veredicto del CEO · 29-09)

- **D-1 · APROBADA — diferir la supresión de reporte a [ABOGADO], con candado de REDACCIÓN.** 772 construye el registro venceable de las tres solicitudes + la supresión de datos **no-evidencia**; la de contenido de reporte se difiere. **La negativa al padre NUNCA se funda en el esquema** («nuestro cifrado no lo permite» es doble daño: funda la negativa en un hecho falso Y promete implícitamente que borraríamos si pudiéramos). Se funda en el **DEBER LEGAL de conservación** ([NORMA] Decreto 1377 art. 10; Ley 2081/2021 imprescriptibilidad en delitos contra menores). **Pregunta nueva para el abogado (la que destapó esta SPEC):** ¿el relato del padre es **separable** de la evidencia, o el **reporte entero** es evidencia imprescriptible? Alguien diseñó `textoCifrado` como purgable — o sabía algo, o supuso; la DEK compartida hace que esa distinción hoy no exista en la práctica.
- **D-2 · RESUELTA por el CEO: se CONSTRUYE el camino de rectificación → radicado como SPEC-780 (lo radica el CEO, no esta SPEC).** No se declara no-rectificable: la rectificación es un **derecho** (Ley 1581) y negarlo exigiría un fundamento legal que acá **no existe** — el relato de una cita es la descripción que el padre hace para agendar, **no evidencia de un delito bajo deber de conservación** (eso es lo que blinda al reporte). **Para 772 el único cambio:** el motivo de petición **acepta** «corregir el relato de mi cita» y **puede cumplirse** — deja de ser obligación incumplible; el mecanismo lo trae **SPEC-780**, 772 **no lo construye**.
  - **2º hallazgo (va a SPEC-780):** reprogramar **COPIA `presentacion` verbatim** a una fila nueva → el dato **se multiplica**; una rectificación que corrija una fila deja las copias mintiendo («corregir el campo no corrige sus derivados»).
  - **Las tres condiciones de SPEC-780** (772 no asume distinto): (1) rectificar deja **RASTRO**, no sobrescribe en silencio (el profesional ya leyó y actuó sobre ese relato); (2) corrige la solicitud **VIVA**, el historial de la cadena de reprogramación es historial y no se reescribe — **y al padre se le dice qué se corrigió y qué NO**; (3) camino **SANCIONADO** (operador/admin), no autoservicio del padre.
- **D-3 · APROBADA al revés: parametrizable con TECHO, no con piso.** En un plazo legal lo peligroso no es que sea corto — es que sea **largo** (un piso no impide subirlo a 30 y caer en incumplimiento). Entonces: el **máximo legal** (10 consulta / 15 reclamo) es **constante [NORMA]**, no parametrizable; el valor operativo es parametrizable **pero clavado ≤ esa constante** (se puede prometer menos, nunca más); **imposibilidad estructural, no regla** — una configuración inválida (> máximo legal) **no se puede guardar**, no un comentario que diga que no se debe.
- **D-4 · APROBADA — fuente única `estadoEfectivoSolicitud` con `RESUELTA_TARDE`.** Exigencia añadida: **`esIncumplimiento` es fuente única y el RESUMEN y el DETALLE la leen IGUAL, en el MISMO PR** (un resumen «al día» sobre un detalle «vencido» es el defecto que ya nos pasó — [[ceo-imprecision-del-booleano-explota-en-el-detalle]]).
- **D-5 · EJE DE SUJETO en el modelo (exigido por el CEO antes de cerrar §4).** Los titulares son TRES; el modelo lleva `peticionarioUsuarioId` (nullable) + `calidad` + `sujetoDelDato`, y **admite** `peticionario ≠ dueño de la cuenta`. El caso 3 (mayoría de edad) queda [NEEDS CLARIFICATION] — §4 no lo construye, pero **si el eje entra después es cambio de esquema**, por eso va ahora. `CorreccionAdmin` NO es ruta de rectificación (falso amigo). SPEC-780 (relato de cita) sigue siendo del CEO.

## Fuera

La puerta de PQR (SPEC-752, término interno 5 días) · la apelación del identificador (SPEC-110) · **el mecanismo de rectificación del relato de cita (SPEC-780, radicado por el CEO — 772 solo acepta el motivo de petición)** · cualquier borrado masivo/retroactivo · la supresión de contenido de reporte (bloqueo [ABOGADO]) · las tres tensiones legales (abogado) · el barrido de retención por edad general (772 hace el mecanismo de solicitud, no la retención automática por edad — esa es su propia pieza).
