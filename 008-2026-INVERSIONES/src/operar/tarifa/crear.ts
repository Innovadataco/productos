import "server-only";
/**
 * Una versión NUEVA de la tarifa de comisión (O5), contra la última que vio el formulario: si otra entró en medio
 * (también si dos llegan a la vez y chocan en la versión única), TARIFA_CAMBIO sin escribir nada. El autor sale de la
 * sesión (lo pasa la ruta), nunca del cuerpo. La hora la pone la base. Nada se edita: la nueva reemplaza a la vigente
 * desde su fecha y la anterior queda en la historia. Corre como inv_app (INSERT por columna, sin "creadaEn"). Es el
 * ÚNICO módulo que escribe la tarifa: los lectores (leer.ts) no lo importan, así el simulador no alcanza una escritura.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { ErrorTarifa } from "./errores";
import type { EntradaTarifa } from "./pedido";

export interface OpcionesCrearTarifa {
  readonly autorId: string;
  /** La última versión que vio el formulario (0 si todavía no había ninguna). */
  readonly ultimaEsperada: number;
}

const datos = (e: EntradaTarifa, version: number, autorId: string): Prisma.TarifaComisionUncheckedCreateInput => ({
  version,
  comisionista: e.comisionista,
  lado: e.lado,
  porcentaje: new Prisma.Decimal(e.porcentaje),
  minimoPorOrden: new Prisma.Decimal(e.minimoPorOrden),
  fijoPorOrden: new Prisma.Decimal(e.fijoPorOrden),
  ivaPct: new Prisma.Decimal(e.ivaPct),
  otrosCargos: e.otrosCargos.map((c) => ({ nombre: c.nombre, tipo: c.tipo, valor: c.valor })),
  vigenteDesde: e.vigenteDesde,
  motivo: e.motivo,
  autorId,
});

const codigoPrisma = (error: unknown): string | null => (error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null);

/** Crea la versión siguiente a `ultimaEsperada`. Lanza ErrorTarifa (TARIFA_CAMBIO o AUTOR_INEXISTENTE). */
export async function crearVersionTarifa(db: Pick<PrismaClient, "tarifaComision">, entrada: EntradaTarifa, opciones: OpcionesCrearTarifa): Promise<{ readonly version: number }> {
  const ultima = (await db.tarifaComision.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
  if (ultima !== opciones.ultimaEsperada) throw new ErrorTarifa("TARIFA_CAMBIO");
  try {
    const creada = await db.tarifaComision.create({ data: datos(entrada, ultima + 1, opciones.autorId), select: { version: true } });
    return Object.freeze({ version: creada.version });
  } catch (error) {
    if (codigoPrisma(error) === "P2002") throw new ErrorTarifa("TARIFA_CAMBIO");
    if (codigoPrisma(error) === "P2003") throw new ErrorTarifa("AUTOR_INEXISTENTE");
    throw error;
  }
}
