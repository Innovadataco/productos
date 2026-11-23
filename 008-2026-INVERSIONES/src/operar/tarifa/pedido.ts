/**
 * El pedido de /edicion/tarifas (O5): lo que manda el formulario, leído con EXACTAMENTE sus claves y convertido a lo
 * que se guarda. Los números se escriben como en la ficha («0,25», «1.237,5»: src/plan/importar/valores-es.ts) y se
 * guardan como texto decimal exacto (sin punto flotante); la fecha, en ISO. Los errores llevan solo campo y código,
 * nunca el valor. El autor sale de la sesión, nunca de aquí. Puro.
 */
import { Prisma, type LadoOrden } from "@prisma/client";
import { Errores, fecha, objetoConClaves, texto, type Lectura } from "@/plan/edicion/comun";
import type { ErrorCampo } from "@/plan/errores";
import { leerMontoEs } from "@/plan/importar/valores-es";
import type { Comisionista } from "../simulador/tipos";
import {
  COMISIONISTAS,
  DECIMALES_TARIFA,
  DIAS_MAX_ADELANTE,
  LADOS_TARIFA,
  MAX_NOMBRE_CARGO,
  MAX_OTROS_CARGOS,
  MAX_PORCENTAJE,
  TIPOS_CARGO,
  TOPE_CARGO_TARIFA,
} from "./parametros";

export interface CargoEntrada {
  readonly nombre: string;
  readonly tipo: (typeof TIPOS_CARGO)[number];
  /** Texto decimal canónico («0.25»). */
  readonly valor: string;
}

export interface EntradaTarifa {
  readonly comisionista: Comisionista;
  readonly lado: LadoOrden;
  readonly porcentaje: string;
  readonly minimoPorOrden: string;
  readonly fijoPorOrden: string;
  readonly ivaPct: string;
  readonly otrosCargos: readonly CargoEntrada[];
  readonly vigenteDesde: Date;
  readonly motivo: string;
}

export type LecturaTarifa = { readonly ok: true; readonly valor: EntradaTarifa; readonly versionBase: number } | { readonly ok: false; readonly errores: readonly ErrorCampo[] };

const CLAVES = ["versionBase", "comisionista", "lado", "porcentaje", "minimoPorOrden", "fijoPorOrden", "ivaPct", "otrosCargos", "vigenteDesde", "motivo"] as const;
const CLAVES_CARGO = ["nombre", "tipo", "valor"] as const;
/** Un número escrito cabe de sobra en esto; más largo es un pedido absurdo. */
const MAX_LARGO_NUMERO = 32;
const MAX_VERSION = 1_000_000_000;
const MS_POR_DIA = 86_400_000;
const CIEN = new Prisma.Decimal(MAX_PORCENTAJE);
/** Controles, caracteres de formato (marcas de dirección, ancho cero) y separadores de línea: no van en el nombre de un cargo. */
const INVISIBLES = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

/** Con el texto decimal: un Decimal con hasta 4 decimales, de 0 o más; si no, null. */
function decimalDe(v: unknown): Prisma.Decimal | null {
  if (typeof v !== "string" || v.length > MAX_LARGO_NUMERO) return null;
  const leido = leerMontoEs(v);
  if (leido === null) return null;
  const d = new Prisma.Decimal(leido);
  return d.isNeg() || d.decimalPlaces() > DECIMALES_TARIFA ? null : d;
}

function porcentaje(e: Errores, campo: string, v: unknown): string | undefined {
  const d = decimalDe(v);
  return d !== null && d.lte(CIEN) ? d.toFixed() : e.anotar(campo, "PORCENTAJE_INVALIDO");
}

function monto(e: Errores, campo: string, v: unknown): string | undefined {
  const d = decimalDe(v);
  return d !== null && d.lt(TOPE_CARGO_TARIFA) ? d.toFixed() : e.anotar(campo, "MONTO_INVALIDO");
}

function deLaLista<T extends string>(e: Errores, campo: string, lista: readonly T[], v: unknown, codigo: string): T | undefined {
  return lista.find((x) => x === v) ?? e.anotar(campo, codigo);
}

