/**
 * Lecturas que comparten las páginas del área de edición (fase B, PR-B). Solo lectura y con `select` explícito.
 * Las especies son las acciones registradas (las del plan y las de Trii), por nemotécnico.
 */
import "server-only";
import type { LadoOrden } from "@prisma/client";
import type { Db } from "@/plan/acceso";
import { cantidadEs } from "@/plan/edicion/formato";
import { dia } from "../_plan/serializar";
import { fecha } from "../tablero/formato";
import type { EspecieOpcion, OrdenOpcion } from "./tipos";

export async function leerEspecies(db: Db): Promise<EspecieOpcion[]> {
  const filas = await db.instrumento.findMany({ where: { tipo: "ACCION", nemotecnico: { not: null } }, select: { id: true, nemotecnico: true }, orderBy: { nemotecnico: "asc" } });
  return filas.map((f) => ({ id: f.id, nemotecnico: f.nemotecnico ?? "" }));
}

const LADO: Readonly<Record<LadoOrden, string>> = { COMPRA: "Compra", VENTA: "Venta" };

export interface OrdenLeida {
  readonly id: string;
  readonly instrumentoId: string;
  readonly nemotecnico: string | null;
  readonly fechaOperacion: Date;
  readonly lado: LadoOrden;
  readonly cantidadCompletada: bigint;
}

/** «14-nov-2024 · FICTI · Venta de 20». */
export const aOrdenOpcion = (o: OrdenLeida): OrdenOpcion => ({
  id: o.id,
  instrumentoId: o.instrumentoId,
  fecha: dia(o.fechaOperacion),
  lado: o.lado,
  texto: `${fecha(dia(o.fechaOperacion))} · ${o.nemotecnico ?? "—"} · ${LADO[o.lado]} de ${cantidadEs(o.cantidadCompletada)}`,
});
