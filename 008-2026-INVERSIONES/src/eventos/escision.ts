/**
 * Registro de eventos de escisión (INV-SPEC-10). Los datos son reales del dueño: viven solo en su
 * base; este módulo no los imprime ni los registra en logs.
 * Sirve para que la importación de dividendos marque como FRACCION_ESCISION el pago de la fracción
 * (especie destino + fecha de pago), en vez de dejarlo como dividendo ordinario.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { leerDecimal, leerFechaIso, leerNemotecnico, type ResultadoValor } from "../importacion/trii/valores";

const ESCALA_RAZON = 10;
const MAX_NOTA = 200;

export interface DatosEscision {
  readonly origen: string;
  readonly destino: string;
  readonly fecha: string;
  readonly razon?: string | undefined;
  readonly pagoFraccion?: string | undefined;
  readonly montoFraccion?: string | undefined;
  readonly nota?: string | undefined;
}

export interface EscisionValida {
  readonly origen: string;
  readonly destino: string;
  readonly fecha: Date;
  readonly razon: string | null;
  readonly pagoFraccion: Date | null;
  readonly montoFraccion: string | null;
  readonly nota: string | null;
}

export interface ErrorCampo {
  readonly campo: string;
  readonly codigo: string;
}

export class ErrorEvento extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
    this.name = "ErrorEvento";
  }
}

function opcional<T>(texto: string | undefined, leer: (t: string) => ResultadoValor<T>): ResultadoValor<T | null> {
  return texto === undefined || texto.trim() === "" ? { ok: true, valor: null } : leer(texto);
}

export function validarEscision(d: DatosEscision): { ok: true; valor: EscisionValida } | { ok: false; errores: ErrorCampo[] } {
  const errores: ErrorCampo[] = [];
  const tomar = <T>(campo: string, r: ResultadoValor<T>): T | undefined => {
    if (r.ok) return r.valor;
    errores.push({ campo, codigo: r.codigo });
    return undefined;
  };
  const origen = tomar("origen", leerNemotecnico(d.origen));
  const destino = tomar("destino", leerNemotecnico(d.destino));
  const fecha = tomar("fecha", leerFechaIso(d.fecha));
  const razon = tomar("razon", opcional(d.razon, (t) => leerDecimal(t, ESCALA_RAZON)));
  const pagoFraccion = tomar("pagoFraccion", opcional(d.pagoFraccion, leerFechaIso));
  const montoFraccion = tomar("montoFraccion", opcional(d.montoFraccion, (t) => leerDecimal(t)));
  const nota = d.nota?.trim() ? d.nota.trim() : null;

  if (origen && destino && origen === destino) errores.push({ campo: "destino", codigo: "ORIGEN_IGUAL_A_DESTINO" });
  if (razon !== undefined && razon !== null && !(Number(razon) > 0)) errores.push({ campo: "razon", codigo: "DEBE_SER_POSITIVO" });
  if (montoFraccion !== undefined && montoFraccion !== null && !(Number(montoFraccion) > 0)) errores.push({ campo: "montoFraccion", codigo: "DEBE_SER_POSITIVO" });
  if (fecha && pagoFraccion && pagoFraccion < fecha) errores.push({ campo: "pagoFraccion", codigo: "ANTES_DEL_EVENTO" });
  if (montoFraccion && !pagoFraccion) errores.push({ campo: "pagoFraccion", codigo: "FALTA_CON_MONTO" });
  if (nota && nota.length > MAX_NOTA) errores.push({ campo: "nota", codigo: "DEMASIADO_LARGA" });

  if (errores.length > 0 || !origen || !destino || !fecha || razon === undefined || pagoFraccion === undefined || montoFraccion === undefined) {
    return { ok: false, errores };
  }
  return { ok: true, valor: { origen, destino, fecha, razon, pagoFraccion, montoFraccion, nota } };
}

/** P2002 (clave única): el mismo evento, o un pago de fracción que ya pertenece a otro evento. */
function traducirChoque(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return error;
  const objetivo = JSON.stringify(error.meta?.["target"] ?? "");
  return new ErrorEvento(/pago_fraccion|fechaPagoFraccion/.test(objetivo) ? "PAGO_FRACCION_DUPLICADO" : "EVENTO_DUPLICADO");
}

export interface ResultadoEscision {
  readonly eventoId: string;
  /** Dividendos ya importados como ordinarios que coinciden con el pago de la fracción. */
  readonly dividendosYaImportados: number;
}

/** Registra el evento. No crea instrumentos: un nemotécnico mal escrito se rechaza. */
export async function registrarEscision(db: PrismaClient, e: EscisionValida): Promise<ResultadoEscision> {
  const [origen, destino] = await Promise.all(
    [e.origen, e.destino].map((n) => db.instrumento.findFirst({ where: { OR: [{ nemotecnico: n }, { simboloTrii: n }] }, select: { id: true } })),
  );
  if (!origen || !destino) throw new ErrorEvento("INSTRUMENTO_DESCONOCIDO");

  // La base garantiza la unicidad (índices únicos de la migración eventos_unicos), también ante
  // dos registros simultáneos; aquí solo se traduce el choque a un código claro.
  let evento: { id: string };
  try {
    evento = await db.eventoCorporativo.create({
      data: {
        tipo: "ESCISION", fecha: e.fecha, origenId: origen.id, destinoId: destino.id,
        razon: e.razon === null ? null : new Prisma.Decimal(e.razon),
        fechaPagoFraccion: e.pagoFraccion,
        montoFraccion: e.montoFraccion === null ? null : new Prisma.Decimal(e.montoFraccion),
        nota: e.nota,
      },
      select: { id: true },
    });
  } catch (error) {
    throw traducirChoque(error);
  }
  const dividendosYaImportados = e.pagoFraccion
    ? await db.dividendo.count({ where: { instrumentoId: destino.id, fechaPago: e.pagoFraccion, tipo: { not: "FRACCION_ESCISION" } } })
    : 0;
  return { eventoId: evento.id, dividendosYaImportados };
}
