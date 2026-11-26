/**
 * El pedido de /edicion/alertas: lo que manda el formulario, leído con EXACTAMENTE sus claves y convertido a los umbrales
 * que se guardan. Los rangos son los de `RANGOS_UMBRALES` (una sola fuente, con su prueba espejo contra los CHECK de la
 * migración). Los porcentajes se escriben como en la ficha («3,5») y llevan hasta 2 decimales (la columna es DECIMAL(5,2):
 * más se redondearían en silencio); los minutos y los días, enteros; los interruptores, booleanos. Los errores llevan solo
 * campo y código, nunca el valor. El autor sale de la sesión, nunca de aquí. Puro.
 */
import { Prisma } from "@prisma/client";
import { Errores, objetoConClaves, texto } from "@/plan/edicion/comun";
import type { ErrorCampo } from "@/plan/errores";
import { leerMontoEs } from "@/plan/importar/valores-es";
import { RANGOS_UMBRALES, UMBRALES_OMISION, validarUmbrales, type CampoNumerico, type Umbrales } from "@/alertas/umbrales";

export type LecturaUmbrales =
  | { readonly ok: true; readonly umbrales: Umbrales; readonly motivo: string; readonly versionBase: number }
  | { readonly ok: false; readonly errores: readonly ErrorCampo[] };

const CLAVES = ["versionBase", ...Object.keys(UMBRALES_OMISION), "motivo"] as const;
const CAMPOS_NUMERICOS = Object.keys(RANGOS_UMBRALES) as CampoNumerico[];
const CAMPOS_ACTIVA = Object.keys(UMBRALES_OMISION).filter((c) => !(c in RANGOS_UMBRALES));
const DECIMALES_PCT = 2;
const MAX_LARGO_NUMERO = 16;
const MAX_VERSION = 1_000_000_000;

/** El motivo (hasta 2000 caracteres, 4 bytes cada uno) y lo demás de sobra. */
export const MAX_CUERPO_UMBRALES = 2000 * 4 + 1024;

/** Un número como texto de la ficha o como número JSON; null si no se puede leer. */
function leerNumero(v: unknown): Prisma.Decimal | null {
  if (typeof v === "number") return Number.isFinite(v) ? new Prisma.Decimal(v) : null;
  if (typeof v !== "string" || v.length > MAX_LARGO_NUMERO) return null;
  const leido = leerMontoEs(v);
  return leido === null ? null : new Prisma.Decimal(leido);
}

function numerico(e: Errores, campo: CampoNumerico, v: unknown): number | undefined {
  const d = leerNumero(v);
  if (d === null) return e.anotar(campo, "FORMATO_INVALIDO");
  const { min, max, entero } = RANGOS_UMBRALES[campo];
  if (entero && !d.isInteger()) return e.anotar(campo, "DEBE_SER_ENTERO");
  if (!entero && d.decimalPlaces() > DECIMALES_PCT) return e.anotar(campo, "DECIMALES_DE_MAS");
  return d.lt(min) || d.gt(max) ? e.anotar(campo, "FUERA_DE_RANGO") : d.toNumber();
}

function motivo(e: Errores, v: unknown): string | undefined {
  const t = texto(e, "motivo", v);
  if (t === undefined) return undefined;
  const limpio = t.trim();
  return limpio === "" ? e.anotar("motivo", "VACIO") : limpio;
}

const versionBaseDe = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v < MAX_VERSION ? v : null);

export function leerPedidoUmbrales(valor: unknown): LecturaUmbrales {
  const r = objetoConClaves(valor, CLAVES);
  if (r === null) return { ok: false, errores: [{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }] };
  const e = new Errores();
  const versionBase = versionBaseDe(r["versionBase"]) ?? e.anotar("versionBase", "FORMATO_INVALIDO");
  const leido: Record<string, number | boolean | undefined> = {};
  for (const campo of CAMPOS_NUMERICOS) leido[campo] = numerico(e, campo, r[campo]);
  for (const campo of CAMPOS_ACTIVA) leido[campo] = typeof r[campo] === "boolean" ? (r[campo] as boolean) : e.anotar(campo, "FORMATO_INVALIDO");
  const motivoLeido = motivo(e, r["motivo"]);
  if (e.hay || versionBase === undefined || motivoLeido === undefined) return { ok: false, errores: e.lista };
  // La misma validación del dominio, como segunda guardia (los dos caminos no pueden discrepar).
  const final = validarUmbrales(leido);
  if (!final.ok) return { ok: false, errores: [{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }] };
  return { ok: true, umbrales: final.umbrales, motivo: motivoLeido, versionBase };
}
