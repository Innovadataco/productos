# SPEC-790 · Verificar el REPS del profesional, con revisión periódica (MOTOR)

> **Status**: `DESARROLLO` · **§4 aprobado (veredicto CEO 30-09: D-1..D-8).** Modelo = carril de Datos; el
> motor se construye en paralelo. T1-T7 en curso.
> **Rama**: `work/pi-SPEC-790-verificacion-reps` (base `main`). **Radicado**: `RADICADO-SPEC-790-2026-09-29.md`.
> **Solo el MOTOR.** Superficies FUERA (aviso al profesional = Diseño; vista de la familia = pregunta
> legal de Estrategia). Sirve en la Opción A y no estorba en B.

## 1 · Por qué

**Falso amigo confirmado:** el producto llama «habilitado» al **estado interno de onboarding** del
profesional (`PerfilProfesional.estado` + `VerificacionProfesional`: tarjeta, título, antecedentes) y
**nunca comprueba su inscripción ante el Estado (REPS)**. Si el prestador es el profesional (Opción A),
**que nosotros verifiquemos su inscripción ES el control que hace el modelo defendible.** Hoy no existe.
Y **CADUCA**: inscripción de 4 años → renovaciones anuales; pasa a INACTIVA si no se autoevalúa. Verificar
una vez no alcanza — un verificado hoy puede estar inactivo en un año y le seguiríamos mandando familias.

## 2 · Qué es el MOTOR (alcance)

1. **El HECHO con fecha** — un registro de la verificación REPS: cuándo se verificó y qué devolvió
   (estado vigente/inactiva, servicio, modalidad). Modelo NUEVO, con nombre DISTINTO del interno.
2. **La derivación `repsAlDia`** (pura): el profesional está al día ante el REPS sii su última
   verificación es VIGENTE, el servicio y la modalidad corresponden, y **no envejeció** más allá de la
   ventana (caducidad). Falla conservador: sin verificación / vencida → NO al día.
3. **La compuerta de citas nuevas:** un profesional que NO está al día ante el REPS **no recibe citas
   nuevas** (directorio + creación de la cita). **DISTINTA** del gate interno `estado=ACTIVO` — los dos
   se exigen, pero son cosas separadas (candado del falso amigo).
4. **La revisión PERIÓDICA:** un recorredor que, con el **dataset en bloque** (sin consultas una-a-una),
   re-verifica y registra un nuevo HECHO; idempotente; marca los que envejecieron.
5. **INACTIVO → sin citas nuevas Y el caso se REUBICA** (contrato corregido, `cabe682`). Res. 3100 art. 19
   exige CONTINUIDAD: el caso se reubica a otro **habilitado**; art. 8.5: una sesión confirmada que caería
   DESPUÉS de la inactivación sería **no habilitada** — así que «no cancelar a secas» choca con «no prestar
   sin habilitación». La tercera salida (más humana que cancelar o dejar): **las confirmadas se REASIGNAN**
   a un habilitado; la familia conserva su servicio. Lo que sube al admin es **a QUIÉN se reubica**, no
   «cancelar o no».

## 3 · Modelo (CONTRATO de Datos — D-1, lo implementa Datos con D-121; el motor construye contra él)

`VerificacionReps` = **registro del HECHO, append-only** (nombre distinto de `VerificacionProfesional`):
`verificadoEn` (NOT NULL, **sin default, INMUTABLE**), `fuente` (enum: API / archivo / manual-admin),
`resultado: EstadoReps`, `vigenteHasta` (**nullable** — es la fecha de la AUTORIDAD; no existe si no se
encontró), `modalidades` (**lista** de enum, no booleano), identificadores del prestador, FK al perfil.
**El estado actual se DERIVA de la última fila — NO hay columna de estado mutable** (una columna cacheada
deriva a la realidad, ya nos mordió en prod). `enum EstadoReps { VIGENTE · VENCIDA · NO_ENCONTRADA ·
SIN_VERIFICAR }` — **cuatro** valores (los tres últimos NO son lo mismo; el motor los trata distinto),
**separado** de `EstadoPerfilProfesional` (candado del falso amigo).

## 4 · Requisitos funcionales

- **FR-1 · HECHO con fecha.** Toda verificación REPS persiste `verificadoEn` + `estadoReps` + lo devuelto.
  Un «verificado» sin fecha es inútil en algo que caduca.
- **FR-2 · `repsAlDia` pura · DOS RELOJES (D-4).** Cierra si vence CUALQUIERA: (a) el de la AUTORIDAD —
  `vigenteHasta` del REPS (Res. 3100 art. 10: 4 años + renovación anual) — manda aunque el chequeo sea de
  hoy; (b) el NUESTRO — cuánto confiamos en el último chequeo (`reps.ventana_verificacion_dias`, default
  365, parametrizable). Más la modalidad del servicio en `modalidades` (D-5). Sin REPS con fecha de
  vigencia → `NO_ENCONTRADA`, **nunca «vigente para siempre»**.
