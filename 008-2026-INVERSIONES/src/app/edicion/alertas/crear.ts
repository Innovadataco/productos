import "server-only";
/**
 * Una versión NUEVA de los umbrales de las alertas, contra la última que vio el formulario: si otra entró en medio (también
 * si dos llegan a la vez y chocan en la versión única), UMBRAL_CAMBIO sin escribir nada. El autor sale de la sesión (lo pasa la
 * ruta), nunca del cuerpo. La hora la pone la base. Nada se edita: la nueva reemplaza a la vigente y la anterior queda en la
 * historia. Corre como inv_app (INSERT por columna, sin "creadaEn"). Es el ÚNICO módulo que escribe los umbrales.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Umbrales } from "@/alertas/umbrales";
import { ErrorUmbral } from "./errores";

export interface EntradaUmbrales {
  readonly umbrales: Umbrales;
  readonly motivo: string;
}

export interface OpcionesCrearUmbral {
  readonly autorId: string;
  /** La última versión que vio el formulario (0 si todavía no había ninguna). */
  readonly ultimaEsperada: number;
}

const decimal = (n: number): Prisma.Decimal => new Prisma.Decimal(n.toFixed(2));

const datos = (e: EntradaUmbrales, version: number, autorId: string): Prisma.UmbralVersionUncheckedCreateInput => ({
  version,
  alertaCercaPct: decimal(e.umbrales.alertaCercaPct),
  alertaCercaActiva: e.umbrales.alertaCercaActiva,
  alertaNivelCruzadoActiva: e.umbrales.alertaNivelCruzadoActiva,
  alertaMovimientoPct: decimal(e.umbrales.alertaMovimientoPct),
  alertaMovimientoActiva: e.umbrales.alertaMovimientoActiva,
  alertaCaidaPct: decimal(e.umbrales.alertaCaidaPct),
  alertaCaidaActiva: e.umbrales.alertaCaidaActiva,
  alertaDatoViejoMin: e.umbrales.alertaDatoViejoMin,
  alertaDatoViejoActiva: e.umbrales.alertaDatoViejoActiva,
  alertaExDiasHabiles: e.umbrales.alertaExDiasHabiles,
  alertaExActiva: e.umbrales.alertaExActiva,
  motivo: e.motivo,
  autorId,
});

const codigoPrisma = (error: unknown): string | null => (error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null);

/** Crea la versión siguiente a `ultimaEsperada`. Lanza ErrorUmbral (UMBRAL_CAMBIO o AUTOR_INEXISTENTE). */
export async function crearVersionUmbral(db: Pick<PrismaClient, "umbralVersion">, entrada: EntradaUmbrales, opciones: OpcionesCrearUmbral): Promise<{ readonly version: number }> {
  const ultima = (await db.umbralVersion.findFirst({ orderBy: { version: "desc" }, select: { version: true } }))?.version ?? 0;
  if (ultima !== opciones.ultimaEsperada) throw new ErrorUmbral("UMBRAL_CAMBIO");
  try {
    const creada = await db.umbralVersion.create({ data: datos(entrada, ultima + 1, opciones.autorId), select: { version: true } });
    return Object.freeze({ version: creada.version });
  } catch (error) {
    if (codigoPrisma(error) === "P2002") throw new ErrorUmbral("UMBRAL_CAMBIO");
    if (codigoPrisma(error) === "P2003") throw new ErrorUmbral("AUTOR_INEXISTENTE");
    // El disparador umbral_version_autor: el autor no es el dueño de la cuenta (su mensaje no lleva valores).
    if (error instanceof Error && error.message.includes("solo el dueño firma una versión de umbrales")) throw new ErrorUmbral("AUTOR_INEXISTENTE");
    throw error;
  }
}
