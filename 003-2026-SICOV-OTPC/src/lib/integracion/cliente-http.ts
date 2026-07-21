import type { ClienteSupertransporte, RespuestaExterna } from "@/lib/integracion/cliente";
import { construirCabeceras } from "@/lib/integracion/cabeceras";
import { integracionRealActiva } from "@/lib/integracion/modo";

/// Cliente REAL contra Supertransporte. ⚠️ Consume APIs productivas.
/// Solo debe instanciarse en modo real (doble gate de env). NO se ejercita en tests ni en stub.
/// Pendiente de VERIFICACIÓN HUMANA antes de activarse (credenciales rotadas).
export class ClienteHttp implements ClienteSupertransporte {
  constructor() {
    if (!integracionRealActiva()) {
      throw new Error(
        "ClienteHttp solo puede instanciarse en modo real (INTEGRACIONES_MODO=real && SUPERTRANSPORTE_HABILITADO=true).",
      );
    }
  }

  async postTransaccional(
    url: string,
    body: unknown,
    identificacion: string,
    idRol: number,
  ): Promise<RespuestaExterna> {
    const cabeceras = await construirCabeceras(identificacion, idRol);
    // NO loguear valores de cabeceras (contienen tokens).
    const res = await fetch(url, {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(100_000),
    });
    const data = (await res.json().catch(() => ({}))) as RespuestaExterna;
    if (!res.ok) {
      const err = new Error(
        (data?.["mensaje"] as string) ?? (data?.["message"] as string) ?? `HTTP ${res.status}`,
      ) as Error & { responseData?: unknown; status?: number };
      err.responseData = data;
      err.status = res.status;
      throw err;
    }
    return data;
  }
}