- **FR-3 · Compuerta de booking · CUTOVER (D-7).** El directorio y la creación/reasignación/reprogramación
  exigen la elegibilidad REPS ADEMÁS de `estado=ACTIVO` (llamadas SEPARADAS). `VENCIDA` y `NO_ENCONTRADA`
  **cierran SIEMPRE** (sabemos que está mal). `SIN_VERIFICAR` se rige por `EXIGIR_REPS_VERIFICADO`, que
  **ships en `false`** con alarma visible en admin (hoy hay CERO verificados; una compuerta que nadie puede
  liberar es peor que ninguna). Ponerlo en `true` es decisión de Jelkin con fecha. **Prohibido: tratar
  `SIN_VERIFICAR` igual que `VIGENTE` en silencio.**
- **FR-4 · Revisión periódica.** Recorredor idempotente que re-verifica contra el dataset en bloque y
  registra el HECHO; marca/idempotencia como los otros avisos (`*EnviadoEn`).
- **FR-5 · INACTIVO → citas nuevas cortadas + el caso se REUBICA.** Las confirmadas NO se cancelan a secas
  NI se dejan en el profesional inactivo (una sesión posterior sería no habilitada, art. 8.5): se
  **REASIGNAN** a otro profesional **habilitado** (continuidad, art. 19). Lo que sube al admin es **a QUIÉN**
  se reubica. La reubicación **reusa el patrón del asignador** (operadores/citas) **PERO con la dimensión de
  HABILITACIÓN VIGENTE** (no carga/hora) — si el eje no cabe en el asignador actual, se pide, no se fuerza.
- **FR-6 · Falso amigo imposible.** `EstadoReps` y `EstadoPerfilProfesional` son enums distintos; ningún
  camino lee uno como el otro; el gate de REPS y el de `estado` son llamadas separadas.

## 5 · Candados (control positivo por mutación)

| # | Qué vigila | Control |
|---|---|---|
| C-1 | **FR-6** · el falso amigo no vuelve | `EstadoReps` ≠ `EstadoPerfilProfesional` (enums distintos); un perfil ACTIVO + REPS INACTIVA → NO reservable; ACTIVO + REPS VIGENTE+al-día → reservable |
| C-2 | **FR-2** · caducidad | verificación envejecida (fuera de ventana) → NO al día → sin citas; dentro de ventana → al día |
| C-3 | **FR-5** · las confirmadas se REUBICAN (ni canceladas ni dejadas en el inactivo) | al pasar a INACTIVA, una cita CONFIRMADA se REASIGNA a un profesional habilitado — nunca cancelada a secas (art. 19) ni servida por el inactivo (art. 8.5). Control positivo: el destino está habilitado; control negativo: no queda en el inactivo |
| C-4 | **FR-1** · el hecho lleva fecha | no se puede registrar una verificación sin `verificadoEn` + `resultado` |
| C-5 | **FR-3/D-7** · cutover | `VENCIDA`/`NO_ENCONTRADA` cierran siempre; `SIN_VERIFICAR` abre sii `EXIGIR_REPS_VERIFICADO=false`; `SIN_VERIFICAR` nunca == `VIGENTE`; el stub nunca devuelve `VIGENTE` |
| C-6 | **D-8** · compuerta derivada del ÁRBOL | toda ruta/consulta que reserva o reubica un profesional pasa por la elegibilidad REPS (barrido del árbol, no lista a mano) |

**NO reconciliar:** si un test existente se pone rojo, es hallazgo.

## 6 · Decisiones (VEREDICTO CEO 30-09: arrancá T1-T7)

> D-1 → **Datos** (yo construyo contra el contrato del §3). D-2 **aprobado** (stub que NUNCA devuelve
> VIGENTE; hueco-funcional). D-3 **aprobado en dirección, el ALCANCE es la lista de puertas enumerada** (no
> dos puertas). D-4 **corregido: DOS relojes** (FR-2). D-5 **aprobado** (`modalidades` lista). D-6
> **aprobado** (eje de habilitación medido: NO va en el asignador de operadores; retroactividad solo se
> REGISTRA). **+D-7 (cutover) y +D-8 (candado del árbol), abajo.**


- **D-1 · Modelo de datos: ¿lo implemento yo o es carril de Datos?** El modelo es el núcleo del motor.
  **Recomiendo** escribir yo la migración + el modelo en esta rama, y marcarla para la **revisión D-121
  de Datos** (el CHECK de coherencia, los índices, Cascade) en el PR — no inventar una ruta de datos
  paralela. → Confirmar.
