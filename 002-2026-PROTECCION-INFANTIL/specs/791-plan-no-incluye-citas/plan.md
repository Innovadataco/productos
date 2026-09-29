# Plan · SPEC-791 · Ningún plan puede incluir citas

Pieza chica. El QUÉ (la invariante) es del CEO; el CÓMO, estructural.

## Barrido (previo al arreglo)
- Modelo `Plan`/`Suscripcion`: sin campo/relación de citas; sin JSON `beneficios`/`features`; sin camino a
  `SolicitudCita`. `usosMaximosPorCliente` = tope de canje del freemium (falso amigo, verificado). Seed:
  descripciones de acceso a plataforma. **Prod (medido 29-09-2026, CEO/SSH): 11 planes, ninguno menciona
  consultas/citas/sesiones.** → el empaquetado funcional ya es imposible; el candado lo vuelve *incapaz de
  existir*, no solo *inexistente*.

## Implementación
1. **Candado estructural** `src/lib/pagos/plan-sin-citas-incluidas.candado.test.ts` (unit, lee
   `schema.prisma`): morfología, no lista. Falla si `Plan`/`Suscripcion` gana un campo que nombra una
   cita, se relaciona con `SolicitudCita`, o cuenta consultas/sesiones incluidas. Control positivo por
   mutación + control negativo (no marca `usosMaximosPorCliente`, `descripcion`, `consultaPublicaLimite`).
   Registrado en `vitest.unit.includes.ts`.
2. **El porqué escrito junto al candado** (cabecera del test) **y** como comentario `//` en el modelo
   `Plan` del `schema.prisma` (no cambia el datamodel, sin migración).

## Frontera (declarada en spec §4)
El texto libre de `nombre`/`descripcion` NO se cubre acá: la exposición legal está en lo que se OFRECE,
pero un copy comercial se controla con AUTORÍA (Jelkin) + un detector BLANDO de solo lectura contra la
base viva (lo monta el CEO), no con una validación de código que alguien apaga.

## Verificación
`tsc` + `lint` + el candado (control positivo/negativo) + `arch:check` (el comentario `//` no drifta) +
`specs-discipline`.
