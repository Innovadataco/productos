/**
 * IP del cliente para los topes del login y de las API (D-014). Sale solo de `Cf-Connecting-IP`, que pone
 * el túnel de Cloudflare; `X-Forwarded-For` no se mira. Sin cabecera válida, la IP es null y esos
 * intentos comparten el balde «sin IP» (por ejemplo, un proceso del propio servidor).
 * Riesgo residual (PLAN-DESPLIEGUE-VPS §6): un proceso del VPS que llegue a 127.0.0.1:5008 puede fingir
 * la cabecera; la barrera principal es el bloqueo por cuenta. Módulo puro: lo usa también el proxy.
 */
import { isIP } from "node:net";

const CABECERA = "cf-connecting-ip";

/**
 * Los 8 grupos de una IPv6 sin abreviar. Una cola IPv4 (`64:ff9b::192.0.2.1`) ocupa los dos últimos
 * grupos: se cambia por `0:0`, que no toca los 64 bits de la red.
 */
function grupos(ip: string): string[] {
  const texto = ip.replace(/\d{1,3}(?:\.\d{1,3}){3}$/, "0:0");
  const [izquierda = "", derecha = ""] = texto.split("::");
  const a = izquierda ? izquierda.split(":") : [];
  const b = texto.includes("::") ? (derecha ? derecha.split(":") : []) : [];
  const ceros = texto.includes("::") ? Array.from({ length: 8 - a.length - b.length }, () => "0") : [];
  return [...a, ...ceros, ...b].map((g) => parseInt(g, 16).toString(16));
}

const PREFIJO_MAPEADA = ["0", "0", "0", "0", "0", "ffff"].join(":");

/** Una IPv4 escrita como IPv6 (`::ffff:a.b.c.d` o `::ffff:aabb:ccdd`) vuelve a ser IPv4. */
function comoIpv4(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const g = grupos(ip);
  if (g.slice(0, 6).join(":") !== PREFIJO_MAPEADA) return ip;
  const dotted = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip)?.[1];
  if (dotted) return dotted;
  const [alto = 0, bajo = 0] = g.slice(6).map((x) => parseInt(x, 16));
  return [alto >> 8, alto & 0xff, bajo >> 8, bajo & 0xff].join(".");
}

/** La IP del cliente (las IPv4 mapeadas, como IPv4), o null si no llegó una válida. */
export function ipDeSolicitud(cabeceras: Headers): string | null {
  const valor = cabeceras.get(CABECERA)?.trim() ?? "";
  if (!valor || valor.includes("%") || isIP(valor) === 0) return null;
  return comoIpv4(valor);
}

/** La red que cuenta para los topes: IPv4 por /32 e IPv6 por /64. null si no hay IP. */
export function redDeIp(ip: string | null): string | null {
  if (ip === null) return null;
  const v4 = comoIpv4(ip);
  if (isIP(v4) === 4) return `${v4}/32`;
  return `${grupos(ip).slice(0, 4).join(":")}::/64`;
}
