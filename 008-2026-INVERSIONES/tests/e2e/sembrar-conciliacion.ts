/**
 * Siembra de la conciliación para el E2E de /conciliacion (PR-C). La llama tests/e2e/sembrar.ts después de los
 * cierres. Dos certificaciones FICTICIAS (el PDF lo genera el generador de pruebas; datos inventados), importadas
 * con el importador de 008 y conciliadas, sin fondo:
 *   22-nov-2024 · FICTA 100 a 1.100 y FICTB 80 a 1.913 cuadran con el sistema y con sus cierres de ese día;
 *                 FICTC 10 a 505 no tiene cierre de ese día (no se pudo verificar); FICTI está en el sistema y
 *                 no en la certificación; el efectivo tiene una partida que ningún archivo explica.
 *   14-nov-2024 · FICTB 80: la venta del 13-nov se liquida el 15-nov (T+2); la de FICTI del 14-nov, el 18-nov.
 *                 Sin cierres de ese día: ningún valor se pudo verificar.
 */
import type { PrismaClient } from "@prisma/client";
import { conciliarCertificacion } from "../../src/conciliacion/conciliar";
import { importarCertificacion } from "../../src/importacion/av/importar";
import { CERTIFICACION_FICTICIA, generarCertificacionPdf, type PosicionFicticia } from "../fixtures/av/certificacion.ficticio";

const posicion = (nemo: string, cantidad: string, precio: string, valor: string): PosicionFicticia => ({ nemo, cantidad, precio: `COP ${precio},00`, valor: `COP ${valor},00` });

const CERTIFICACIONES = [
  { corte: "2024-11-22", rentaVariable: [posicion("FICTA", "100", "1.100", "110.000"), posicion("FICTB", "80", "1.913", "153.040"), posicion("FICTC", "10", "505", "5.050")] },
  { corte: "2024-11-14", rentaVariable: [posicion("FICTA", "100", "1.000", "100.000"), posicion("FICTB", "80", "2.000", "160.000"), posicion("FICTC", "10", "500", "5.000")] },
] as const;

export async function sembrarConciliacion(db: PrismaClient, usuarioId: string): Promise<void> {
  for (const { corte, rentaVariable } of CERTIFICACIONES) {
    const fechaCorte = new Date(`${corte}T00:00:00Z`);
    const espec = { ...CERTIFICACION_FICTICIA, fondos: [], rentaVariable, creadoEn: `D:${corte.replace(/-/g, "")}180000-05'00'` };
    const r = await importarCertificacion(db, { contenido: generarCertificacionPdf(espec), usuarioId, fechaCorte });
    if (r.estado !== "CARGADO") throw new Error(`La certificación ficticia del ${corte} quedó ${r.estado}: ${r.errores.map((e) => e.codigo).join(", ")}`);
    await conciliarCertificacion(db, { fechaCorte });
  }
}
