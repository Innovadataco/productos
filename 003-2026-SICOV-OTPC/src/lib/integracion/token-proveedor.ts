import { envOr, requireEnv } from "@/lib/env";
import { modoIntegracion } from "@/lib/integracion/modo";

/// Cache singleton del token de proveedor (tokenExterno), con auto-refresh y margen de vigencia.
/// Réplica de TokenExterno.ts del legacy, con expiración real (el legacy asumía vigente indefinido).
let _token: string | null = null;
let _expiraEn: number | null = null; // epoch segundos
let _refreshEnCurso: Promise<string> | null = null;

const MARGEN_S = 60; // refresca 60s antes de expirar
const TTL_S = Number(envOr("EXTERNAL_TOKEN_TTL_S", "3600"));

function ahoraS(): number {
  return Math.floor(Date.now() / 1000);
}

export function tokenProveedorVigente(): boolean {
  if (!_token) return false;
  if (_expiraEn === null) return true;
  return ahoraS() < _expiraEn - MARGEN_S;
}

export function setTokenProveedor(token: string, expiraEn?: number): void {
  _token = token;
  _expiraEn = typeof expiraEn === "number" ? expiraEn : ahoraS() + TTL_S;
}

export function clearTokenProveedor(): void {
  _token = null;
  _expiraEn = null;
}

/// Obtiene el token vigente o lo refresca. NUNCA toca la red en modo stub.
export async function getTokenProveedor(): Promise<string> {
  if (tokenProveedorVigente() && _token) return _token;
  if (_refreshEnCurso) return _refreshEnCurso;
  _refreshEnCurso = refresh().finally(() => {
    _refreshEnCurso = null;
  });
  return _refreshEnCurso;
}

async function refresh(): Promise<string> {
  if (modoIntegracion() === "stub") {
    const token = `stub-token-${ahoraS()}`;
    setTokenProveedor(token);
    return token;
  }
  // Modo real: login del proveedor con credenciales del .env (NO del usuario).
  const url = requireEnv("EXTERNAL_APP_LOGIN_URL");
  const usuario = requireEnv("EXTERNAL_APP_USER");
  const contrasena = requireEnv("EXTERNAL_APP_PASSWORD");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, contrasena }),
  });
  if (!res.ok) {
    clearTokenProveedor();
    throw new Error(`Login externo falló (${res.status})`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data?.token) {
    clearTokenProveedor();
    throw new Error("Respuesta inválida del servicio de autenticación externo");
  }
  setTokenProveedor(data.token);
  return data.token;
}
