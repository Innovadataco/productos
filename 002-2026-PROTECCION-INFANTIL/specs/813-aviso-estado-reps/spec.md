# SPEC-813 · Aviso de habilitación REPS al profesional — y `¬repsAlDia` funde CUATRO causas

**Feature Branch**: `work/pi-SPEC-813-aviso-estado-reps`
**Created**: 2026-10-01
**Status**: DESARROLLO (derivación pura HECHA; superficies pendientes de #792 en main + forma v4.0)
**Base**: `main` — **precondición: #792 (SPEC-790) mergeado.** La derivación se adelantó sobre la rama de
#792; como el CEO mergea con `--squash`, al entrar #792 se ramifica LIMPIO de `origin/main` y se
**cherry-pickean** sólo los commits de 813 (NO rebase: el squash reescribe los hashes de #792).

## Contexto

La forma de Diseño dispara el aviso con `habilitado ∧ ¬repsAlDia`. La tabla de readiness (medida contra la
rama de #792) mostró que **`¬repsAlDia` funde CUATRO causas distintas** y el copy sólo describe bien dos.
`¬repsAlDia` no es un estado: es la negación de `repsElegible(últimaFila, modalidad=null, config, now)`,
la ausencia de varias cosas a la vez. Esta spec construye el aviso con el **estado caducado explícito**,
manda tres estados a una alarma de admin, y deja escrito lo que NO entra.

### Los 8 estados medidos (config hoy: `exigirRepsVerificado=false`, ventana 365 d)

| # | Estado del mecanismo | `repsAlDia` | Clasificación (SPEC-813) |
|---|---|---|---|
| 1 | sin fila / nunca cargado | TRUE (cutover) | `SIN_VERIFICAR` |
| 2 | `SIN_VERIFICAR` | TRUE (cutover) | `SIN_VERIFICAR` |
| 3 | `VIGENTE`, los dos relojes OK | TRUE | `AL_DIA` |
| 4 | `VENCIDA` | FALSE | **`CADUCADO`** (aviso) |
| 5 | `NO_ENCONTRADA` | FALSE | `REVISION_ADMIN` |
| 6 | `VIGENTE` + `vigenteHasta ≤ now` | FALSE | **`CADUCADO`** (aviso) |
| 7 | `VIGENTE` + `verificadoEn + 365d ≤ now` | FALSE | `REVISION_ADMIN` |
| 8 | `VIGENTE` + `vigenteHasta = null` | FALSE | `REVISION_ADMIN` |

## Decisiones del CEO (no re-deliberar)

1. **Disparador = estado caducado EXPLÍCITO (4 y 6), no `¬repsAlDia`.** Robusto al cierre del cutover: el
   día que `exigirRepsVerificado` pase a `true`, 1 y 2 saldrán de la oferta pero **no** dispararán el aviso
   («sin verificar» no es «caducado»; un disparador por `¬repsAlDia` afirmaría «lo verificamos… no vigente»
   siendo mentira).
2. **5, 7 y 8 → alarma de ADMIN, no al profesional. Excluir ≠ silenciar.** El 7 es el caso fino: la
   autoridad lo sigue dando por vigente; lo que venció es NUESTRO re-chequeo → decirle «renueve» lo culpa
   de nuestra desactualización y es un callejón (la acción es del admin).
3. **§2-bis PARCIAL por modalidad FUERA de v1.** `repsAlDia` corre con `modalidad=null` → salta el reloj de
   modalidad → es todo-o-nada por vigencia. El por-modalidad vive en la compuerta de RESERVA
   (`esRepsElegibleParaModalidad`), donde el padre no puede reservar lo no cubierto. No se construye una
   derivación de perfil para un banner informativo.
4. **La promesa de REASIGNACIÓN FUERA.** No existe reasignador de citas para el admin (sólo el manual del
   padre). Es T7 (SPEC-814, Dev 2) y es [NORMA] (Res. 3100 art. 19). Prometerla sin construirla es peor que
   no nombrarla.

## Alcance

- **Derivación pura (HECHA):** `clasificarAvisoReps(hecho, config, now)` →
  `{ AL_DIA · SIN_VERIFICAR · CADUCADO · REVISION_ADMIN }`, discriminando por HECHO + relojes (no por el
  `motivo` string: 6, 7 y 8 comparten `estado=VIGENTE`). `src/lib/profesional/reps/aviso-estado-reps.ts`.
- **Aviso al profesional (PENDIENTE #792 en main + forma v4.0):** banner en su superficie, disparado por
  `debeMostrarAvisoCaducadoReps` (4 y 6), consumiendo `repsAlDia` ya expuesto en `/api/me` (#792).
- **Canal de admin (PENDIENTE):** 5, 7 y 8 llegan a una superficie de admin (candado: no construir un
  silencio nuevo).

## Fuera de alcance

El banner PARCIAL por modalidad (decisión 3) · la reasignación/reubicación (decisión 4, es SPEC-814 /
Dev 2) · cambiar `exigirRepsVerificado` · tocar la compuerta de reserva (ya hace lo correcto por modalidad).

## Estado 8 (consulta del CEO: ¿imposible o cuántas filas?)

**IMPOSIBLE, no «casi».** El CHECK `VerificacionReps_vigente_exige_vigencia_check`
(`resultado <> 'VIGENTE' OR vigenteHasta IS NOT NULL`) es **VALIDADO** (la tabla nace vacía) → un `VIGENTE`
sin `vigenteHasta` es inconstruible en la base. Y **ya está lockeado**: `verificacion-reps-datos.candado.test.ts`
(#792 / D-121 de Datos) inserta directo un `VIGENTE`+null y exige el rechazo 23514. La derivación lo
clasifica igual (`REVISION_ADMIN`) por defensa en profundidad fail-closed, pero la base no lo produce.

## Candado

- **`aviso-estado-reps.candado.test.ts` (HECHO, carril `test:unit`):** los 8 estados plantados uno por uno
  con su veredicto (incluido **7 → NO dispara**); control positivo por mutación de UN campo; atado por
  conducta a `repsElegible(..., null, ...)`; exhaustividad (un 5º `EstadoReps` rompe `tsc` por el `switch`
  y se delata en runtime). RED-first verificado: plantar 7→`CADUCADO` lo pone rojo.
- **Candado de copy (PENDIENTE superficie):** heredado del patrón de SPEC-811, sobre el texto RENDERIZADO:
  el participio `habilitad[oa]s?` no se predica del profesional (sustantivo `habilitación` y campo
  `habilitado` permitidos). Ref: `carga-verificacion-reps.candado.test.tsx:1186`.
- **Candado de NO-promesa (PENDIENTE superficie):** con dato real plantado, el aviso no contiene
  afirmación de reasignación/reubicación ni de aviso automático (la v4.0 de Diseño ya lo trae redactado).
- **Candado del canal de admin (PENDIENTE):** 5, 7 y 8 llegan a alguna parte.

## Impacto en arquitectura:

- **Esquema / proxy / datos:** SIN cambios. La derivación es pura, consume el contrato ya definido por #792
  (`HechoReps`/`EstadoReps`); no añade tabla, columna ni migración.
- **Navegación:** la derivación no toca navegación. El aviso (pendiente) agrega un banner en una superficie
  existente del profesional y una alarma en una superficie de admin existente; no agrega pantalla ni ítem
  de menú → `arch:check` (menú honesto) debe quedar VERDE en el PR de las superficies.
- **Tests:** candado de la derivación en el carril `test:unit` (corre y bloquea vía `pi-gate`).
