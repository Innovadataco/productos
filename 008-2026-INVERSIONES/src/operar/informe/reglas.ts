/**
 * Sección «Sus reglas hoy» del informe para operar. Pura. Cada regla de la versión vigente, con su acción, su cantidad,
 * su condición, su nivel y su plazo tal como están en el plan, y cómo está hoy frente a su nivel:
 * - el cierre es el último de la especie (`ultimosCierres`, la fuente de /plan), y cuenta solo si está al día: con fecha
 *   igual o posterior a la referencia del tablero. Un cierre viejo daría una distancia falsa, así que una regla con el
 *   cierre atrasado (o sin cierre, o sin referencia) queda «sin cierre al día» y nunca se cumple;
 * - el estado frente al nivel es el de `estadoDelNivel` (src/plan/niveles.ts), sin cambios;
 * - grupos: se cumplen (TOCADA o EN_EL_NIVEL), cercanas (A_DISTANCIA con menos de UMBRAL_CERCANA_PCT, en valor
 *   absoluto y con los 2 decimales de `estadoDelNivel`) y el resto (lo demás, posturas incluidas);
 * - dentro de cada grupo: especie de la A a la Z, las de portafolio al final y después el id.
 */
import { Prisma } from "@prisma/client";
import type { CierreLeido, ReglaLeida } from "@/plan/lectura";
import { estadoDelNivel } from "@/plan/niveles";
import type { CierreDia, EstadoRegla, GrupoRegla, PlanVigente, ReglaInforme, ReglasInforme } from "./tipos";

/** Menos de esta distancia al nivel (en %, valor absoluto) es una regla «cercana». */
export const UMBRAL_CERCANA_PCT = new Prisma.Decimal(3);

function cierreAlDia(cierre: CierreLeido | undefined, referencia: Date | null): CierreDia | null {
  if (!cierre || referencia === null || cierre.fecha.getTime() < referencia.getTime()) return null;
  return { precio: cierre.precio, fecha: cierre.fecha };
}

function estadoDe(r: ReglaLeida, cierre: CierreLeido | undefined, referencia: Date | null): EstadoRegla {
  if (r.condicion === "NINGUNA" || r.condicion === "LIBRE") return { tipo: "POSTURA" };
  if (r.condicion === "MONTO_ORDEN_BAJO") return { tipo: "POR_ORDEN" };
  if (r.instrumentoId === null) return { tipo: "SIN_ESPECIE" };
  if (r.nivel === null) return { tipo: "SIN_NIVEL" };
  const alDia = cierreAlDia(cierre, referencia);
  const sinCierre: EstadoRegla = { tipo: "SIN_CIERRE_AL_DIA", ultimo: cierre ? { precio: cierre.precio, fecha: cierre.fecha } : null };
  if (alDia === null) return sinCierre;
  const e = estadoDelNivel(r.condicion, r.nivel, alDia.precio);
  switch (e.estado) {
    case "TOCADA":
      return { tipo: "TOCADA", lado: e.lado, cierre: alDia };
    case "EN_EL_NIVEL":
      return { tipo: "EN_EL_NIVEL", cierre: alDia };
    case "A_DISTANCIA":
      return { tipo: "A_DISTANCIA", distanciaPct: e.distanciaPct, cierre: alDia };
    default:
      // SIN_NIVEL o SIN_CIERRE_AL_DIA: con nivel y un cierre positivo no ocurren; si ocurrieran, nunca «se cumple».
      return sinCierre;
  }
}

function grupoDe(e: EstadoRegla): GrupoRegla {
  if (e.tipo === "TOCADA" || e.tipo === "EN_EL_NIVEL") return "SE_CUMPLE";
  if (e.tipo === "A_DISTANCIA" && e.distanciaPct.abs().lt(UMBRAL_CERCANA_PCT)) return "CERCANA";
  return "RESTO";
}

function clasificar(r: ReglaLeida, cierres: ReadonlyMap<string, CierreLeido>, referencia: Date | null, hoy: Date): ReglaInforme {
  const cierre = r.instrumentoId === null ? undefined : cierres.get(r.instrumentoId);
  const estado = estadoDe(r, cierre, referencia);
  return {
    id: r.id, instrumentoId: r.instrumentoId, especie: r.nemotecnico, condicion: r.condicion, nivel: r.nivel, accion: r.accion,
    cantidad: r.cantidad, plazoHasta: r.plazoHasta, plazoVencido: r.plazoHasta !== null && r.plazoHasta.getTime() < hoy.getTime(),
    detalle: r.detalle, estado, grupo: grupoDe(estado),
  };
}

/** Especie de la A a la Z (las de portafolio, al final) y después el id. */
export function porEspecieEId(a: { readonly especie: string | null; readonly id: string }, b: { readonly especie: string | null; readonly id: string }): number {
  if (a.especie !== b.especie) {
    if (a.especie === null || b.especie === null) return a.especie === null ? 1 : -1;
    return a.especie < b.especie ? -1 : 1;
  }
  return Number(a.id > b.id) - Number(a.id < b.id);
}

export function reglasDeHoy(plan: PlanVigente | null, cierres: ReadonlyMap<string, CierreLeido>, referencia: Date | null, hoy: Date): ReglasInforme {
  if (plan === null) return { version: null, seCumplen: [], cercanas: [], resto: [] };
  const todas = plan.reglas.map((r) => clasificar(r, cierres, referencia, hoy)).sort(porEspecieEId);
  const de = (g: GrupoRegla) => todas.filter((r) => r.grupo === g);
  return { version: { numero: plan.numero, vigenteDesde: plan.vigenteDesde }, seCumplen: de("SE_CUMPLE"), cercanas: de("CERCANA"), resto: de("RESTO") };
}
