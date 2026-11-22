/**
 * Armador REGLAS (E1b): de las reglas de la versión vigente del plan y de los próximos ex-dividendos (`proximos()`), el
 * paquete de hechos del resumen del plan. Puro: sin base, sin red y sin reloj (`hoy` entra como parámetro).
 *
 * - Cada regla tiene su ancla REGLA_DEL_PLAN (valor: el día desde el que rige el plan), que cita a su especie (o a nadie,
 *   si es de portafolio); sus hechos citan al ancla. Así caben varias reglas por especie.
 * - El estado sale de `estadoDelNivel` (src/plan/niveles.ts) con el cierre solo si está al día frente a la referencia del
 *   tablero (`frescuraDelCierre`), igual que la pantalla del plan (src/app/plan/vista.ts): un cierre viejo daría una
 *   distancia falsa. Tocada, en el nivel, a distancia (CERCA si es menor que 3 %) o sin cierre al día.
 * - El nivel va solo en las condiciones de precio (cierre bajo o sobre): el de MONTO_ORDEN_BAJO son pesos por orden.
 *   El plazo va como fecha y, si no venció, con los días que faltan. Una regla sin nada que decir no entra.
 * - De los próximos ex-dividendos, el más cercano de cada especie (los demás, con aviso).
 * - Nunca entran la acción ni la cantidad de la regla, su texto libre ni la tenencia o la referencia de un decreto: las
 *   firmas de entrada no los traen y nada aquí los lee (candado.test.ts y pureza.candado.test.ts).
 * Grupos: cada especie con su cierre, sus reglas y su dividendo; cada regla de portafolio, sola. Prioridad: tocada o en
 * el nivel 1, cerca 2, sin cierre al día 3, a distancia lejos o con dividendo 4, el resto 5. En empate, de la A a la Z.
 */
import { CLAVE_ANCLA_REGLA, type ClaveReglas } from "../catalogo";
import type { DiaIso, PaqueteHechos } from "../contrato";
import { frescuraDelCierre } from "../../plan/cierre-frescura";
import { estadoDelNivel, type EstadoNivel } from "../../plan/niveles";
import { borrador, cerrarPaquete, frescuraConAviso, hastaHoy, type Marcas, type Parte } from "./comun";
import { FUENTES, type CodigoAvisoArmado } from "./constantes";
import { deDecimal, diaDe, diasEntre, exigirDia } from "./decimal";
import { cercaniaDeRegla, direccionDelSigno } from "./derivar";
import type { CierreParaReglas, EntradaArmadoReglas, ProximoParaHechos, ReglaParaHechos } from "./entradas";
import { ErrorArmado } from "./errores";
import type { BorradorHecho, Grupo } from "./grupos";

type Borrador = BorradorHecho<ClaveReglas>;

const PRIORIDAD = Object.freeze({ TOCADA: 1, CERCA: 2, SIN_CIERRE: 3, LEJOS: 4, DIVIDENDO: 4, RESTO: 5 });
const CONDICIONES_DE_PRECIO: ReadonlySet<string> = new Set(["CIERRE_BAJO", "CIERRE_SOBRE"]);
const REF_ESPECIE = "especie";

interface Contexto {
  readonly hoy: DiaIso;
  readonly e: EntradaArmadoReglas;
  readonly vigenteDesde: DiaIso;
}

interface ReglaArmada {
  readonly prioridad: number;
  readonly hechos: readonly Borrador[];
  readonly avisos: readonly CodigoAvisoArmado[];
}

const delPlan = (c: Contexto): Marcas => ({ fecha: c.hoy, frescura: "HOY", origen: "PLAN" });
const calculadoHoy = (c: Contexto): Marcas => ({ fecha: c.hoy, frescura: "HOY", origen: "CALCULO" });

/** El cierre al día, como en la pantalla del plan: solo si no hay ruedas sin cierre entre él y la referencia. */
function cierreAlDia(c: Contexto, cierre: CierreParaReglas | undefined): CierreParaReglas | null {
  if (cierre === undefined) return null;
  return frescuraDelCierre(cierre.fecha, c.e.referencia, c.e.calendario).estado === "AL_DIA" ? cierre : null;
}

