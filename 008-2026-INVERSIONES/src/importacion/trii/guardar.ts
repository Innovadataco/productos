/** Escritura de los registros de un CSV de Trii dentro de la transacción de importación. */
import { Prisma } from "@prisma/client";
import { cifrarCrudo } from "../../cifrado/campos";
import type { Llavero } from "../../cifrado/llavero";
import { DIAS_LIQUIDACION, sumarDiasHabiles } from "../liquidacion";
import type { RegistroConClave } from "./clave";
import type { HechoCaja, HechoDividendo, HechoOrden } from "./filas";

type Tx = Prisma.TransactionClient;

export class ErrorImportacion extends Error {
  constructor(readonly codigo: string, readonly fila?: number) {
    super(codigo);
    this.name = "ErrorImportacion";
  }
}

export interface Contexto {
  instrumentoId(nemotecnico: string): Promise<string>;
  instrumentosCreados(): number;
  readonly noHabiles: ReadonlySet<string>;
  readonly aniosSembrados: ReadonlySet<number>;
  /** clave `${instrumentoId}|${AAAA-MM-DD}` → id del evento cuya fracción se pagó ese día. */
  readonly fracciones: ReadonlyMap<string, string>;
}

const dia = (d: Date) => d.toISOString().slice(0, 10);

export async function prepararContexto(tx: Tx, registros: readonly RegistroConClave[]): Promise<Contexto> {
  const cache = new Map<string, string>();
  let creados = 0;
  const calendario = registros.some((r) => r.registro.tipo === "TRII_ORDENES")
    ? await tx.calendarioBvc.findMany({ select: { dia: true, esHabil: true } })
    : [];
  const eventos = registros.some((r) => r.registro.tipo === "TRII_DIVIDENDOS")
    ? await tx.eventoCorporativo.findMany({ where: { fechaPagoFraccion: { not: null } }, select: { id: true, destinoId: true, fechaPagoFraccion: true } })
    : [];
  return {
    async instrumentoId(nemotecnico) {
      const enCache = cache.get(nemotecnico);
      if (enCache) return enCache;
      const existente = await tx.instrumento.findFirst({ where: { OR: [{ simboloTrii: nemotecnico }, { nemotecnico }] }, select: { id: true } });
      const id = existente?.id ?? (await tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico, nombre: nemotecnico } })).id;
      if (!existente) creados += 1;
      cache.set(nemotecnico, id);
      return id;
    },
    instrumentosCreados: () => creados,
    noHabiles: new Set(calendario.filter((c) => !c.esHabil).map((c) => dia(c.dia))),
    aniosSembrados: new Set(calendario.map((c) => c.dia.getUTCFullYear())),
    fracciones: new Map(eventos.map((e) => [`${e.destinoId}|${dia(e.fechaPagoFraccion!)}`, e.id])),
  };
}

const dec = (v: string) => new Prisma.Decimal(v);
const igualDec = (a: Prisma.Decimal | null, b: string | null) => (a === null || b === null ? a === b : a.equals(dec(b)));

async function crearHecho(tx: Tx, ctx: Contexto, filaFuenteId: string, r: RegistroConClave): Promise<void> {
  const { registro, fila } = r;
  if (registro.tipo === "TRII_CAJA") {
    const h: HechoCaja = registro.hecho;
    await tx.movimientoCaja.create({ data: { filaFuenteId, ocurridoEn: h.ocurridoEn, fecha: h.fecha, tipo: h.tipo, estado: h.estado, monto: dec(h.monto) } });
    return;
  }
  if (registro.tipo === "TRII_ORDENES") {
    const h: HechoOrden = registro.hecho;
    const liquidacion = sumarDiasHabiles(h.fechaOperacion, DIAS_LIQUIDACION, ctx.noHabiles);
    for (const anio of [h.fechaOperacion.getUTCFullYear(), liquidacion.getUTCFullYear()]) {
      if (!ctx.aniosSembrados.has(anio)) throw new ErrorImportacion("CALENDARIO_BVC_INCOMPLETO", fila);
    }
    await tx.orden.create({
      data: {
        filaFuenteId, ejecutadaEn: h.ejecutadaEn, fechaOperacion: h.fechaOperacion, fechaLiquidacion: liquidacion,
        instrumentoId: await ctx.instrumentoId(h.nemotecnico), lado: h.lado, estado: h.estado,
        cantidadCompletada: h.cantidadCompletada, cantidadSolicitada: h.cantidadSolicitada, cantidadPendiente: h.cantidadPendiente,
        precioUnitario: dec(h.precioUnitario), totalInvertido: dec(h.totalInvertido), comision: dec(h.comision), totalEstimado: dec(h.totalEstimado),
      },
    });
    return;
  }
  const h: HechoDividendo = registro.hecho;
  const instrumentoId = await ctx.instrumentoId(h.nemotecnico);
  const eventoId = ctx.fracciones.get(`${instrumentoId}|${dia(h.fechaPago)}`) ?? null;
  await tx.dividendo.create({
    data: { filaFuenteId, fechaPago: h.fechaPago, instrumentoId, montoNeto: dec(h.montoNeto), tipo: eventoId ? "FRACCION_ESCISION" : "ORDINARIO", eventoId },
  });
}

