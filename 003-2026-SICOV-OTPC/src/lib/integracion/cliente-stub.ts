import type { ClienteSupertransporte, RespuestaExterna } from "@/lib/integracion/cliente";
import { construirCabeceras } from "@/lib/integracion/cabeceras";
import type {
  SolicitudIntegradora,
  RespuestaIntegradora,
  Conductor,
} from "@/lib/integracion/integradora-tipos";

/// Cliente STUB: NUNCA toca la red. Ejercita el armado de las 3 cabeceras (doble token) y la
/// herencia rol 3, y devuelve una respuesta simulada. Es el cliente por defecto y el de tests.
export class ClienteStub implements ClienteSupertransporte {
  private static contador = 1000;

  async postTransaccional(
    url: string,
    body: unknown,
    identificacion: string,
    idRol: number,
  ): Promise<RespuestaExterna> {
    // Resuelve y valida las cabeceras (token proveedor, token vigilado, NIT) — puede lanzar
    // si falta el token del vigilado o el admin del subusuario (paridad con el real).
    const cabeceras = await construirCabeceras(identificacion, idRol);

    // Log de nombres de cabecera SOLAMENTE (nunca los valores/tokens).
    console.log(`[stub] POST ${url} headers=[${Object.keys(cabeceras).join(",")}]`);

    // Fallo simulado configurable (para probar reintentos) sin tocar red.
    const b = (body ?? {}) as Record<string, unknown>;
    const vehiculo = (b["obj_vehiculo"] ?? {}) as Record<string, unknown>;
    const placa = String(vehiculo["placa"] ?? "");
    if (b["__stubFallo"] === true || placa.toUpperCase().startsWith("FALLA")) {
      const err = new Error("Fallo simulado por el stub") as Error & {
        responseData?: unknown;
      };
      err.responseData = { mensaje: "Fallo simulado por el stub" };
      throw err;
    }

    const id = ClienteStub.contador++;
    return { obj: { id }, mensaje: "Despacho registrado (stub)", estado: 200 };
  }

  async consultarIntegradora(
    body: SolicitudIntegradora,
    identificacion: string,
    idRol: number,
  ): Promise<RespuestaIntegradora> {
    // Arma y valida las 3 cabeceras (server-side) igual que una transacción; sin tocar red.
    const cabeceras = await construirCabeceras(identificacion, idRol);
    console.log(
      `[stub] POST integradora/resumen headers=[${Object.keys(cabeceras).join(",")}] placa=${body.placa}`,
    );

    const conductor = (numeroIdentificacion: string): Conductor => ({
      persona: {
        tipoDocumento: "CC",
        numeroIdentificacion,
        nombres: "CONDUCTOR DEMO",
        apellidos: "STUB",
        primerNombre: "CONDUCTOR",
        segundoNombre: "",
        primerApellido: "DEMO",
        segundoApellido: "STUB",
      },
      licencia: { numeroLicencia: `LIC-${numeroIdentificacion}`, estado: "VIGENTE", fechaVencimiento: "2027-12-31" },
      alcoholimetria: { resultado: "NEGATIVO", grado: "0.0", fecha: body.fechaConsulta, hora: body.horaConsulta ?? "08:00", codigo: "ALC-STUB" },
      examenMedico: { resultado: "APTO", fecha: "2026-01-15", hora: "09:00", codigo: "EM-STUB" },
      aptitudFisica: { resultado: "APTO", fecha: "2026-01-15", hora: "09:30", codigo: "AF-STUB" },
    });

    return {
      conductor1: conductor(body.numeroIdentificacion1),
      conductor2: body.numeroIdentificacion2 ? conductor(body.numeroIdentificacion2) : null,
      vehiculo: {
        placa: body.placa,
        claseVehiculoCodigo: 1,
        claseVehiculo: "BUS",
        numeroSoat: `SOAT-${body.placa}`,
        soatVencimiento: "2027-06-30",
        numeroRtm: `RTM-${body.placa}`,
        rtmVencimiento: "2027-03-31",
      },
      polizas: {
        contractual: { numeroPoliza: "POL-C-STUB", estado: "VIGENTE", vencimiento: "2027-12-31" },
        extracontractual: { numeroPoliza: "POL-E-STUB", estado: "VIGENTE", vencimiento: "2027-12-31" },
      },
      tarjetaOperacion: {
        numero: `TO-${body.placa}`,
        estado: "VIGENTE",
        fechaExpedicion: "2025-01-01",
        vencimiento: "2027-12-31",
        empresaAsociada: body.nit ?? cabeceras.documento,
      },
      mantenimientoPreventivo: { detalleActividades: "Preventivo al día", fecha: "2026-07-01", id: "MP-STUB" },
      mantenimientoCorrectivo: { detalleActividades: "Sin correctivos", fecha: "", id: "" },
      alistamientoDiario: { detalleActividades: "Alistamiento OK", fecha: body.fechaConsulta, id: "AL-STUB" },
      autorizaciones: [],
      empresa: { idEmpresa: "1", nit: body.nit ?? cabeceras.documento, razonSocial: "TRANSPORTES DEMO S.A.S." },
    };
  }
}