function nombreCargo(e: Errores, campo: string, v: unknown): string | undefined {
  if (typeof v !== "string") return e.anotar(campo, "FORMATO_INVALIDO");
  const limpio = v.trim();
  if (limpio === "") return e.anotar(campo, "VACIO");
  return limpio.length > MAX_NOMBRE_CARGO || INVISIBLES.test(limpio) ? e.anotar(campo, "NOMBRE_INVALIDO") : limpio;
}

function cargo(e: Errores, i: number, v: unknown): CargoEntrada | undefined {
  const c = objetoConClaves(v, CLAVES_CARGO);
  if (c === null) return e.anotar(`otrosCargos.${i}`, "FORMATO_INVALIDO");
  const nombre = nombreCargo(e, `otrosCargos.${i}.nombre`, c["nombre"]);
  const tipo = deLaLista(e, `otrosCargos.${i}.tipo`, TIPOS_CARGO, c["tipo"], "TIPO_CARGO_INVALIDO");
  const valor = tipo === "PCT" ? porcentaje(e, `otrosCargos.${i}.valor`, c["valor"]) : monto(e, `otrosCargos.${i}.valor`, c["valor"]);
  return nombre !== undefined && tipo !== undefined && valor !== undefined ? { nombre, tipo, valor } : undefined;
}

function cargos(e: Errores, v: unknown): CargoEntrada[] | undefined {
  if (!Array.isArray(v)) return e.anotar("otrosCargos", "FORMATO_INVALIDO");
  if (v.length > MAX_OTROS_CARGOS) return e.anotar("otrosCargos", "CARGOS_DEMASIADOS");
  const leidos = v.map((c, i) => cargo(e, i, c));
  return leidos.every((c): c is CargoEntrada => c !== undefined) ? leidos : undefined;
}

function vigencia(e: Errores, v: unknown, hoy: Date): Date | undefined {
  const d = fecha(e, "vigenteDesde", v);
  if (d === undefined) return undefined;
  return d.getTime() - hoy.getTime() > DIAS_MAX_ADELANTE * MS_POR_DIA ? e.anotar("vigenteDesde", "VIGENCIA_DEMASIADO_LEJANA") : d;
}

function motivo(e: Errores, v: unknown): string | undefined {
  const t = texto(e, "motivo", v);
  if (t === undefined) return undefined;
  return t.trim() === "" ? e.anotar("motivo", "VACIO") : t;
}

const versionBaseDe = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v < MAX_VERSION ? v : null);

/** Lee el pedido contra el día de hoy de Colombia (medianoche UTC). Un cuerpo sin las claves exactas, FORMATO_INVALIDO en «cuerpo». */
export function leerPedidoTarifa(valor: unknown, hoy: Date): LecturaTarifa {
  const r = objetoConClaves(valor, CLAVES);
  if (r === null) return { ok: false, errores: [{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }] };
  const e = new Errores();
  const versionBase = versionBaseDe(r["versionBase"]) ?? e.anotar("versionBase", "FORMATO_INVALIDO");
  const leido = {
    comisionista: deLaLista(e, "comisionista", COMISIONISTAS, r["comisionista"], "COMISIONISTA_INVALIDO"),
    lado: deLaLista(e, "lado", LADOS_TARIFA, r["lado"], "LADO_INVALIDO"),
    porcentaje: porcentaje(e, "porcentaje", r["porcentaje"]),
    minimoPorOrden: monto(e, "minimoPorOrden", r["minimoPorOrden"]),
    fijoPorOrden: monto(e, "fijoPorOrden", r["fijoPorOrden"]),
    ivaPct: porcentaje(e, "ivaPct", r["ivaPct"]),
    otrosCargos: cargos(e, r["otrosCargos"]),
    vigenteDesde: vigencia(e, r["vigenteDesde"], hoy),
    motivo: motivo(e, r["motivo"]),
  };
  if (e.hay || versionBase === undefined) return { ok: false, errores: e.lista };
  return { ok: true, valor: leido as EntradaTarifa, versionBase };
}

/** El cuerpo más grande que se acepta: el motivo (hasta 2000 caracteres, 4 bytes cada uno) y lo demás de sobra. */
export const MAX_CUERPO_TARIFA = 2000 * 4 + 4096;