/** El hecho del estado del nivel y su prioridad; sin hecho si no hay nada que decir (sin nivel, o sin ningún cierre). */
function hechoDelEstado(c: Contexto, estado: EstadoNivel, cierre: CierreParaReglas | undefined, ancla: string): { readonly hecho: Borrador | null; readonly prioridad: number; readonly avisos: readonly CodigoAvisoArmado[] } {
  if (estado.estado === "SIN_NIVEL" || cierre === undefined) return { hecho: null, prioridad: PRIORIDAD.RESTO, avisos: [] };
  const dia = diaDe(cierre.fecha);
  if (estado.estado === "SIN_CIERRE_AL_DIA") {
    const hecho = borrador("REGLA_SIN_CIERRE_AL_DIA", dia, FUENTES.NIVELES, { fecha: hastaHoy(dia, c.hoy), frescura: "ATRASADO", origen: "CALCULO" }, { sujeto: ancla, obligatorio: true });
    return { hecho, prioridad: PRIORIDAD.SIN_CIERRE, avisos: [] };
  }
  const fresca = frescuraConAviso(dia, c.hoy, c.e.calendario);
  const marcas: Marcas = { fecha: dia, frescura: fresca.frescura, origen: "CALCULO" };
  if (estado.estado === "TOCADA") {
    const hecho = borrador("REGLA_TOCADA", dia, FUENTES.NIVELES, marcas, { sujeto: ancla, direccion: estado.lado === "SOBRE" ? "SUBE" : "BAJA", obligatorio: true });
    return { hecho, prioridad: PRIORIDAD.TOCADA, avisos: fresca.avisos };
  }
  if (estado.estado === "EN_EL_NIVEL") return { hecho: borrador("REGLA_EN_EL_NIVEL", dia, FUENTES.NIVELES, marcas, { sujeto: ancla, obligatorio: true }), prioridad: PRIORIDAD.TOCADA, avisos: fresca.avisos };
  const distancia = deDecimal(estado.distanciaPct);
  const cercania = cercaniaDeRegla(distancia);
  const hecho = borrador("REGLA_DISTANCIA", distancia, FUENTES.NIVELES, marcas, { sujeto: ancla, direccion: direccionDelSigno(distancia), cercania, obligatorio: cercania === "CERCA" });
  return { hecho, prioridad: cercania === "CERCA" ? PRIORIDAD.CERCA : PRIORIDAD.LEJOS, avisos: fresca.avisos };
}

function hechosDelPlazo(c: Contexto, regla: ReglaParaHechos, ancla: string): readonly Borrador[] {
  if (regla.plazoHasta === null) return [];
  const plazo = diaDe(regla.plazoHasta);
  const faltan = diasEntre(c.hoy, plazo);
  return [
    borrador("REGLA_PLAZO", plazo, FUENTES.PLAN, delPlan(c), { sujeto: ancla }),
    ...(faltan < 0 ? [] : [borrador("REGLA_DIAS_AL_PLAZO", String(faltan), FUENTES.NIVELES, calculadoHoy(c), { sujeto: ancla })]),
  ];
}

/** Los hechos de una regla, desde su ancla; null si no hay nada que decir de ella. */
function armarRegla(c: Contexto, regla: ReglaParaHechos, ancla: string, conEspecie: boolean): ReglaArmada | null {
  const cierre = regla.instrumentoId === null ? undefined : c.e.cierres.get(regla.instrumentoId);
  const conNivel = CONDICIONES_DE_PRECIO.has(regla.condicion) && regla.nivel !== null;
  const estado: EstadoNivel = conEspecie ? estadoDelNivel(regla.condicion, regla.nivel, cierreAlDia(c, cierre)?.precio ?? null) : { estado: "SIN_NIVEL" };
  const delEstado = hechoDelEstado(c, estado, cierre, ancla);
  const propios: readonly Borrador[] = [
    ...(conNivel && regla.nivel !== null ? [borrador("REGLA_NIVEL", deDecimal(regla.nivel), FUENTES.PLAN, delPlan(c), { sujeto: ancla })] : []),
    ...(delEstado.hecho === null ? [] : [delEstado.hecho]),
    ...hechosDelPlazo(c, regla, ancla),
  ];
  if (propios.length === 0) return null;
  const anclaHecho = borrador(CLAVE_ANCLA_REGLA, c.vigenteDesde, FUENTES.PLAN, delPlan(c), { ref: ancla, ...(conEspecie ? { sujeto: REF_ESPECIE } : {}) });
  return { prioridad: delEstado.prioridad, hechos: [anclaHecho, ...propios], avisos: delEstado.avisos };
}

