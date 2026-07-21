import type { ClienteSupertransporte, RespuestaExterna } from "@/lib/integracion/cliente";
import { construirCabeceras } from "@/lib/integracion/cabeceras";
import { integracionRealActiva } from "@/lib/integracion/modo";
import { requireEnv } from "@/lib/env";
import { extraerObjeto, extraerLista } from "@/lib/normalizar";
import type { SolicitudIntegradora, RespuestaIntegradora } from "@/lib/integracion/integradora-tipos";
import type { RutaMaestra, AutorizacionMaestra } from "@/lib/despachos/despacho-tipos";

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

  // Maestras (read-through). Auth exacta [NEEDS CLARIFICATION]: el legacy usa TOKEN estático/paramétrico.
  private async getMaestra<T>(path: string): Promise<T[]> {
    const url = `${requireEnv("URL_MATENIMIENTOS")}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${requireEnv("TOKEN")}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json().catch(() => ({}))) as RespuestaExterna;
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return extraerLista<T>(data);
  }

  async consultarRutasActivas(nit: string): Promise<RutaMaestra[]> {
    return this.getMaestra<RutaMaestra>(`/maestras/rutas-activas-empresa?nit=${encodeURIComponent(nit)}`);
  }

  async consultarAutorizaciones(nit: string, placa: string, fecha: string): Promise<AutorizacionMaestra[]> {
    const qs = `nit=${encodeURIComponent(nit)}&placa=${encodeURIComponent(placa)}&fecha=${encodeURIComponent(fecha)}`;
    return this.getMaestra<AutorizacionMaestra>(`/maestras/autorizaciones?${qs}`);
  }
}
