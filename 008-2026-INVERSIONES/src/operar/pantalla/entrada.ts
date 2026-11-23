/**
 * El pedido del simulador «¿y si…?» de /operar (POST /api/operar/simular): EXACTAMENTE seis claves (el saldo en el comisionista puede ir vacío), todas texto y
 * cortas. La cantidad y el precio se escriben como en la ficha («3.172», «4.613,27») y se convierten sin punto
 * flotante, con un tope de largo ANTES de BigInt y de Decimal. Lo que se convierte, el motor lo revisa otra vez (lado,
 * cantidad, precio y tenencia) y devuelve sus errores como datos. El pedido no guarda nada. Puro.
 */
import { Prisma } from "@prisma/client";
import { objetoConClaves } from "@/plan/edicion/comun";
import { leerEnteroEs, leerMontoEs } from "@/plan/importar/valores-es";
import { COMISIONISTAS, type Comisionista, type LadoSimulado, type OperacionSimulada } from "../simulador/tipos";

export const CLAVES_SIMULACION = ["instrumentoId", "lado", "cantidad", "precioLimite", "comisionista", "saldoComisionista"] as const;
export type CampoSimulacion = (typeof CLAVES_SIMULACION)[number];

/** Un número escrito cabe de sobra en esto (el tope del motor tiene 14 cifras, más puntos de miles y decimales). */
export const MAX_LARGO_NUMERO = 32;
/** Los ids de la base son cuid; el guion se admite para los de las pruebas. */
const ID = /^[a-z0-9-]{1,64}$/;
const LADOS: readonly LadoSimulado[] = ["COMPRAR", "VENDER"];

export interface PedidoSimulacion {
  readonly operacion: OperacionSimulada;
  readonly comisionista: Comisionista;
  /** El saldo disponible en el comisionista que escribió el dueño; null si lo dejó vacío (la caja sale de A&V). */
  readonly saldo: Prisma.Decimal | null;
}

export type LecturaSimulacion = { readonly ok: true; readonly valor: PedidoSimulacion } | { readonly ok: false; readonly campos: readonly CampoSimulacion[] };

const corto = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_LARGO_NUMERO;

function cantidadDe(v: unknown): bigint | null {
  return corto(v) ? leerEnteroEs(v) : null;
}

function precioDe(v: unknown): Prisma.Decimal | null {
  const leido = corto(v) ? leerMontoEs(v) : null;
  return leido === null ? null : new Prisma.Decimal(leido);
}

/** Opcional: vacío (o solo espacios) es null; escrito, un monto de cero o más como en la ficha; si no se lee, undefined. */
function saldoDe(v: unknown): Prisma.Decimal | null | undefined {
  if (typeof v !== "string" || v.length > MAX_LARGO_NUMERO) return undefined;
  if (v.trim() === "") return null;
  const leido = leerMontoEs(v.trim());
  if (leido === null) return undefined;
  const d = new Prisma.Decimal(leido);
  return d.isNeg() ? undefined : d;
}

/** null si el cuerpo no es un objeto con exactamente esas claves; si no, el pedido o los campos que no se pudieron leer. */
export function leerPedidoSimulacion(valor: unknown): LecturaSimulacion | null {
  const r = objetoConClaves(valor, CLAVES_SIMULACION);
  if (r === null) return null;
  const instrumentoId = typeof r["instrumentoId"] === "string" && ID.test(r["instrumentoId"]) ? r["instrumentoId"] : null;
  const lado = LADOS.find((l) => l === r["lado"]) ?? null;
  const cantidad = cantidadDe(r["cantidad"]);
  const precioLimite = precioDe(r["precioLimite"]);
  const comisionista = COMISIONISTAS.find((c) => c === r["comisionista"]) ?? null;
  const saldo = saldoDe(r["saldoComisionista"]);
  const campos: CampoSimulacion[] = [
    ...(instrumentoId === null ? ["instrumentoId" as const] : []),
    ...(lado === null ? ["lado" as const] : []),
    ...(cantidad === null ? ["cantidad" as const] : []),
    ...(precioLimite === null ? ["precioLimite" as const] : []),
    ...(comisionista === null ? ["comisionista" as const] : []),
    ...(saldo === undefined ? ["saldoComisionista" as const] : []),
  ];
  if (instrumentoId === null || lado === null || cantidad === null || precioLimite === null || comisionista === null || saldo === undefined) return { ok: false, campos };
  return { ok: true, valor: { operacion: { instrumentoId, lado, cantidad, precioLimite }, comisionista, saldo } };
}