function hechosDelCierre(c: Contexto, cierre: CierreParaReglas | undefined): { readonly hechos: readonly Borrador[]; readonly avisos: readonly CodigoAvisoArmado[] } {
  if (cierre === undefined) return { hechos: [], avisos: [] };
  const dia = hastaHoy(diaDe(cierre.fecha), c.hoy);
  const fresca = frescuraConAviso(dia, c.hoy, c.e.calendario);
  const marcas: Marcas = { fecha: dia, frescura: fresca.frescura, origen: cierre.estado === "VERIFICADO" ? "CIERRE_VERIFICADO" : "CIERRE_SIN_VERIFICAR" };
  return {
    hechos: [
      borrador("CIERRE_ESPECIE", deDecimal(cierre.precio), FUENTES.CIERRES, marcas, { sujeto: REF_ESPECIE }),
      borrador("FECHA_CIERRE_ESPECIE", dia, FUENTES.CIERRES, marcas, { sujeto: REF_ESPECIE }),
    ],
    avisos: fresca.avisos,
  };
}

function hechosDelProximo(c: Contexto, p: ProximoParaHechos): readonly Borrador[] {
  const decreto: Marcas = { fecha: hastaHoy(diaDe(p.fechaAnuncio), c.hoy), frescura: "HOY", origen: "DECRETO" };
  const ex = diaDe(p.fechaEx);
  const deEspecie = { sujeto: REF_ESPECIE } as const;
  return [
    borrador("PROXIMO_EX_DIVIDENDO", ex, FUENTES.DECRETOS, decreto, deEspecie),
    borrador("DIAS_A_EX_DIVIDENDO", String(diasEntre(c.hoy, ex)), FUENTES.DECRETOS, calculadoHoy(c), deEspecie),
    borrador("DIVIDENDO_POR_ACCION", deDecimal(p.valorPorAccion), FUENTES.DECRETOS, decreto, deEspecie),
    borrador("DIVIDENDO_FECHA_PAGO", diaDe(p.fechaPago), FUENTES.DECRETOS, decreto, deEspecie),
    ...(p.brutoEstimado === null ? [] : [borrador("DIVIDENDO_BRUTO_ESTIMADO", deDecimal(p.brutoEstimado), FUENTES.DECRETOS, { fecha: c.hoy, frescura: "HOY", origen: "ESTIMACION" }, deEspecie)]),
  ];
}

interface Especie {
  readonly instrumentoId: string;
  readonly nombre: string;
  readonly reglas: readonly ReglaParaHechos[];
  readonly proximo: ProximoParaHechos | null;
}

/** El próximo más cercano de cada especie con nombre (los demás y los sin nombre, con aviso); solo con la ex desde hoy. */
function proximosPorEspecie(c: Contexto): { readonly porEspecie: ReadonlyMap<string, ProximoParaHechos>; readonly avisos: readonly CodigoAvisoArmado[] } {
  const vigentes = c.e.proximos.filter((p) => diaDe(p.fechaEx) >= c.hoy).sort((a, b) => a.fechaEx.getTime() - b.fechaEx.getTime());
  const conNombre = vigentes.filter((p) => p.nemotecnico !== null);
  // El primero de cada especie (los vigentes ya van por fecha ex): el más cercano.
  const porEspecie = conNombre.reduce<ReadonlyMap<string, ProximoParaHechos>>(
    (m, p) => (m.has(p.instrumentoId) ? m : new Map([...m, [p.instrumentoId, p]])), new Map());
  const avisos: CodigoAvisoArmado[] = [
    ...(conNombre.length < vigentes.length ? (["PROXIMO_SIN_NOMBRE"] as const) : []),
    ...(porEspecie.size < conNombre.length ? (["DIVIDENDOS_PROXIMOS_OMITIDOS"] as const) : []),
  ];
  return { porEspecie, avisos };
}

