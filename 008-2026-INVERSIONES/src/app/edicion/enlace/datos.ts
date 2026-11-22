/**
 * Qué lee /edicion/enlace?decision=<id>: la decisión (vigente, y que no sea «no actuar») y las órdenes aprobadas de Trii
 * sin decisión que caben en ella: de su especie, del lado de su acción y no anteriores a su fecha (las mismas reglas que
 * `validarEnlace`, que el servidor vuelve a aplicar al guardar). Solo lectura; el id de la dirección no se repite.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { listarOrdenesSinDecision } from "@/plan/sin-decision";
import { idDeConsulta } from "../../_plan/consulta";
import { dia } from "../../_plan/serializar";
import { fecha } from "../../tablero/formato";
import { aOrdenOpcion } from "../lecturas";
import { textoAccionDecisionCorta } from "../textos";
import type { DatosEdicionEnlace } from "../tipos";

const LADO = { COMPRAR: "COMPRA", VENDER: "VENTA" } as const;

export async function datosEdicionEnlace(db: PrismaClient, pedido: string | string[] | undefined): Promise<DatosEdicionEnlace> {
  const id = idDeConsulta(pedido);
  if (id === null) return { estado: "NO_EXISTE" };
  const d = await db.decision.findUnique({
    where: { id },
    select: { id: true, accion: true, instrumentoId: true, fechaDecision: true, instrumento: { select: { nemotecnico: true } }, reemplazadaPor: { select: { id: true } } },
  });
  if (!d) return { estado: "NO_EXISTE" };
  if (d.reemplazadaPor) return { estado: "REEMPLAZADA", corregidaPor: d.reemplazadaPor.id };
  if (d.accion === "NO_ACTUAR") return { estado: "NO_ACTUAR", id: d.id };
  const lado = LADO[d.accion];
  const { sinDecision, anterioresAlPlan } = await listarOrdenesSinDecision(db);
  const ordenes = [...anterioresAlPlan, ...sinDecision].filter((o) => o.instrumentoId === d.instrumentoId && o.lado === lado && o.fechaOperacion >= d.fechaDecision);
  const texto = `${textoAccionDecisionCorta(d.accion)} · ${d.instrumento.nemotecnico ?? "—"} · ${fecha(dia(d.fechaDecision))}`;
  return { estado: "LISTO", decision: { id: d.id, texto }, ordenes: ordenes.map(aOrdenOpcion) };
}
