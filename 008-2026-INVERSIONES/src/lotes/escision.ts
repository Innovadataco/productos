/**
 * Lote recibido por una escisión (INV-SPEC-12). Su costo lo asigna el portal de Acciones & Valores
 * (fuente oficial del costo por lote); el lote madre no se ajusta (se sigue al portal, D-012 del
 * modelo: `AjusteCostoLote` queda para después). Datos reales: solo en la base del dueño.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ErrorCampo } from "../eventos/escision";
import { CODIGO_UNICIDAD, esErrorPrisma } from "../lib/choques";
import { leerCantidad, leerDecimal, leerFechaIso, leerNemotecnico, ESCALA_PRECIO, type ResultadoValor } from "../importacion/trii/valores";

/**
 * Rechazos del registro del lote (salida 1 de lote-escision; su significado, en src/cli/salida-escision.ts).
 * DATOS_INVALIDOS:<campos> solo lo lanza registrarLoteEscision a quien la llame sin validar: el CLI valida antes.
 */
export type CodigoLote = "EVENTO_NO_ENCONTRADO" | "EVENTO_AMBIGUO" | "LOTE_YA_REGISTRADO" | "SIN_LOTE_MADRE" | `DATOS_INVALIDOS:${string}`;

export class ErrorLote extends Error {
  constructor(readonly codigo: CodigoLote) {
    super(codigo);
    this.name = "ErrorLote";
  }
}

export interface DatosLoteEscision {
  readonly destino: string;
  readonly fechaEvento: string;
  readonly cantidad: string;
  readonly costoUnitario: string;
}

export interface LoteEscisionValido {
  readonly destino: string;
  readonly fecha: Date;
  readonly cantidad: bigint;
  readonly costoUnitario: Prisma.Decimal;
}

/** La cantidad de un lote: un entero positivo, sin la forma «completadas/solicitadas» de las órdenes. */
function leerCantidadLote(texto: string): ResultadoValor<bigint> {
  const c = leerCantidad(texto);
  if (!c.ok) return c;
  if (c.valor.solicitada !== null) return { ok: false, codigo: "CANTIDAD_FORMATO" };
  return c.valor.completada > 0n ? { ok: true, valor: c.valor.completada } : { ok: false, codigo: "DEBE_SER_POSITIVO" };
}

/** El costo unitario del portal: cero o más (se mira el valor canónico: «-0» es 0). */
function leerCostoUnitario(texto: string): ResultadoValor<string> {
  const c = leerDecimal(texto, ESCALA_PRECIO);
  if (!c.ok) return c;
  return c.valor.startsWith("-") ? { ok: false, codigo: "NO_PUEDE_SER_NEGATIVO" } : c;
}

/**
 * Valida el lote sin tocar la base, con un código por campo (como validarEscision): así el CLI sale con 2 antes de
 * abrir la base. Los errores llevan el nombre del campo y el código, nunca el valor.
 */
export function validarLoteEscision(d: DatosLoteEscision): { ok: true; valor: LoteEscisionValido } | { ok: false; errores: ErrorCampo[] } {
  const errores: ErrorCampo[] = [];
  const tomar = <T>(campo: string, r: ResultadoValor<T>): T | undefined => {
    if (r.ok) return r.valor;
    errores.push({ campo, codigo: r.codigo });
    return undefined;
  };
  const destino = tomar("destino", leerNemotecnico(d.destino));
  const fecha = tomar("fechaEvento", leerFechaIso(d.fechaEvento));
  const cantidad = tomar("cantidad", leerCantidadLote(d.cantidad));
  const costo = tomar("costoUnitario", leerCostoUnitario(d.costoUnitario));
  if (destino === undefined || fecha === undefined || cantidad === undefined || costo === undefined) return { ok: false, errores };
  return { ok: true, valor: { destino, fecha, cantidad, costoUnitario: new Prisma.Decimal(costo) } };
}

/**
 * Registra el lote de la especie destino de un evento. El lote madre es el más antiguo del origen
 * que seguía vivo al corte del evento (cantidad menos lo vendido hasta esa fecha); es un enlace de
 * trazabilidad: su costo no se ajusta. Requiere haber corrido `lotes:construir` antes.
 */
export async function registrarLoteEscision(db: PrismaClient, datos: DatosLoteEscision): Promise<{ loteId: string }> {
  const v = validarLoteEscision(datos);
  if (!v.ok) throw new ErrorLote(`DATOS_INVALIDOS:${v.errores.map((e) => e.campo).join(",")}`);
  try {
    return await registrarEnTransaccion(db, v.valor);
  } catch (e) {
    // Índice único lote_escision_evento_key: dos registros simultáneos del mismo lote.
    if (esErrorPrisma(e, CODIGO_UNICIDAD)) throw new ErrorLote("LOTE_YA_REGISTRADO");
    throw e;
  }
}

function registrarEnTransaccion(db: PrismaClient, d: LoteEscisionValido): Promise<{ loteId: string }> {
  return db.$transaction(async (tx) => {
    const eventos = await tx.eventoCorporativo.findMany({
      where: { tipo: "ESCISION", fecha: d.fecha, destino: { OR: [{ nemotecnico: d.destino }, { simboloTrii: d.destino }] } },
      select: { id: true, origenId: true, destinoId: true, lotes: { select: { id: true } } },
    });
    if (eventos.length === 0) throw new ErrorLote("EVENTO_NO_ENCONTRADO");
    if (eventos.length > 1) throw new ErrorLote("EVENTO_AMBIGUO");
    const evento = eventos[0]!;
    if (evento.lotes.length > 0) throw new ErrorLote("LOTE_YA_REGISTRADO");
    const candidatos = await tx.lote.findMany({
      where: { instrumentoId: evento.origenId, fechaCompra: { lte: d.fecha } },
      orderBy: [{ fechaCompra: "asc" }, { id: "asc" }],
      select: { id: true, cantidad: true, asignaciones: { where: { ordenVenta: { fechaOperacion: { lte: d.fecha } } }, select: { cantidad: true } } },
    });
    const madre = candidatos.find((l) => l.cantidad - l.asignaciones.reduce((s, a) => s + a.cantidad, 0n) > 0n);
    if (!madre) throw new ErrorLote("SIN_LOTE_MADRE");
    const lote = await tx.lote.create({
      data: {
        instrumentoId: evento.destinoId, origen: "ESCISION", eventoId: evento.id, loteOrigenId: madre.id,
        fechaCompra: d.fecha, fechaLiquidacion: d.fecha, cantidad: d.cantidad, costoUnitario: d.costoUnitario,
        costoTotal: d.costoUnitario.mul(d.cantidad.toString()).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_EVEN),
        comision: new Prisma.Decimal(0), fuenteCosto: "AV_PORTAL",
      },
      select: { id: true },
    });
    return { loteId: lote.id };
  });
}
