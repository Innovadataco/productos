# SPEC-701 · Tasks

## Candado antes del fix
- [x] T1 · Candado `lectura-relato-deja-fila.candado.test.ts` — hoy ROJO (bandeja + comité se saltan la fila). Mutación: `registrarLectura:false` en la bandeja → rojo; llamador nuevo del primitivo sin declarar → rojo.

## Fix (Dev 1)
- [x] T2 · Parte 1a · `reportes-revision/[id]/route.ts`: quitar `registrarLectura:false` → deja fila. Declarar en `superficie-get-muta`.
- [x] T3 · Parte 1b · `comite-apelaciones.ts`: frontera auditada (`descifrarCamposReporte`) + ruta en `conActor`. Declarar en `superficie-get-muta`.
- [x] T4 · Parte 2 · `codigo-acceso.ts`: el pase nombra el reporte (`dueno: { eventoId, reporteId }`).
- [x] T5 · Corregir el test SPEC-592 «ni audita ni notifica» → audita (1 fila), NO notifica. + aserción del `reporteId` del pase.

## Datos (D-121)
- [x] T6 · Parte 3 · `LecturaReporte.reporte`/`evento` FK `Cascade → SetNull` (Datos pre-aprobó el diseño; lo escribo yo en esta rama, Datos hace la D-121 final). Migración a mano `20260917073857_spec701_lecturareporte_fk_setnull` (puro swap de constraint, sin DROP INDEX; pasa el candado no-drift-destructivo). Candado de conservación `lectura-reporte-conservacion.candado.test.ts` (borrar Reporte/Evento → la fila sobrevive con reporteId/eventoId=null y contenidoId/hash intactos). Barrido de lectores: `historialPorReporte` filtra por reporteId (seguro con SetNull); nadie asume no-null.

## Cierre
- [ ] T7 · Preflight (tsc · lint · arch:check · specs-discipline). PR verde. Reportar al CEO. Calidad camina el recorrido.

## Fuera
- El motor no se toca. · El aviso al padre sigue reservado a acciones explícitas (SPEC-594). · Reactivación/embedding sigue automática.
