import { describe, it, expect } from "vitest";
import { buildRegistroDespacho, buildObjVehiculo } from "@/lib/despachos/payload";
import type { RespuestaIntegradora } from "@/lib/integracion/integradora-tipos";

const integradora: RespuestaIntegradora = {
  conductor1: {
    persona: { tipoDocumento: "CC", numeroIdentificacion: "123", nombres: "A", apellidos: "B", primerNombre: "A", segundoNombre: "", primerApellido: "B", segundoApellido: "" },
    licencia: { numeroLicencia: "LIC-1", estado: "VIGENTE", fechaVencimiento: "2027-12-31" },
    alcoholimetria: { resultado: "NEGATIVO", grado: "0", fecha: "2026-07-21", hora: "08:00", codigo: "A1" },
    examenMedico: { resultado: "APTO", fecha: "2026-01-01", hora: "09:00", codigo: "E1" },
    aptitudFisica: { resultado: "APTO", fecha: "2026-01-01", hora: "09:30", codigo: "F1" },
  },
  conductor2: null,
  vehiculo: { placa: "ABC123", claseVehiculoCodigo: 1, claseVehiculo: "BUS", numeroSoat: "S1", soatVencimiento: "2027-06-30", numeroRtm: "R1", rtmVencimiento: "2027-03-31" },
  polizas: {
    contractual: { numeroPoliza: "POL-C", estado: "VIGENTE", vencimiento: "2027-12-31" },
    extracontractual: { numeroPoliza: "POL-E", estado: "VIGENTE", vencimiento: "2027-12-31" },
  },
  tarjetaOperacion: { numero: "TO-1", estado: "VIGENTE", fechaExpedicion: "2025-01-01", vencimiento: "2027-12-31", empresaAsociada: "900" },
  mantenimientoPreventivo: { detalleActividades: "prev", fecha: "2026-07-01", id: "MP-1" },
  mantenimientoCorrectivo: { detalleActividades: "", fecha: "", id: "" },
  alistamientoDiario: { detalleActividades: "alist", fecha: "2026-07-21", id: "AL-1" },
  autorizaciones: [],
  empresa: { idEmpresa: "1", nit: "900853057", razonSocial: "DEMO" },
};

describe("payload: buildObjVehiculo combina form + integradora", () => {
  it("toma pólizas/tarjeta/mantenimientos de la integradora", () => {
    const v = buildObjVehiculo({ placa: "abc-123", soat: "S1" }, integradora);
    expect(v.placa).toBe("ABC123"); // limpiarPlaca
    expect(v.idPolizaContractual).toBe("POL-C"); // de integradora
    expect(v.tarjetaOperacion).toBe("TO-1"); // de integradora
    expect(v.idMatenimientoPreventivo).toBe("MP-1");
    expect(v.idProtocoloAlistamientodiario).toBe("AL-1");
    expect(typeof v.idMatenimientocorrectivo).toBe("number");
  });
});

describe("payload: buildRegistroDespacho", () => {
  it("arma los 5 bloques con valores string y placa limpia", () => {
    const p = buildRegistroDespacho({
      cabecera: { nitEmpresaTransporte: "900853057", razonSocial: "DEMO", valorTiquete: "$ 20.000", fechaSalida: "2026-07-21", horaSalida: "08:00:00" },
      vehiculoForm: { placa: "ABC123", clase: "1", nivelServicio: "2" },
      conductoresForm: { numeroIdentificacion: "123", licenciaConduccion: "LIC-1" },
      ruta: { idRutaAutorizada: "1", idOrigen: "O", detalleOrigen: "Bogotá", idDestino: "D", detalleDestino: "Medellín", via: "1", centroPobladoOrigen: "", centroPobladoDestino: "" },
      integradora,
      incluirSecundario: false,
    });
    expect(p.obj_despacho.valorTiquete).toBe("20000"); // solo dígitos
    expect(p.obj_despacho.horaSalida).toBe("08:00"); // HH:mm
    expect(p.obj_conductores.numeroIdentificacion).toBe("123");
    expect(p.obj_conductores.tipoIdentificacionSecundario).toBe("0");
    expect(p.obj_rutas.detalleDestino).toBe("Medellín");
    expect(p.array_autorizaciones).toBeUndefined(); // sin autorizaciones
  });

  it("incluye array_autorizaciones si se pasan", () => {
    const p = buildRegistroDespacho({
      cabecera: {},
      vehiculoForm: {},
      conductoresForm: {},
      ruta: { idRutaAutorizada: "1", idOrigen: "", detalleOrigen: "", idDestino: "", detalleDestino: "", via: "", centroPobladoOrigen: "", centroPobladoDestino: "" },
      integradora: null,
      incluirSecundario: false,
      autorizaciones: [{ id: "AUT-1" }],
    });
    expect(p.array_autorizaciones).toHaveLength(1);
  });
});
