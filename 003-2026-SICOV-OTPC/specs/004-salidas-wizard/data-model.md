# Data Model — 004-salidas-wizard

> **Sin tablas nuevas ni migración.** El wizard compone un payload y lo envía al endpoint de despacho existente (US2), que persiste en `sicov.tbl_despachos_solicitudes` (ya modelada). Este documento define los **DTOs** del payload y de las maestras, derivados 1:1 del modelo real (`frontend-gestion-despachos/src/app/despachos/models/Integracion.ts`) y de `salidas-payload.util`.

## Persistencia
- **Reutiliza** `DespachoSolicitud` (`tbl_despachos_solicitudes`) de la feature 001-US2. El wizard NO crea entidades nuevas.
- Consulta integradora y maestras son **read-through** (sin persistencia).

## Payload — `RegistroDespachoIntegracion` (POST /api/integracion/despachos)
```ts
interface RegistroDespachoIntegracion {
  obj_despacho: ObjDespachoIntegracion;
  obj_vehiculo: ObjVehiculoIntegracion;
  obj_conductores: ObjConductoresIntegracion;
  obj_rutas: ObjRutasIntegracion;
  array_autorizaciones?: Record<string, unknown>[];
}
```

### `obj_despacho` (cabecera)
`nitEmpresaTransporte`, `razonSocial`, `sede`("0"), `numeroPasajero`("0"), `valorTiquete` (solo dígitos), `valorTotalTasaUso`("0"), `valorPruebaAlcoholimetria`(""), `tipoDespacho`("1"), `observaciones`, `fechaSalida`, `horaSalida`(HH:mm), `despachoEnTransito`(false). Todos string salvo el bool.

### `obj_vehiculo` (form + respuesta integradora)
`placa`, `soat`, `fechaVencimientoSoat`, `revisionTecnicoMecanica`, `fechaRevisionTecnicoMecanica`, `idPolizaContractual` (← `integradora.polizas.contractual.numeroPoliza`), `idPolizaExtracontractual`, `vigenciaContractual`, `estadoContractual`, `vigenciaExtracontractual`, `estadoExtracontractual`, `tarjetaOperacion` (← `integradora.tarjetaOperacion.numero`), `fechaTarjetaOperacion`, `fechaVencimientoTarjetaOperacion`, `estadoTarjetaOperacion`, `idMatenimientoPreventivo` (← `integradora.mantenimientoPreventivo.id`), `observacionMatenimientoPreventivo`, `fechaMantenimientoPreventivo`, `idMatenimientocorrectivo` (number; ← `mantenimientoCorrectivo.id`), `observacionMatenimientocorrectivo`, `fechaMantenimientocorrectivo`, `idProtocoloAlistamientodiario` (← `alistamientoDiario.id`), `fechaProtocoloAlistamientodiario`, `observacionProtocoloAlistamientodiario`, `observaciones`, `clase`, `nivelServicio`.

### `obj_conductores` (principal + secundario)
Principal: `tipoIdentificacionPrincipal`, `numeroIdentificacion`, `primerNombrePrincipal`, `segundoNombrePrincipal`, `primerApellidoPrincipal`, `segundoApellidoPrincipal`, `idExamenMedico`, `licenciaConduccion`, `fechaVencimientoLicencia`, `idPruebaAlcoholimetria`.
Secundario (sufijo `Secundario`, "" si no aplica): `tipoIdentificacionSecundario`, `numeroIdentificacionSecundario`, nombres/apellidos, `idPruebaAlcoholimetriaSecundario`, `licenciaConduccionSecundario`, `idExamenMedicoSecundario`, `fechaVencimientoLicenciaSecundario`.
Se autocompletan desde `integradora.conductor1`/`conductor2`.

### `obj_rutas` (de maestras)
`idRutaAutorizada`, `idOrigen`, `detalleOrigen`, `idDestino`, `detalleDestino`, `via`, `centroPobladoOrigen`, `centroPobladoDestino`.

### `array_autorizaciones` (opcional, de maestras)
Lista de objetos de autorización seleccionados.

## DTOs de maestras (read-through, stub)
- **RutaMaestra** (de `GET .../maestras/rutas-activas-empresa?nit=`): al menos `idRutaAutorizada`, `idOrigen`, `detalleOrigen`, `idDestino`, `detalleDestino`, `via[]`, centros poblados. Forma exacta `[NEEDS CLARIFICATION]`.
- **AutorizacionMaestra** (de `GET .../maestras/autorizaciones?nit=&placa=&fecha=`): objetos de autorización. Forma exacta `[NEEDS CLARIFICATION]`.

## Constructor de payload (portado)
`src/lib/despachos/payload.ts` con `buildObjDespacho`, `buildObjVehiculo(form, integradora)`, `buildObjConductores(form, integradora)`, `buildObjRutas(rutaSeleccionada)`, y `buildRegistroDespacho(...)`. Helpers `str()` (a String trim) y `num()`. Combina form + `RespuestaIntegradora` (de la feature 003).

## Normalización
Todos los valores a **string** (los numéricos con `String`); `idMatenimientocorrectivo` es `number`. `limpiarPlaca` en placa. Fechas/horas en `America/Bogota`.
