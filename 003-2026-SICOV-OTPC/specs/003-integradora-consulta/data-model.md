# Data Model — 003-integradora-consulta

> La consulta integradora es **de solo lectura y síncrona**: **NO crea tablas** ni persiste resultados. Este documento modela los **DTOs** de request/response, derivados 1:1 del modelo real del frontend (`frontend-gestion-despachos/src/app/despachos/models/Integradora.ts`). Sin cambios de esquema Prisma (sin migración).

## Sin persistencia
- No hay nueva tabla `sicov.*`. La consulta atraviesa hacia la Super (o el stub) y devuelve el resultado al cliente.
- Posible caché/auditoría de consultas queda como **deuda futura** (no en esta feature).

## Request — `SolicitudIntegradora`
| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `placa` | string | sí | se normaliza con `limpiarPlaca` |
| `numeroIdentificacion1` | string | sí | conductor principal |
| `numeroIdentificacion2` | string | no | segundo conductor |
| `nit` | string | no | si falta, se usa el NIT efectivo de sesión (herencia rol 3) |
| `fechaConsulta` | string (YYYY-MM-DD) | sí | zona America/Bogota |
| `horaConsulta` | string (HH:mm) | condicional | requerido si `fechaConsulta` ≠ hoy |

## Response — `RespuestaIntegradora` (DTOs, del modelo real)
```ts
interface RespuestaIntegradora {
  conductor1: Conductor;
  conductor2: Conductor;          // vacío si no aplica
  vehiculo: Vehiculo;
  polizas: { contractual: Poliza; extracontractual: Poliza };
  tarjetaOperacion: TarjetaOperacion;
  mantenimientoPreventivo: Mantenimiento;
  mantenimientoCorrectivo: Mantenimiento;
  alistamientoDiario: Mantenimiento;
  autorizaciones: unknown[];
  empresa: Empresa;
}

interface Conductor {
  persona: Persona;               // tipoDocumento, numeroIdentificacion, nombres/apellidos
  licencia: Licencia;             // numeroLicencia, estado, fechaVencimiento
  alcoholimetria: Alcoholimetria; // resultado, grado, fecha, hora, codigo
  examenMedico: ExamenMedico;     // resultado, fecha, hora, codigo
  aptitudFisica: AptitudFisica;   // resultado, fecha, hora, codigo
}

interface Vehiculo {
  placa: string; claseVehiculoCodigo: number; claseVehiculo: string;
  numeroSoat: string; soatVencimiento: string;
  numeroRtm: string; rtmVencimiento: string;
}

interface Poliza { numeroPoliza: string; estado: string; vencimiento: string }
interface TarjetaOperacion { numero: string; estado: string; fechaExpedicion: string; vencimiento: string; empresaAsociada: string }
interface Empresa { idEmpresa: string; nit: string; razonSocial: string }
interface Mantenimiento { detalleActividades: string; fecha: string; id: string }
interface Persona { tipoDocumento, numeroIdentificacion, nombres, apellidos, primerNombre, segundoNombre, primerApellido, segundoApellido }
interface Licencia { numeroLicencia, estado, fechaVencimiento }
interface Alcoholimetria { resultado, grado, fecha, hora, codigo }
interface ExamenMedico { resultado, fecha, hora, codigo }
interface AptitudFisica { resultado, fecha, hora, codigo }
```
Ubicación propuesta: `src/lib/integracion/integradora-tipos.ts`.

## Normalización de la respuesta externa
El envoltorio real puede venir como `{ obj: {...} }` o directo. Leer con `parsed.obj ?? parsed` (paridad `salidas-integradora.util.ts`) y tolerar snake/camel. La respuesta del stub se entrega ya en la forma `RespuestaIntegradora`.

## Datos para el stub (documentos vigentes)
El `ClienteStub` devuelve un `RespuestaIntegradora` de ejemplo con estados "VIGENTE" y fechas de vencimiento futuras, un `conductor1` con la `numeroIdentificacion1` consultada, `vehiculo.placa` = la placa consultada, y `conductor2` vacío salvo que se pase `numeroIdentificacion2`.
