// Constructor del payload de despacho (portado de salidas-payload.util del legacy).
// buildObjVehiculo COMBINA el form con la respuesta de la consulta integradora (feature 003).
import { limpiarPlaca } from "@/lib/normalizar";
import type {
  ObjDespachoIntegracion,
  ObjVehiculoIntegracion,
  ObjConductoresIntegracion,
  ObjRutasIntegracion,
  RegistroDespachoIntegracion,
} from "@/lib/despachos/despacho-tipos";
import type { RespuestaIntegradora } from "@/lib/integracion/integradora-tipos";

type Dict = Record<string, unknown>;

function str(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}
function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function buildObjDespacho(cabecera: Dict): ObjDespachoIntegracion {
  const valorTiquete = str(cabecera["valorTiquete"]).replace(/\D/g, "");
  return {
    nitEmpresaTransporte: str(cabecera["nitEmpresaTransporte"]),
    razonSocial: str(cabecera["razonSocial"]),
    sede: "0",
    numeroPasajero: "0",
    valorTiquete: valorTiquete || "0",
    valorTotalTasaUso: "0",
    valorPruebaAlcoholimetria: "",
    tipoDespacho: "1",
    observaciones: str(cabecera["observaciones"]),
    fechaSalida: str(cabecera["fechaSalida"]),
    horaSalida: str(cabecera["horaSalida"]).slice(0, 5),
    despachoEnTransito: false,
  };
}

export function buildObjVehiculo(
  form: Dict,
  integradora: RespuestaIntegradora | null,
): ObjVehiculoIntegracion {
  const contractual = integradora?.polizas?.contractual;
  const extracontractual = integradora?.polizas?.extracontractual;
  const tobj = integradora?.tarjetaOperacion;
  const mprev = integradora?.mantenimientoPreventivo;
  const mcorr = integradora?.mantenimientoCorrectivo;
  const alist = integradora?.alistamientoDiario;

  const idCorrectivoRaw = mcorr?.id ?? form["idMatenimientocorrectivo"];
  const idCorrectivo = idCorrectivoRaw != null && str(idCorrectivoRaw) !== "" ? num(idCorrectivoRaw) : 0;

  return {
    placa: limpiarPlaca(form["placa"]),
    soat: str(form["soat"]),
    fechaVencimientoSoat: str(form["fechaVencimientoSoat"]),
    revisionTecnicoMecanica: str(form["revisionTecnicoMecanica"]),
    fechaRevisionTecnicoMecanica: str(form["fechaRevisionTecnicoMecanica"]),
    idPolizaContractual: str(contractual?.numeroPoliza ?? form["idPolizasContractual"]),
    idPolizaExtracontractual: str(extracontractual?.numeroPoliza ?? form["idPolizasExtracontractual"]),
    vigenciaContractual: str(contractual?.vencimiento ?? form["vigenciaContractual"]),
    estadoContractual: str(contractual?.estado),
    vigenciaExtracontractual: str(extracontractual?.vencimiento ?? form["vigenciaExtracontractual"]),
    estadoExtracontractual: str(extracontractual?.estado),
    tarjetaOperacion: str(form["tarjetaOperacion"] ?? tobj?.numero),
    fechaTarjetaOperacion: str(tobj?.fechaExpedicion ?? form["fechaTarjetaOperacion"]),
    fechaVencimientoTarjetaOperacion: str(tobj?.vencimiento ?? form["fechaVencimientoTarjetaOperacion"]),
    estadoTarjetaOperacion: str(tobj?.estado),
    idMatenimientoPreventivo: str(mprev?.id ?? form["idMatenimientoPreventivo"]),
    observacionMatenimientoPreventivo: str(mprev?.detalleActividades),
    fechaMantenimientoPreventivo: str(mprev?.fecha ?? form["fechaMantenimiento"]),
    idMatenimientocorrectivo: idCorrectivo,
    observacionMatenimientocorrectivo: str(mcorr?.detalleActividades),
    fechaMantenimientocorrectivo: str(mcorr?.fecha),
    idProtocoloAlistamientodiario: str(alist?.id ?? form["idProtocoloAlistamientodiario"]),
    fechaProtocoloAlistamientodiario: str(alist?.fecha ?? form["fechaProtocoloAlistamientodiario"]),
    observacionProtocoloAlistamientodiario: str(alist?.detalleActividades),
    observaciones: str(form["observaciones"]),
    clase: str(form["clase"]),
    nivelServicio: str(form["nivelServicio"]),
  };
}

export function buildObjConductores(form: Dict, incluirSecundario: boolean): ObjConductoresIntegracion {
  return {
    tipoIdentificacionPrincipal: str(form["tipoIdentificacionPrincipal"]) || "0",
    numeroIdentificacion: str(form["numeroIdentificacion"]),
    primerNombrePrincipal: str(form["primerNombrePrincipal"]),
    segundoNombrePrincipal: str(form["segundoNombrePrincipal"]),
    primerApellidoPrincipal: str(form["primerApellidoPrincipal"]),
    segundoApellidoPrincipal: str(form["segundoApellidoPrincipal"]),
    idExamenMedico: str(form["idExamenMedico"]),
    licenciaConduccion: str(form["licenciaConduccion"]),
    fechaVencimientoLicencia: str(form["fechaVencimientoLicencia"]),
    idPruebaAlcoholimetria: str(form["idPruebaAlcoholimetria"]),
    tipoIdentificacionSecundario: incluirSecundario ? str(form["tipoIdentificacionSecundario"]) || "0" : "0",
    numeroIdentificacionSecundario: incluirSecundario ? str(form["numeroIdentificacionSecundario"]) : "",
    primerNombreSecundario: incluirSecundario ? str(form["primerNombreSecundario"]) : "",
    segundoNombreSecundario: incluirSecundario ? str(form["segundoNombreSecundario"]) : "",
    primerApellidoSecundario: incluirSecundario ? str(form["primerApellidoSecundario"]) : "",
    segundoApellidoSecundario: incluirSecundario ? str(form["segundoApellidoSecundario"]) : "",
    idPruebaAlcoholimetriaSecundario: incluirSecundario ? str(form["idPruebaAlcoholimetriaSecundario"]) : "",
    licenciaConduccionSecundario: incluirSecundario ? str(form["licenciaConduccionSecundario"]) : "",
    idExamenMedicoSecundario: incluirSecundario ? str(form["idExamenMedicoSecundario"]) : "",
    fechaVencimientoLicenciaSecundario: incluirSecundario ? str(form["fechaVencimientoLicenciaSecundario"]) : "",
  };
}

export function buildRegistroDespacho(input: {
  cabecera: Dict;
  vehiculoForm: Dict;
  conductoresForm: Dict;
  ruta: ObjRutasIntegracion;
  integradora: RespuestaIntegradora | null;
  incluirSecundario: boolean;
  autorizaciones?: Record<string, unknown>[];
}): RegistroDespachoIntegracion {
  const payload: RegistroDespachoIntegracion = {
    obj_despacho: buildObjDespacho(input.cabecera),
    obj_vehiculo: buildObjVehiculo(input.vehiculoForm, input.integradora),
    obj_conductores: buildObjConductores(input.conductoresForm, input.incluirSecundario),
    obj_rutas: input.ruta,
  };
  if (input.autorizaciones?.length) {
    payload.array_autorizaciones = input.autorizaciones;
  }
  return payload;
}