/** Lo ya importado no se edita: si la misma fila llega distinta, el archivo se rechaza. */
async function verificarSinConflicto(tx: Tx, filaFuenteId: string, r: RegistroConClave): Promise<void> {
  const { registro, fila } = r;
  if (registro.tipo === "TRII_CAJA") {
    const previo = await tx.movimientoCaja.findUnique({ where: { filaFuenteId } });
    if (previo && previo.estado !== registro.hecho.estado) throw new ErrorImportacion("CONFLICTO_ESTADO", fila);
    return;
  }
  if (registro.tipo === "TRII_ORDENES") {
    const p = await tx.orden.findUnique({ where: { filaFuenteId } });
    if (!p) return;
    const h = registro.hecho;
    if (p.estado !== h.estado) throw new ErrorImportacion("CONFLICTO_ESTADO", fila);
    if (!igualDec(p.comision, h.comision) || !igualDec(p.totalEstimado, h.totalEstimado)) throw new ErrorImportacion("CONFLICTO_COMISION", fila);
    const mismos =
      p.cantidadCompletada === h.cantidadCompletada && p.cantidadSolicitada === h.cantidadSolicitada &&
      p.cantidadPendiente === h.cantidadPendiente && igualDec(p.precioUnitario, h.precioUnitario) && igualDec(p.totalInvertido, h.totalInvertido);
    if (!mismos) throw new ErrorImportacion("CONFLICTO_CAMPOS", fila);
  }
  // Dividendos: todos sus campos forman la clave; no hay nada más que comparar.
}

/**
 * Devuelve true si la fila es nueva. Siempre deja constancia de que esta carga la vio.
 * El crudo se guarda cifrado (#11), atado a su llave natural: la clave natural ya se calculó
 * (de los campos canónicos, no del crudo) antes de cifrar, así que reimportar no duplica.
 */
export async function guardarRegistro(tx: Tx, ctx: Contexto, cargaId: string, r: RegistroConClave, llavero: Llavero): Promise<boolean> {
  const where = { tipoFuente_claveNatural_ocurrencia: { tipoFuente: r.registro.tipo, claveNatural: r.clave, ocurrencia: r.ocurrencia } };
  const existente = await tx.filaFuente.findUnique({ where, select: { id: true } });
  if (existente) {
    await verificarSinConflicto(tx, existente.id, r);
    await tx.filaDeCarga.create({ data: { cargaId, filaNo: r.fila, filaFuenteId: existente.id } });
    return false;
  }
  const crudo = cifrarCrudo(r.crudo, { tipoFuente: r.registro.tipo, claveNatural: r.clave, ocurrencia: r.ocurrencia }, llavero);
  const fila = await tx.filaFuente.create({
    data: { tipoFuente: r.registro.tipo, claveNatural: r.clave, ocurrencia: r.ocurrencia, primeraCargaId: cargaId, primeraFilaNo: r.fila, crudo },
  });
  await tx.filaDeCarga.create({ data: { cargaId, filaNo: r.fila, filaFuenteId: fila.id } });
  await crearHecho(tx, ctx, fila.id, r);
  return true;
}
