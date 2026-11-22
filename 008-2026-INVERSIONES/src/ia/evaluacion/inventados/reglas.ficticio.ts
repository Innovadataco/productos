/**
 * Entradas INVENTADAS del armador REGLAS (E7): la versión vigente del plan con reglas de precio por especie (tocadas,
 * en el nivel, cerca o lejos de su nivel, con plazo o sin él, con un cierre al día o atrasado), reglas de portafolio con
 * plazo y los próximos ex-dividendos. La primera regla de cada caso rota entre tocada, cerca y lejos, para que el modelo
 * vea las tres. Solo los campos que lee el armador: ni acción, ni cantidad, ni texto libre. Especies FICTICIA-*.
 */
import type { Prisma } from "@prisma/client";
import type { Prng } from "../../../proyecciones/prng";
import type { CierreParaReglas, EntradaArmadoReglas, ProximoParaHechos, ReglaParaHechos } from "../../hechos";
import { CALENDARIO_INVENTADO, decimal, dentroDelAnio, dia, elegir, entero, habilDesde, hoyInventado, instrumento, nombres, real, siQue, sumarDiasIso } from "./comun.ficticio";

const CLASES = Object.freeze(["TOCADA", "CERCA", "LEJOS"] as const);
type Clase = (typeof CLASES)[number] | "EN_EL_NIVEL" | "SIN_NIVEL";

/** El nivel de una regla según la clase pedida, frente al cierre (CERCA: a menos de 3 %). */
function nivel(p: Prng, condicion: "CIERRE_BAJO" | "CIERRE_SOBRE", clase: Clase, precio: number): Prisma.Decimal {
  const lado = condicion === "CIERRE_SOBRE" ? 1 : -1;
  const factor = clase === "TOCADA" ? 1 - lado * real(p, 0.011, 0.09) : clase === "CERCA" ? 1 + lado * real(p, 0.003, 0.027) : 1 + lado * real(p, 0.041, 0.37);
  return clase === "EN_EL_NIVEL" ? decimal(precio, 2) : decimal(precio * factor, 2);
}

function plazo(p: Prng, hoy: string): Date | null {
  if (!siQue(p, 0.45)) return null;
  return dia(dentroDelAnio(sumarDiasIso(hoy, siQue(p, 0.12) ? -entero(p, 3, 23) : entero(p, 3, 131))));
}

function reglasDeEspecie(p: Prng, nombre: string, precio: number, hoy: string, primera: Clase | null): readonly ReglaParaHechos[] {
  const cuantas = entero(p, 1, 2);
  return Array.from({ length: cuantas }, (_, i) => {
    const clase: Clase = i === 0 && primera !== null ? primera : siQue(p, 0.05) ? "EN_EL_NIVEL" : siQue(p, 0.12) ? "SIN_NIVEL" : elegir(p, CLASES);
    const condicion = clase === "SIN_NIVEL" ? elegir(p, ["LIBRE", "NINGUNA"] as const) : elegir(p, ["CIERRE_BAJO", "CIERRE_SOBRE"] as const);
    const conNivel = condicion === "CIERRE_BAJO" || condicion === "CIERRE_SOBRE";
    return {
      instrumentoId: instrumento(nombre), nemotecnico: nombre, condicion,
      nivel: conNivel ? nivel(p, condicion, clase, precio) : null,
      plazoHasta: clase === "SIN_NIVEL" ? dia(dentroDelAnio(sumarDiasIso(hoy, entero(p, 7, 97)))) : plazo(p, hoy),
    };
  });
}

function proximo(p: Prng, nombre: string, hoy: string): ProximoParaHechos {
  const ex = sumarDiasIso(hoy, entero(p, 1, 61));
  return {
    instrumentoId: instrumento(nombre), nemotecnico: nombre, valorPorAccion: decimal(real(p, 13, 913), 2), fechaAnuncio: dia(dentroDelAnio(sumarDiasIso(hoy, -entero(p, 7, 29)))),
    fechaEx: dia(ex), fechaPago: dia(sumarDiasIso(ex, entero(p, 9, 21))), brutoEstimado: siQue(p, 0.7) ? decimal(real(p, 413, 97_131), 2) : null,
  };
}

/** La entrada REGLAS número `indice` (desde 0), con el azar dado. */
export function entradaReglasInventada(p: Prng, indice: number): EntradaArmadoReglas {
  const hoy = hoyInventado(p);
  const referencia = siQue(p, 0.5) ? hoy : habilDesde(hoy, -1);
  const especies = nombres(p, entero(p, 1, 4) + 1);
  const conReglas = especies.slice(0, -1);
  const soloDividendo = siQue(p, 0.4) ? especies.slice(-1) : [];
  const cierres = new Map<string, CierreParaReglas>();
  const reglas: ReglaParaHechos[] = [];
  conReglas.forEach((nombre, i) => {
    const precio = real(p, 1237, 97_131);
    const atrasado = i > 0 && siQue(p, 0.15);
    cierres.set(instrumento(nombre), { fecha: dia(dentroDelAnio(atrasado ? habilDesde(referencia, -entero(p, 2, 5)) : referencia)), precio: decimal(precio, 2), estado: siQue(p, 0.7) ? "VERIFICADO" : "NO_VERIFICADO" });
    reglas.push(...reglasDeEspecie(p, nombre, precio, hoy, i === 0 ? (CLASES[indice % CLASES.length] as Clase) : null));
  });
  if (siQue(p, 0.4)) reglas.push({ instrumentoId: null, nemotecnico: null, condicion: "MONTO_ORDEN_BAJO", nivel: decimal(real(p, 413, 4613), 2), plazoHasta: dia(dentroDelAnio(sumarDiasIso(hoy, entero(p, 11, 157)))) });
  const conDividendo = [...conReglas.filter(() => siQue(p, 0.4)), ...soloDividendo];
  return {
    hoy, calendario: CALENDARIO_INVENTADO, vigenteDesde: dia(dentroDelAnio(sumarDiasIso(hoy, -entero(p, 5, 41)))), reglas, cierres,
    referencia: dia(referencia), proximos: conDividendo.map((nombre) => proximo(p, nombre, hoy)),
  };
}
