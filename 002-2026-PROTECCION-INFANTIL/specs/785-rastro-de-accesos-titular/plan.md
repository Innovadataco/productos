# Plan — SPEC-785 · Rastro de accesos del titular (MOTOR)

## Fuente y por qué
`LecturaReporte` (SPEC-584), no `AuditLog`: `rol` INSTANTÁNEA del momento (AuditLog daría el rol
actual, que reescribe el pasado) y SIN campo de metadatos (fuga imposible por construcción). Decisión
de modelo del CEO tras medición.

## Diseño (motor, sin superficie)
1. `LecturaReporteRepository.rastroDeAccesosDelTitular(titularId, limite)`: `findMany` con
   `where` por titular en las DOS direcciones (`reporte.usuarioId` O `evento.expediente.padreUsuarioId`)
   y exclusión de autoacceso conservando lector anonimizado (`OR usuarioId null / not titular`).
   `select` LISTA BLANCA: momento/rol/tipoActor/campo. Q-3: en el DAL.
2. `rastroDeAccesosDelTitular` (service): mapea a `AccesoAlDatoTitularDto` (momento ISO). Consulta PURA.
3. `hueco-funcional` en la allowlist de huérfanos (salida: cuando SPEC-772 p2 importe el motor).

## Límites declarados (en spec.md)
- L-1 alcance (círculo fuera; nunca «todos los accesos»); L-2 autoacceso/suplantación.

## Candados
- C-fuga-otra-familia (dato real, dos direcciones, control positivo) · C-sin-crudos · C-autoacceso
  (self fuera; lector anonimizado dentro). Integración (BD real: LecturaReporte + Reporte/Expediente).

## Gates
`tsc` + `lint` + `arch:check` + `test:unit` + candado de integración (BD).

## Orden / dependencias
Sin dependencia de despliegue. La superficie llega con SPEC-772 p2 y quita el hueco-funcional.