- **D-2 · El INGESTOR del dataset del REPS: ¿real o estructura con adaptador?** El motor es la derivación +
  la compuerta + la revisión periódica + el hecho con fecha. La descarga/parseo del **dataset en bloque**
  real (URL del Estado, formato) es integración externa cuyo formato lo fija Estrategia. `consultarReps`
  / `ingestarDatasetReps` = **adaptador con interfaz definida**; el stub **NUNCA devuelve VIGENTE**
  (devuelve `SIN_VERIFICAR` o levanta «no configurado» — un stub que fabrica verde es degradación
  silenciosa). Declarado `hueco-funcional` con salida autoexigida.
- **D-7 · [CEO] EL CUTOVER (puede parar el producto).** Hoy CERO verificados. `VENCIDA`/`NO_ENCONTRADA` →
  cierran siempre; `SIN_VERIFICAR` → regido por `EXIGIR_REPS_VERIFICADO` (ships `false` + alarma admin;
  `true` lo pone Jelkin con fecha). Nunca `SIN_VERIFICAR` == `VIGENTE` en silencio.
- **D-8 · [CEO] El candado de la compuerta se DERIVA DEL ÁRBOL, no de una lista.** Una lista a mano de
  rutas protegidas envejece con el primer `route.ts` nuevo. El candado barre el árbol de rutas/consultas
  de booking y afirma que toda puerta que reserva/reubica un profesional pasa por la elegibilidad REPS.
  Realizado ya en dos planos sobre el repo del directorio (commit `4162883d9`): (a) ESTRUCTURAL —
  `perfil-profesional-activo-solo-en-builder`: el literal `"ACTIVO"` es PROPIEDAD de `whereDirectorioPublico`;
  ninguna lectura lo compone a mano (control positivo por mutación). (b) CONDUCTA —
  `perfil-profesional-directorio-vigencia` cubre las CUATRO lecturas. El barrido del árbol de **rutas** de
  booking (reasignar/reprogramar/reubicación) se cierra en T4/T7, cuando `repsAlDia` entra al builder.
- **D-3 · Punto de la compuerta: el builder `whereDirectorioPublico`** (dueño ÚNICO del predicado del
  directorio — campos obligatorios al final, un `extra` del llamador no los sobreescribe), NO
  `asignarOperadorACita` (eso es el OPERADOR, D-6a). Las puertas de cita NUEVA se apoyan en él:
  (1) `POST /api/padre/citas` → `crearSolicitudCita` → `obtenerPublicoPorId`; (2) el directorio
  (`listarActivos` · `contarActivos` · `facetas`); (3) `/reasignar`; (4) `/reprogramar`; (5) la reubicación
  de §4 (el admin elige del directorio habilitado). **Hallazgo del CEO (cerrado, `4162883d9`): `facetas`,
  4º consumidor, NO pasaba por el builder** —copiaba `estado:"ACTIVO"` a mano, sin `vigenciaVigente`— y ya
  filtraba la vigencia hoy; metido al builder + filtro autoritativo para que herede también el REPS.
- **D-4 · La ventana de caducidad** (cuándo una verificación «envejeció»): renovación anual → por default
  **365 días**, parametrizable (`reps.ventana_verificacion_dias`) para poder apretar sin desplegar. →
  Confirmar el default.
- **D-5 · `servicioCoincide` / `modalidadCoincide`:** el REPS devuelve el servicio con su MODALIDAD
  (incluye telemedicina). El motor compara contra lo que el profesional ofrece (`atiendeVirtual` /
  `atiendePresencial`). → Confirmar que la correspondencia de modalidad es parte del «al día» (no solo la
  vigencia).
- **D-6 · [contrato corregido `cabe682`] REUBICACIÓN de las confirmadas.** Dos piezas que PIDO antes de
  implementar: (a) **La dimensión del asignador.** La reubicación reusa el patrón de los asignadores
  (operadores/citas), pero su filtro es **HABILITACIÓN VIGENTE** (REPS al día + `estado=ACTIVO`), no carga
  ni hora. **¿El asignador actual admite ese eje, o hay que agregarlo?** Lo mido en la implementación y, si
  falta, lo pido — no fuerzo un asignador sin la dimensión nueva (ya nos pasó dos veces). (b)
  **Retroactividad: NO la modelo como resuelta.** «Lo previo es válido hacia adelante salvo que la causal
  sea *nunca cumplió*» — esa distinción la decide el abogado por la causal REAL. El motor **registra la
  causal/el hecho** y NO decide por sí mismo si lo pasado fue inválido (no un booleano «era válido»). →
  Confirmar que el motor solo registra la causal y deja la retroactividad para el abogado.

---
> **Impacto en arquitectura:** modelo de datos NUEVO (`VerificacionReps` + `EstadoReps`) + migración
> aditiva (capa 4, revisión D-121 de Datos); derivación pura + servicio de verificación + adaptador de
> ingesta (capa 3); compuerta en el directorio/creación de cita (capa 2/3); recorredor periódico (capa 5,
> worker). Regenerar artefactos de `docs/architecture/` si el barrido lo exige; `arch:check` verde en el PR.
