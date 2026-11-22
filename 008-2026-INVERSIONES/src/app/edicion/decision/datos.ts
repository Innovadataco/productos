/**
 * Qué lee /edicion/decision: las versiones del plan con sus reglas en texto (el formulario cita las de la versión
 * vigente en la fecha de la decisión), las especies y las órdenes aprobadas de Trii SIN decisión (las candidatas a
 * enlazar). Con ?corrige=<id>, la decisión vigente que se corrige, precargada; una corregida o que no existe, no se
 * corrige. Con ?orden=<id> de una orden sin decisión, precarga la decisión de esa orden. Solo lectura; el texto de la
 * dirección nunca se repite en la pantalla: se usa lo que vino de la base.
 */
import "server-only";
import type { AccionPlan, LadoOrden, PrismaClient } from "@prisma/client";
import { cantidadEs } from "@/plan/edicion/formato";
import { listarOrdenesSinDecision } from "@/plan/sin-decision";
import { fechaEnBogota } from "@/precios/horario";
import { idDeConsulta } from "../../_plan/consulta";
import { dia } from "../../_plan/serializar";
import { textoRegla } from "../../_plan/textos";
import { aOrdenOpcion, leerEspecies } from "../lecturas";
import type { DatosEdicionDecision, DecisionEditable, OrdenOpcion, VersionConReglas } from "../tipos";

const ACCION_DEL_LADO: Readonly<Record<LadoOrden, AccionPlan>> = { COMPRA: "COMPRAR", VENTA: "VENDER" };

export interface ConsultaDecision {
  readonly corrige?: string | string[];
  readonly orden?: string | string[];
}

async function leerVersionesConReglas(db: PrismaClient): Promise<VersionConReglas[]> {
  const filas = await db.planVersion.findMany({
    select: {
      version: true, vigenteDesde: true,
      reglas: { select: { id: true, instrumentoId: true, condicion: true, nivel: true, accion: true, instrumento: { select: { nemotecnico: true } } }, orderBy: { id: "asc" } },
    },
    orderBy: { version: "asc" },
  });
  return filas.map((v) => ({
    numero: v.version,
    desde: dia(v.vigenteDesde),
    reglas: v.reglas.map((r) => ({
      id: r.id,
      instrumentoId: r.instrumentoId,
      accion: r.accion,
      texto: `${r.instrumento?.nemotecnico ?? "Portafolio"} · ${textoRegla(r.condicion, r.nivel?.toString() ?? null, r.accion)}`,
    })),
  }));
}

async function decisionACorregir(db: PrismaClient, pedido: string | string[] | undefined) {
  const id = idDeConsulta(pedido);
  if (id === null) return null;
  const d = await db.decision.findUnique({
    where: { id },
    select: { id: true, fechaDecision: true, instrumentoId: true, accion: true, cantidad: true, reglaId: true, excepcion: true, motivo: true, instrumento: { select: { nemotecnico: true } }, reemplazadaPor: { select: { id: true } } },
  });
  return d && d.reemplazadaPor === null ? d : null;
}

function inicialDeOrden(o: OrdenOpcion | undefined, cantidad: bigint | undefined, hoy: Date): DecisionEditable {
  return {
    fechaDecision: o?.fecha ?? dia(hoy), instrumentoId: o?.instrumentoId ?? "", accion: o ? ACCION_DEL_LADO[o.lado] : "NO_ACTUAR",
    cantidad: cantidad === undefined ? "" : cantidadEs(cantidad), reglaId: "", excepcion: false, motivo: "", ordenId: o?.id ?? "",
  };
}

export async function datosEdicionDecision(db: PrismaClient, consulta: ConsultaDecision): Promise<DatosEdicionDecision> {
  const hoy = fechaEnBogota(new Date());
  const [versiones, especies, sinDecision] = await Promise.all([leerVersionesConReglas(db), leerEspecies(db), listarOrdenesSinDecision(db)]);
  if (versiones.length === 0) return { estado: "SIN_PLAN" };
  const ordenesLeidas = [...sinDecision.anterioresAlPlan, ...sinDecision.sinDecision];
  const ordenes = ordenesLeidas.map(aOrdenOpcion);
  const comun = { estado: "LISTO" as const, hoy: dia(hoy), especies, versiones, ordenes };
  if (consulta.corrige !== undefined) {
    const d = await decisionACorregir(db, consulta.corrige);
    if (!d) return { estado: "CORRECCION_INVALIDA" };
    const inicial: DecisionEditable = {
      fechaDecision: dia(d.fechaDecision), instrumentoId: d.instrumentoId, accion: d.accion, cantidad: d.cantidad === null ? "" : cantidadEs(d.cantidad),
      reglaId: d.reglaId ?? "", excepcion: d.excepcion, motivo: d.motivo, ordenId: "",
    };
    return { ...comun, inicial, corrige: { id: d.id, fecha: dia(d.fechaDecision), especie: d.instrumento.nemotecnico ?? "—" } };
  }
  const idOrden = idDeConsulta(consulta.orden);
  const orden = idOrden === null ? undefined : ordenes.find((o) => o.id === idOrden);
  const cantidad = orden ? ordenesLeidas.find((o) => o.id === orden.id)?.cantidadCompletada : undefined;
  return { ...comun, inicial: inicialDeOrden(orden, cantidad, hoy), corrige: null };
}
