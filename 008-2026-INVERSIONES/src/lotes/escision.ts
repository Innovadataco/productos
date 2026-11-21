/**
 * Lote recibido por una escisión (INV-SPEC-12). Su costo lo asigna el portal de Acciones & Valores
 * (fuente oficial del costo por lote); el lote madre no se ajusta (se sigue al portal, D-012 del
 * modelo: `AjusteCostoLote` queda para después). Datos reales: solo en la base del dueño.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { leerCantidad, leerDecimal, leerFechaIso, leerNemotecnico, ESCALA_PRECIO } from "../importacion/trii/valores";

export class ErrorLote extends Error {
  constructor(readonly codigo: string) {
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

function validar(d: DatosLoteEscision) {
  const destino = leerNemotecnico(d.destino);
  const fecha = leerFechaIso(d.fechaEvento);
  const cantidad = leerCantidad(d.cantidad);
  const costo = leerDecimal(d.costoUnitario, ESCALA_PRECIO);
  const errores = [
    !destino.ok && "destino", !fecha.ok && "fechaEvento", (!cantidad.ok || (cantidad.ok && (cantidad.valor.solicitada !== null || cantidad.valor.completada <= 0n))) && "cantidad",
    (!costo.ok || (costo.ok && costo.valor.startsWith("-"))) && "costoUnitario",
  ].filter(Boolean) as string[];
  if (errores.length > 0 || !destino.ok || !fecha.ok || !cantidad.ok || !costo.ok) throw new ErrorLote(`DATOS_INVALIDOS:${errores.join(",")}`);
  return { destino: destino.valor, fecha: fecha.valor, cantidad: cantidad.valor.completada, costoUnitario: new Prisma.Decimal(costo.valor) };
}

/** Registra el lote de la especie destino de un evento; el lote madre es el lote vivo más antiguo del origen. */
export async function registrarLoteEscision(db: PrismaClient, datos: DatosLoteEscision): Promise<{ loteId: string }> {
  const d = validar(datos);
  return db.$transaction(async (tx) => {
    const eventos = await tx.eventoCorporativo.findMany({
      where: { tipo: "ESCISION", fecha: d.fecha, destino: { OR: [{ nemotecnico: d.destino }, { simboloTrii: d.destino }] } },
      select: { id: true, origenId: true, destinoId: true, lotes: { select: { id: true } } },
    });
    if (eventos.length === 0) throw new ErrorLote("EVENTO_NO_ENCONTRADO");
    if (eventos.length > 1) throw new ErrorLote("EVENTO_AMBIGUO");
    const evento = eventos[0]!;
    if (evento.lotes.length > 0) throw new ErrorLote("LOTE_YA_REGISTRADO");
    const madre = await tx.lote.findFirst({
      where: { instrumentoId: evento.origenId, fechaCompra: { lte: d.fecha } },
      orderBy: [{ fechaCompra: "asc" }, { id: "asc" }],
      select: { id: true },
    });
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
