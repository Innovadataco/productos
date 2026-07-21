import type { ClienteSupertransporte, RespuestaExterna } from "@/lib/integracion/cliente";
import { construirCabeceras } from "@/lib/integracion/cabeceras";

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
}
