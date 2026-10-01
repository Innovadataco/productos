# SPEC-834 · La segunda puerta de creación de franja — gate REPS × modalidad (unitaria)

**Feature Branch**: `work/pi-SPEC-834-gate-reps-franja-unitaria`
**Created**: 2026-10-01
**Status**: IMPLEMENTADO
**Base**: `main` (`a513f6a4f`)
**Origen**: RADICADO-SPEC-834. SPEC-825 pieza 2 puso el cinturón REPS en la creación de franjas pero nombró
un solo mecanismo (`materializarFranjas`, el LOTE). Dev-1 midió que hay DOS puertas: el lote y la UNITARIA
(`franjas/route.ts`), y la unitaria validaba banderas sin REPS. Esta SPEC cierra la unitaria.

## Por qué (NO es defensa en profundidad)
El daño de la puerta unitaria ya está contenido: la pieza 1 de 825 oculta la franja del padre y el contrato
de 828 la rechaza al reservar. Lo que justifica la SPEC es QUIÉN está del otro lado: la unitaria es el único
momento en que se le dice al PROFESIONAL —el único que puede arreglarlo— que la franja que acaba de publicar
no sirve, justo al publicarla. Si solo se oculta, publica al vacío y nunca sabe por qué nadie le reserva.
Es la contracara del límite silencioso: no esconderle al que puede actuar que su acción no sirvió.

## Alcance (VEREDICTO A del CEO) — el HUECO DE MODALIDAD puro
`franjas/route.ts` (POST) rechaza publicar una franja cuando el REPS del profesional está al día en vigencia
pero NO cubre la modalidad de la franja:

    rechaza  ⟺  repsAlDia(perfil) = true  ∧  ¬esRepsElegibleParaModalidad(perfil, modalidadReps)

- **Fuente única, sin reimplementar criterio:** mapeo `modalidadRepsRequerida` (VIRTUAL→TELEMEDICINA) +
  criterio `esRepsElegibleParaModalidad` (SPEC-790 T4 · motor `repsElegible`), el MISMO par que el contrato
  de reserva (828). `repsAlDia` (vigencia-only) separa el hueco de modalidad de las causas de vigencia.
- **Mensaje al profesional** (copy de Diseño, FORMA-SPEC834 v1.0, commit `95a0d5a` en Gestión, voz usted),
  dos formas elegidas por DATO:
  - (a) con pivote: «No pudimos publicar esta franja: su inscripción en el registro no cubre la modalidad
    {modalidad} ahora. Renueve su inscripción o publíquela en {otraModalidad}.»
  - (b) sin pivote: «… Renueve su inscripción para volver a publicar.»
  El pivote se ofrece SOLO si la otra modalidad es publicable = la ATIENDE ∧ su REPS la cubre. El `atiende`
  se suma a lo que nombra la forma (`esRepsElegibleParaModalidad(otra)`) porque la compuerta de banderas
  está DELANTE de esta: sin él, el pivote prometería una publicación que esa compuerta rechaza — la segunda
  promesa falsa que el mensaje existe para no hacer.

## Qué NO bloquea 834 (VEREDICTO A) y por qué
Las causas de VIGENCIA —REPS vencido, o nuestro re-chequeo envejecido («estado 7», autoridad aún vigente)—
NO las bloquea esta puerta (`repsAlDia = false`):
1. Bloquear por NUESTRA demora (estado 7) le impediría trabajar a alguien con la inscripción PERFECTA — peor
   que el vacío que deja (A).
2. El vacío de (A) se cura solo: el filtro de 825 es DERIVADO; al re-verificar, sus franjas reaparecen sin
   que nadie toque nada. (B) no tiene esa propiedad.
3. El hueco tiene dueño: 836 pieza 1 le dice al operador que estado 7 es NUESTRO de arreglar.
Esas causas son el aviso de 813, la cola de 836 y el backstop de 828 al reservar. Así, además, el mensaje de
Diseño queda SIEMPRE correcto: nunca le dice «su inscripción no cubre la modalidad» a quien el problema es
nuestra demora. (Medido: con el predicado colapsado el gate mordía en estado 7 y el mensaje mentía.)

## Candados
Candado de CONDUCTA en el POST real (`src/app/api/profesional/franjas/route.test.ts`), afirma la FILA en base:
- hueco de modalidad (VIGENTE presencial-only, publica VIRTUAL) → RECHAZA, 0 filas, y OFRECE pivote a presencial.
- control positivo: modalidad cubierta (presencial, o VIGENTE que cubre TELEMEDICINA) → PUBLICA.
- ALCANCE A: REPS vencida → 834 NO bloquea → PUBLICA (vigencia es 813/828).
- ALCANCE A: estado 7 (re-chequeo envejecido, inscripción cubre la modalidad) → 834 NO bloquea → PUBLICA.
- pivote por DATO: el REPS cubre la otra pero NO la atiende → sin pivote (forma b).
- universo de hoy: SIN_VERIFICAR + cutover abierto → PUBLICA (no encierra a nadie).

Muere por MUTACIÓN en dos sentidos: quitar el gate (caen los de rechazo del hueco) y ampliarlo a
`!esRepsElegibleParaModalidad(modalidad)` sin `repsAlDia` (caen los de ALCANCE A). El mensaje se verifica por
PRESENCIA/AUSENCIA del pivote, no por copy verbatim, para no atar el candado a cada palabra de la forma.

## FUERA de alcance
El lote (SPEC-825 pieza 2, de Dev-1) · el contrato de reserva al reservar (828, en main) · el aviso de
caducidad al profesional (813, en main) · la cola del operador y el aviso del hueco de modalidad (836) · el
filtro de lectura del padre (825 pieza 1).

## Impacto en arquitectura:
- **Esquema / proxy / datos:** SIN cambios. No toca schema, migraciones ni objetos de BD; solo LEE
  `VerificacionReps` a través de métodos ya existentes del repositorio (`repsAlDia`,
  `esRepsElegibleParaModalidad`). No hay radio en catálogo de BD; cero CASCADE.
- **Navegación:** SIN cambios. No toca páginas, layouts ni menú; `arch:check` (menú honesto / puerta≡predicado
  / huérfanos) VERDE.
- **Tests:** +7 candados de conducta en `franjas/route.test.ts` (carril integración; comparten la Postgres de
  test). Sin módulos nuevos → ratchet de huérfanos sin cambios.
