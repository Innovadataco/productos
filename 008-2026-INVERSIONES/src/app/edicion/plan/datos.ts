/**
 * Qué precarga /edicion/plan: la versión base (la vigente hoy o, si todavía no rige ninguna, la primera programada; o
 * la pedida en ?base si existe), con el nivel y la cantidad en es-CO como los lee la ficha; la última versión (contra
 * ella se crea la nueva, para no pisar otra) y la fecha propuesta, que no retrocede. Solo lectura.
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { cantidadEs, nivelEs } from "@/plan/edicion/formato";
import { leerReglas, leerVersiones, type VersionLeida } from "@/plan/lectura";
import { fechaEnBogota } from "@/precios/horario";
import { versionDeConsulta } from "../../_plan/consulta";
import { dia } from "../../_plan/serializar";
import { vigenteEn } from "../../plan/vista";
import { leerEspecies } from "../lecturas";
import type { DatosEdicionPlan, ReglaEditable, VersionResumen } from "../tipos";

const resumen = (v: VersionLeida, vigente: VersionLeida | null, hoy: Date): VersionResumen => ({
  numero: v.version,
  desde: dia(v.vigenteDesde),
  tipo: v.vigenteDesde > hoy ? "PROGRAMADA" : v.id === vigente?.id ? "VIGENTE" : "HISTORICA",
});

export async function datosEdicionPlan(db: PrismaClient, pedido: string | string[] | undefined): Promise<DatosEdicionPlan> {
  const hoy = fechaEnBogota(new Date());
  const [versiones, especies] = await Promise.all([leerVersiones(db), leerEspecies(db)]);
  const vigente = vigenteEn(versiones, hoy);
  const numero = versionDeConsulta(pedido);
  const pedida = numero === null ? undefined : versiones.find((v) => v.version === numero);
  const base = pedida ?? vigente ?? [...versiones].sort((a, b) => a.version - b.version)[0] ?? null;
  const ultima = versiones[0] ?? null; // leerVersiones ordena de la más nueva a la más vieja
  const reglas = base ? await leerReglas(db, base.id) : [];
  const desde = ultima && ultima.vigenteDesde > hoy ? ultima.vigenteDesde : hoy;
  return {
    hoy: dia(hoy),
    ultima: ultima ? resumen(ultima, vigente, hoy) : null,
    base: base ? resumen(base, vigente, hoy) : null,
    versiones: versiones.map((v) => resumen(v, vigente, hoy)),
    especies,
    reglas: reglas.map(
      (r): ReglaEditable => ({
        instrumentoId: r.instrumentoId,
        condicion: r.condicion,
        nivel: r.nivel === null ? "" : nivelEs(r.nivel.toString()),
        accion: r.accion,
        cantidad: r.cantidad === null ? "" : cantidadEs(r.cantidad),
        plazoHasta: r.plazoHasta ? dia(r.plazoHasta) : "",
        detalle: r.detalle,
      }),
    ),
    vigenteDesde: dia(desde),
  };
}
