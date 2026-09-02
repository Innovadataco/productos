# Plan · SPEC-371 · poblador demo v3

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Decisiones

**Se extiende, no se reescribe.** v1 y v2 quedan intactos; la v3 vive en
`_common-v3`, `poblar-demo-v3` y `borrar-demo-v3`, y reusa los helpers comunes
(RNG con semilla, argumentos, auditoría).

**Operarios = comités v1, no usuarios nuevos.** `comiteColegioId @unique` →
un comité por colegio. Crear "operarios" adicionales por colegio exigiría tocar
el modelo; no vale la pena para un demo y el radicado permitía reusar.

**La historia termina en el presente.** `cadenaParaEstado` construye la cadena
que lleva al estado que el reporte YA tiene; así el `Reporte` no se toca y BI ve
un embudo coherente. Los estados que el demo no produce (DUPLICADO,
CORREGIDO…) no reciben historia inventada.

**El comité se representa como en el flujo real.** Escalar = alerta `escalada`
+ `SolicitudComite` PENDIENTE; resolver = solicitud RESUELTA + alerta
`gestionada`. El flujo real no escribe `TransicionReporte` en ese tramo; el demo
tampoco.

**Reparto proporcional, no absoluto.** Fracciones por colegio
(`0.95 · 0.9 · 0.8 · 0.65 · 0.2`), para que en prod (846 alertas) y en dev
(1.424) salgan el mismo ~70 % y el mismo contraste entre operarios.

**Verificación de reales por foto.** No basta con el `where` marcado: se cuenta
total / asignadas / escaladas de las alertas sin marca antes y después, y se
aborta si difieren. Cinturón y tirantes.

**Historia ajena se respeta.** Si un reporte demo ya tiene transiciones que no
son `demo3-`, no se le añade cadena: mejor un reporte sin historia demo que uno
con dos historias.

## Archivos

- `scripts/demo/_common-v3.ts` — constantes, ids, cadena de vida, fechas
  escalonadas, fracciones.
- `scripts/demo/poblar-demo-v3.ts` — plan (operarios, transiciones,
  solicitudes) + escritura en una transacción.
- `scripts/demo/borrar-demo-v3.ts` — reversa exacta en orden inverso.
- `scripts/demo/demo-v3.test.ts` + registro en `vitest.unit.includes.ts`.
