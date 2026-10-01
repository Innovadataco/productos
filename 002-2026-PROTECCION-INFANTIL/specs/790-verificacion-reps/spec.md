# SPEC-790 · Verificar el REPS del profesional, con revisión periódica (MOTOR)

> **Status**: `PLANEADO` · **§4 (compuerta): PARÁ — espera veredicto del CEO (D-1..D-5).**
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
5. **INACTIVO (decisión del CEO, no se re-abre):** sin citas nuevas; **las confirmadas NO se cancelan
   solas** (castigaría a la familia por un trámite del profesional) → sube al admin como decisión.

## 3 · Modelo (propuesta — D-1)

`VerificacionReps` (nombre distinto de `VerificacionProfesional` a propósito):
`{ id, perfilProfesionalId, verificadoEn @db.Timestamptz, estadoReps: EstadoReps, servicioCoincide:
Boolean, modalidadCoincide: Boolean, datosDevueltos: Json (el hecho completo que devolvió el REPS),
fuente: String (dataset-bloque | consulta-individual), creadoEn }`. FK `onDelete: Cascade` al perfil.
`enum EstadoReps { VIGENTE, INACTIVA, NO_ENCONTRADO }` — **separado** de `EstadoPerfilProfesional`.
`repsAlDia` lee la ÚLTIMA fila por `verificadoEn`.

## 4 · Requisitos funcionales

- **FR-1 · HECHO con fecha.** Toda verificación REPS persiste `verificadoEn` + `estadoReps` + lo devuelto.
  Un «verificado» sin fecha es inútil en algo que caduca.
- **FR-2 · `repsAlDia(ultima, now, ventanaDias)` pura.** VIGENTE + servicioCoincide + modalidadCoincide +
  `verificadoEn` dentro de la ventana. Sin fila o fuera de ventana → false (conservador).
- **FR-3 · Compuerta de alta/booking.** El directorio y la creación de cita exigen `repsAlDia` ADEMÁS de
  `estado=ACTIVO`. Un profesional ACTIVO con REPS no-al-día NO es reservable.
- **FR-4 · Revisión periódica.** Recorredor idempotente que re-verifica contra el dataset en bloque y
  registra el HECHO; marca/idempotencia como los otros avisos (`*EnviadoEn`).
- **FR-5 · INACTIVO no cancela citas confirmadas.** Quedar inactivo corta citas NUEVAS; las CONFIRMADAS
  siguen; la decisión de cancelar sube al admin.
- **FR-6 · Falso amigo imposible.** `EstadoReps` y `EstadoPerfilProfesional` son enums distintos; ningún
  camino lee uno como el otro; el gate de REPS y el de `estado` son llamadas separadas.

## 5 · Candados (control positivo por mutación)

| # | Qué vigila | Control |
|---|---|---|
| C-1 | **FR-6** · el falso amigo no vuelve | `EstadoReps` ≠ `EstadoPerfilProfesional` (enums distintos); un perfil ACTIVO + REPS INACTIVA → NO reservable; ACTIVO + REPS VIGENTE+al-día → reservable |
| C-2 | **FR-2** · caducidad | verificación envejecida (fuera de ventana) → NO al día → sin citas; dentro de ventana → al día |
| C-3 | **FR-5** · las confirmadas NO se cancelan | al pasar a INACTIVA, una cita CONFIRMADA sigue CONFIRMADA (probado explícito — el caso que más duele al revés) |
| C-4 | **FR-1** · el hecho lleva fecha | no se puede registrar una verificación sin `verificadoEn` + `estadoReps` |

**NO reconciliar:** si un test existente se pone rojo, es hallazgo.

## 6 · Decisiones para el CEO (compuerta §4)

- **D-1 · Modelo de datos: ¿lo implemento yo o es carril de Datos?** El modelo es el núcleo del motor.
  **Recomiendo** escribir yo la migración + el modelo en esta rama, y marcarla para la **revisión D-121
  de Datos** (el CHECK de coherencia, los índices, Cascade) en el PR — no inventar una ruta de datos
  paralela. → Confirmar.
- **D-2 · El INGESTOR del dataset del REPS: ¿real o estructura con adaptador?** El motor es la derivación +
  la compuerta + la revisión periódica + el hecho con fecha. La descarga/parseo del **dataset en bloque**
  real (URL del Estado, formato) es integración externa cuyo formato lo fija Estrategia. **Recomiendo**
  dejar `consultarReps(documento)` / `ingestarDatasetReps()` como **adaptador con interfaz definida**
  (stub probado por candado), y cablear el dataset real cuando Estrategia pin del formato — el motor
  (lógica, gate, periódica, hecho) queda COMPLETO y testeado sin esa integración. → Confirmar.
- **D-3 · Punto de la compuerta: directorio + creación de cita** (los caminos de cita NUEVA), NO
  `asignarOperadorACita` (eso es el OPERADOR). → Confirmar.
- **D-4 · La ventana de caducidad** (cuándo una verificación «envejeció»): renovación anual → por default
  **365 días**, parametrizable (`reps.ventana_verificacion_dias`) para poder apretar sin desplegar. →
  Confirmar el default.
- **D-5 · `servicioCoincide` / `modalidadCoincide`:** el REPS devuelve el servicio con su MODALIDAD
  (incluye telemedicina). El motor compara contra lo que el profesional ofrece (`atiendeVirtual` /
  `atiendePresencial`). → Confirmar que la correspondencia de modalidad es parte del «al día» (no solo la
  vigencia).

---
> **Impacto en arquitectura:** modelo de datos NUEVO (`VerificacionReps` + `EstadoReps`) + migración
> aditiva (capa 4, revisión D-121 de Datos); derivación pura + servicio de verificación + adaptador de
> ingesta (capa 3); compuerta en el directorio/creación de cita (capa 2/3); recorredor periódico (capa 5,
> worker). Regenerar artefactos de `docs/architecture/` si el barrido lo exige; `arch:check` verde en el PR.
