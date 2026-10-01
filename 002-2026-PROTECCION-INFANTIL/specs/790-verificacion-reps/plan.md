# Plan · SPEC-790 · Verificar el REPS (MOTOR)

> **PARÁ en §4.** La implementación espera aprobación del CEO (D-1..D-5). Nada marcado salvo el diseño.

## Barrido (medido)
- El «habilitado» interno = `PerfilProfesional.estado` (BORRADOR/EN_REVISION/ACTIVO/RECHAZADO/VENCIDO/
  SUSPENDIDO) + `VerificacionProfesional` (tarjeta/título/antecedentes, con `venceEn`). **Ninguno toca el
  REPS.** La elección del profesional la hace el padre en el directorio/creación de cita (gate por ACTIVO);
  `asignarOperadorACita` es el OPERADOR, no el profesional.

## Diseño (tras aprobación §4)
1. **Modelo** `VerificacionReps` + `enum EstadoReps` (nombres distintos del interno — candado del falso
   amigo). Migración aditiva; revisión D-121 de Datos (CHECK, índices, Cascade).
2. **Derivación pura** `repsAlDia(ultima, now, ventanaDias)` + su candado (C-2 caducidad, control positivo).
3. **Adaptador de ingesta** `consultarReps` / `ingestarDatasetReps` (interfaz definida; dataset real
   pendiente del formato de Estrategia; stub probado).
4. **Compuerta** en el directorio + creación de cita: `estado=ACTIVO` **y** `repsAlDia`, como dos llamadas
   SEPARADAS. Candado C-1 (falso amigo).
5. **Recorredor periódico** (worker) idempotente que re-verifica contra el dataset en bloque y registra el
   HECHO con fecha. Candado C-4 (hecho con fecha).
6. **INACTIVO** no cancela confirmadas (C-3) → sube al admin como decisión.

## Candados
C-1 falso amigo · C-2 caducidad · C-3 confirmadas-no-se-cancelan · C-4 hecho-con-fecha. Control positivo
por mutación. NO reconciliar.

## Verificación
`tsc` · `lint` · candados · `arch:check` (artefactos + D-121 de Datos) · `specs-discipline`. Recorrido
caminado: post-deploy (no hay deploy hoy; motor sin superficie).
