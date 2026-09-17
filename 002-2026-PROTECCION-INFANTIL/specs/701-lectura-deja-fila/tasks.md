# SPEC-701 · Tasks

## Candado antes del fix
- [x] T1 · Candado `lectura-relato-deja-fila.candado.test.ts` — hoy ROJO (bandeja + comité se saltan la fila). Mutación: `registrarLectura:false` en la bandeja → rojo; llamador nuevo del primitivo sin declarar → rojo.

## Fix (Dev 1)
- [x] T2 · Parte 1a · `reportes-revision/[id]/route.ts`: quitar `registrarLectura:false` → deja fila. Declarar en `superficie-get-muta`.
- [x] T3 · Parte 1b · `comite-apelaciones.ts`: frontera auditada (`descifrarCamposReporte`) + ruta en `conActor`. Declarar en `superficie-get-muta`.
- [x] T4 · Parte 2 · `codigo-acceso.ts`: el pase nombra el reporte (`dueno: { eventoId, reporteId }`).
- [x] T5 · Corregir el test SPEC-592 «ni audita ni notifica» → audita (1 fila), NO notifica. + aserción del `reporteId` del pase.

## Datos (D-121)
- [ ] T6 · Parte 3 · `LecturaReporte.reporte`/`evento` FK `Cascade → SetNull`. Migración a mano. **Coordinado con Datos ANTES del PR** («esquema a Datos primero»).

## Cierre
- [ ] T7 · Preflight (tsc · lint · arch:check · specs-discipline). PR verde. Reportar al CEO. Calidad camina el recorrido.

## Fuera
- El motor no se toca. · El aviso al padre sigue reservado a acciones explícitas (SPEC-594). · Reactivación/embedding sigue automática.