/** Las especies con reglas o con un próximo dividendo, de la A a la Z (por unidades de código). */
function especiesDe(c: Contexto, proximos: ReadonlyMap<string, ProximoParaHechos>): readonly Especie[] {
  const ids = [...new Set([...c.e.reglas.flatMap((r) => (r.instrumentoId !== null && r.nemotecnico !== null ? [r.instrumentoId] : [])), ...proximos.keys()])];
  const especies = ids.map((id): Especie => {
    const reglas = c.e.reglas.filter((r) => r.instrumentoId === id && r.nemotecnico !== null);
    const proximo = proximos.get(id) ?? null;
    return { instrumentoId: id, nombre: reglas[0]?.nemotecnico ?? proximo?.nemotecnico ?? "", reglas, proximo };
  });
  return especies.sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0));
}

function grupoDeEspecie(c: Contexto, especie: Especie): Parte<ClaveReglas> {
  const reglas = especie.reglas.flatMap((r, i) => armarRegla(c, r, `regla-${i + 1}`, true) ?? []);
  if (reglas.length === 0 && especie.proximo === null) return { grupos: [], avisos: [] };
  const cierre = reglas.length === 0 ? { hechos: [], avisos: [] } : hechosDelCierre(c, c.e.cierres.get(especie.instrumentoId));
  const nombre = borrador("ESPECIE_NOMBRE", especie.nombre, FUENTES.REGISTRO, { fecha: c.hoy, frescura: "HOY", origen: "REGISTRO" }, { ref: REF_ESPECIE });
  const prioridad = Math.min(PRIORIDAD.RESTO, ...reglas.map((r) => r.prioridad), especie.proximo === null ? PRIORIDAD.RESTO : PRIORIDAD.DIVIDENDO);
  const hechos = [nombre, ...cierre.hechos, ...reglas.flatMap((r) => r.hechos), ...(especie.proximo === null ? [] : hechosDelProximo(c, especie.proximo))];
  return { grupos: [{ prioridad, hechos }], avisos: [...cierre.avisos, ...reglas.flatMap((r) => r.avisos)] };
}

function gruposDePortafolio(c: Contexto): Parte<ClaveReglas> {
  const reglas = c.e.reglas.filter((r) => r.instrumentoId === null).flatMap((r) => armarRegla(c, r, "regla", false) ?? []);
  const grupos: readonly Grupo<ClaveReglas>[] = reglas.map((r) => ({ prioridad: r.prioridad, hechos: r.hechos }));
  return { grupos, avisos: reglas.flatMap((r) => r.avisos) };
}

/** El paquete REGLAS, armado con `construirPaquete`. Cierra en fallo con ErrorArmado o ErrorPaquete. */
export function armarReglas(e: EntradaArmadoReglas): PaqueteHechos<"REGLAS"> {
  const hoy = exigirDia(e.hoy, "HOY_INVALIDO");
  const vigenteDesde = diaDe(e.vigenteDesde);
  if (vigenteDesde > hoy) throw new ErrorArmado("VERSION_NO_VIGENTE");
  const c: Contexto = { hoy, e, vigenteDesde };
  const sinNombre = e.reglas.some((r) => r.instrumentoId !== null && r.nemotecnico === null);
  const proximos = proximosPorEspecie(c);
  const partes = [
    { grupos: [], avisos: sinNombre ? (["REGLA_SIN_NOMBRE"] as const) : [] },
    { grupos: [], avisos: proximos.avisos },
    ...especiesDe(c, proximos.porEspecie).map((especie) => grupoDeEspecie(c, especie)),
    gruposDePortafolio(c),
  ];
  return cerrarPaquete("REGLAS", hoy, partes);
}
