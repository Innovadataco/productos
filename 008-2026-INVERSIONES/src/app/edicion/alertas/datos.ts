/**
 * Qué lee /edicion/alertas: las últimas versiones de los umbrales (la primera es la vigente y la última versión, contra la
 * que se crea la nueva). Sin versiones, la omisión del motor. Solo lectura.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { UMBRALES_OMISION, type Umbrales } from "@/alertas/umbrales";
import { fecha } from "../../tablero/formato";
import type { DatosEdicionAlertas, ValoresAlertas, VersionUmbralVista } from "./tipos-alertas";

const HISTORIA = 20;
const VERSION = /^[1-9][0-9]{0,8}$/;
const DESFASE_BOGOTA_MS = 5 * 3_600_000;

const coma = (n: number): string => String(n).replace(".", ",");

export function valoresDe(u: Umbrales): ValoresAlertas {
  return {
    alertaCercaPct: coma(u.alertaCercaPct), alertaCercaActiva: u.alertaCercaActiva, alertaNivelCruzadoActiva: u.alertaNivelCruzadoActiva,
    alertaMovimientoPct: coma(u.alertaMovimientoPct), alertaMovimientoActiva: u.alertaMovimientoActiva,
    alertaCaidaPct: coma(u.alertaCaidaPct), alertaCaidaActiva: u.alertaCaidaActiva,
    alertaDatoViejoMin: String(u.alertaDatoViejoMin), alertaDatoViejoActiva: u.alertaDatoViejoActiva,
    alertaExDiasHabiles: String(u.alertaExDiasHabiles), alertaExActiva: u.alertaExActiva,
  };
}

const apagada = (activa: boolean): string => (activa ? "" : " (apagada)");

/** «Nivel cruzado · Cerca 3,5 % · Movimiento 4 % (apagada) · …»: lo que quedó fijado en esa versión. */
export function resumenDe(u: Umbrales): string {
  return [
    `Nivel cruzado${apagada(u.alertaNivelCruzadoActiva)}`,
    `Cerca ${coma(u.alertaCercaPct)} %${apagada(u.alertaCercaActiva)}`,
    `Movimiento ${coma(u.alertaMovimientoPct)} %${apagada(u.alertaMovimientoActiva)}`,
    `Caída ${coma(u.alertaCaidaPct)} %${apagada(u.alertaCaidaActiva)}`,
    `Dato viejo ${u.alertaDatoViejoMin} min${apagada(u.alertaDatoViejoActiva)}`,
    `Fecha ex ${u.alertaExDiasHabiles} días hábiles${apagada(u.alertaExActiva)}`,
  ].join(" · ");
}

/** «17-mar-2027 18:41», en hora de Colombia. */
function fechaHora(instante: Date): string {
  const bogota = new Date(instante.getTime() - DESFASE_BOGOTA_MS).toISOString();
  return `${fecha(bogota.slice(0, 10))} ${bogota.slice(11, 16)}`;
}

export async function datosEdicionAlertas(db: Pick<PrismaClient, "umbralVersion">, guardada: string | string[] | undefined): Promise<DatosEdicionAlertas> {
  const filas = await db.umbralVersion.findMany({ orderBy: { version: "desc" }, take: HISTORIA });
  const historia: VersionUmbralVista[] = filas.map((f) => ({
    version: f.version,
    creada: fechaHora(f.creadaEn),
    motivo: f.motivo,
    resumen: resumenDe({
      alertaCercaPct: f.alertaCercaPct.toNumber(), alertaCercaActiva: f.alertaCercaActiva, alertaNivelCruzadoActiva: f.alertaNivelCruzadoActiva,
      alertaMovimientoPct: f.alertaMovimientoPct.toNumber(), alertaMovimientoActiva: f.alertaMovimientoActiva, alertaCaidaPct: f.alertaCaidaPct.toNumber(),
      alertaCaidaActiva: f.alertaCaidaActiva, alertaDatoViejoMin: f.alertaDatoViejoMin, alertaDatoViejoActiva: f.alertaDatoViejoActiva,
      alertaExDiasHabiles: f.alertaExDiasHabiles, alertaExActiva: f.alertaExActiva,
    }),
  }));
  const vigente = filas[0];
  const n = typeof guardada === "string" && VERSION.test(guardada) ? Number(guardada) : null;
  return {
    ultimaVersion: vigente?.version ?? 0,
    porOmision: vigente === undefined,
    valores: valoresDe(
      vigente === undefined
        ? UMBRALES_OMISION
        : {
            alertaCercaPct: vigente.alertaCercaPct.toNumber(), alertaCercaActiva: vigente.alertaCercaActiva, alertaNivelCruzadoActiva: vigente.alertaNivelCruzadoActiva,
            alertaMovimientoPct: vigente.alertaMovimientoPct.toNumber(), alertaMovimientoActiva: vigente.alertaMovimientoActiva, alertaCaidaPct: vigente.alertaCaidaPct.toNumber(),
            alertaCaidaActiva: vigente.alertaCaidaActiva, alertaDatoViejoMin: vigente.alertaDatoViejoMin, alertaDatoViejoActiva: vigente.alertaDatoViejoActiva,
            alertaExDiasHabiles: vigente.alertaExDiasHabiles, alertaExActiva: vigente.alertaExActiva,
          },
    ),
    historia,
    guardada: n !== null && historia.some((h) => h.version === n) ? n : null,
  };
}
