import type { ClienteSupertransporte, RespuestaExterna } from "@/lib/integracion/cliente";
import { construirCabeceras } from "@/lib/integracion/cabeceras";
import { integracionRealActiva } from "@/lib/integracion/modo";
import { requireEnv } from "@/lib/env";
import { extraerObjeto } from "@/lib/normalizar";
import type { SolicitudIntegradora, RespuestaIntegradora } from "@/lib/integracion/integradora-tipos";

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

  async consultarIntegradora(
    body: SolicitudIntegradora,
    identificacion: string,
    idRol: number,
  ): Promise<RespuestaIntegradora> {
    const cabeceras = await construirCabeceras(identificacion, idRol);
    const url = `${requireEnv("URL_INTEGRADORA")}/api-integradora/resumen`;
    const timeout = Number(process.env.TIMEOUT_INTEGRADORA_MS ?? 100_000) || 100_000;
    const res = await fetch(url, {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
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
    // Normaliza obj?? raíz y devuelve como RespuestaIntegradora.
    return extraerObjeto(data) as unknown as RespuestaIntegradora;
  }
}
