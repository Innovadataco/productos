/**
 * Armador REGLAS (E1b): de las reglas de la versión vigente del plan y de los próximos ex-dividendos (`proximos()`), el
 * paquete de hechos del resumen del plan. Puro: sin base, sin red y sin reloj (`hoy` entra como parámetro).
 *
 * - Cada regla tiene su ancla REGLA_DEL_PLAN (valor: el día desde el que rige el plan), que cita a su especie (o a nadie,
 *   si es de portafolio); sus hechos citan al ancla. Así caben varias reglas por especie.
 * - El estado sale de `estadoDelNivel` (src/plan/niveles.ts) con el cierre solo si está al día frente a la referencia del
 *   tablero (`frescuraDelCierre`), igual que la pantalla del plan (src/app/plan/vista.ts): un cierre viejo daría una
 *   distancia falsa. Tocada, en el nivel, a distancia (CERCA si es menor que 3 %) o sin cierre al día.
 * - El nivel va solo en las condiciones de precio (cierre bajo o sobre) de una especie: el de MONTO_ORDEN_BAJO son pesos
 *   por orden y una regla de portafolio no tiene precio que comparar. El plazo va como fecha y, si no venció, con los días
 *   que faltan. Una regla sin nada que decir no entra.
 * - De los próximos ex-dividendos, el más cercano de cada especie (los demás, con aviso). Lo vigente (plan, decretos)
 *   va con la fecha de hoy y frescura HOY.
 * - Nunca entran la acción ni la cantidad de la regla, su texto libre ni la tenencia o la referencia de un decreto: las
 *   firmas de entrada no los traen y nada aquí los lee (candado.test.ts y pureza.candado.test.ts).
 * Grupos: cada especie con su cierre, sus reglas y su dividendo; cada regla de portafolio, sola. Prioridad: tocada o en
 * el nivel 1, cerca 2, sin cierre al día 3, a distancia lejos o con dividendo 4, el resto 5. En empate, de la A a la Z.
 */
import type { ClaveReglas } from "../catalogo";
import type { DiaIso, PaqueteHechos } from "../contrato";
import { frescuraDelCierre } from "../../plan/cierre-frescura";
import { estadoDelNivel, type EstadoNivel } from "../../plan/niveles";
import { borrador, cerrarPaquete, conOrigen, marcasAtrasadas, marcasDeHoy, marcasDeMercado, type Parte } from "./comun";
import { FUENTES, type CodigoAvisoArmado } from "./constantes";
import { compararTexto, deDecimal, deEntero, diaDe, diasEntre, exigirDia } from "./decimal";
import { cercaniaDeRegla, direccionDelSigno } from "./derivar";
import type { CierreParaReglas, EntradaArmadoReglas, ProximoParaHechos, ReglaParaHechos } from "./entradas";
import { ErrorArmado } from "./errores";
import type { BorradorHecho, Grupo } from "./grupos";

type Borrador = BorradorHecho<ClaveReglas>;
type Ancla = BorradorHecho<"REGLA_DEL_PLAN">;
type Especie = BorradorHecho<"ESPECIE_NOMBRE">;

const PRIORIDAD = Object.freeze({ TOCADA: 1, CERCA: 2, SIN_CIERRE: 3, LEJOS: 4, DIVIDENDO: 4, RESTO: 5 });
const CONDICIONES_DE_PRECIO: ReadonlySet<string> = new Set(["CIERRE_BAJO", "CIERRE_SOBRE"]);

interface Contexto {
  readonly hoy: DiaIso;
  readonly e: EntradaArmadoReglas;
  readonly vigenteDesde: DiaIso;
}

interface Armado {
  readonly prioridad: number;
  readonly hechos: readonly Borrador[];
  readonly avisos: readonly CodigoAvisoArmado[];
}

/** El cierre al día, como en la pantalla del plan: solo si no hay ruedas sin cierre entre él y la referencia. */
function cierreAlDia(c: Contexto, cierre: CierreParaReglas | undefined): CierreParaReglas | null {
  if (cierre === undefined) return null;
  return frescuraDelCierre(cierre.fecha, c.e.referencia, c.e.calendario).estado === "AL_DIA" ? cierre : null;
}

const SIN_ESTADO: Armado = { prioridad: PRIORIDAD.RESTO, hechos: [], avisos: [] };

/** El hecho del estado del nivel y su prioridad; sin hecho si no hay nada que decir (sin nivel, o sin ningún cierre). */
function hechoDelEstado(c: Contexto, estado: EstadoNivel, cierre: CierreParaReglas | undefined, ancla: Ancla): Armado {
  if (estado.estado === "SIN_NIVEL" || cierre === undefined) return SIN_ESTADO;
  const dia = diaDe(cierre.fecha);
  if (estado.estado === "SIN_CIERRE_AL_DIA") {
    const hecho = borrador("REGLA_SIN_CIERRE_AL_DIA", dia, FUENTES.NIVELES, marcasAtrasadas(dia, c.hoy, "CALCULO"), { sujeto: ancla, obligatorio: true });
    return { prioridad: PRIORIDAD.SIN_CIERRE, hechos: [hecho], avisos: [] };
  }
  const { marcas, avisos } = marcasDeMercado(dia, c.hoy, c.e.calendario, "CALCULO");
  if (estado.estado === "TOCADA") {
    const hecho = borrador("REGLA_TOCADA", dia, FUENTES.NIVELES, marcas, { sujeto: ancla, direccion: estado.lado === "SOBRE" ? "SUBE" : "BAJA", obligatorio: true });
    return { prioridad: PRIORIDAD.TOCADA, hechos: [hecho], avisos };
  }
  if (estado.estado === "EN_EL_NIVEL") return { prioridad: PRIORIDAD.TOCADA, hechos: [borrador("REGLA_EN_EL_NIVEL", dia, FUENTES.NIVELES, marcas, { sujeto: ancla, obligatorio: true })], avisos };
  const distancia = deDecimal(estado.distanciaPct);
  const cercania = cercaniaDeRegla(distancia);
  const hecho = borrador("REGLA_DISTANCIA", distancia, FUENTES.NIVELES, marcas, { sujeto: ancla, direccion: direccionDelSigno(distancia), cercania, obligatorio: cercania === "CERCA" });
  return { prioridad: cercania === "CERCA" ? PRIORIDAD.CERCA : PRIORIDAD.LEJOS, hechos: [hecho], avisos };
}

function hechosDelPlazo(c: Contexto, regla: ReglaParaHechos, ancla: Ancla): readonly Borrador[] {
  if (regla.plazoHasta === null) return [];
  const plazo = diaDe(regla.plazoHasta);
  const faltan = diasEntre(c.hoy, plazo);
  return [
    borrador("REGLA_PLAZO", plazo, FUENTES.PLAN, marcasDeHoy(c.hoy, "PLAN"), { sujeto: ancla }),
    ...(faltan < 0 ? [] : [borrador("REGLA_DIAS_AL_PLAZO", deEntero(faltan), FUENTES.NIVELES, marcasDeHoy(c.hoy, "CALCULO"), { sujeto: ancla })]),
  ];
}

/** Los hechos de una regla, desde su ancla (que cita a `especie`, si la regla tiene); null si no hay nada que decir. */
function armarRegla(c: Contexto, regla: ReglaParaHechos, especie: Especie | null): Armado | null {
  const ancla = borrador("REGLA_DEL_PLAN", c.vigenteDesde, FUENTES.PLAN, marcasDeHoy(c.hoy, "PLAN"), especie === null ? {} : { sujeto: especie });
  const cierre = regla.instrumentoId === null ? undefined : c.e.cierres.get(regla.instrumentoId);
  const nivel = especie !== null && CONDICIONES_DE_PRECIO.has(regla.condicion) ? regla.nivel : null;
  const estado: EstadoNivel = especie === null ? { estado: "SIN_NIVEL" } : estadoDelNivel(regla.condicion, regla.nivel, cierreAlDia(c, cierre)?.precio ?? null);
  const delEstado = hechoDelEstado(c, estado, cierre, ancla);
  const propios: readonly Borrador[] = [
    ...(nivel === null ? [] : [borrador("REGLA_NIVEL", deDecimal(nivel), FUENTES.PLAN, marcasDeHoy(c.hoy, "PLAN"), { sujeto: ancla })]),
    ...delEstado.hechos,
    ...hechosDelPlazo(c, regla, ancla),
  ];
  if (propios.length === 0) return null;
  return { prioridad: delEstado.prioridad, hechos: [ancla, ...propios], avisos: delEstado.avisos };
}

function hechosDelCierre(c: Contexto, cierre: CierreParaReglas | undefined, especie: Especie): Pick<Armado, "hechos" | "avisos"> {
  if (cierre === undefined) return { hechos: [], avisos: [] };
  const dia = diaDe(cierre.fecha);
  const { marcas, avisos } = marcasDeMercado(dia, c.hoy, c.e.calendario, cierre.estado === "VERIFICADO" ? "CIERRE_VERIFICADO" : "CIERRE_SIN_VERIFICAR");
  return {
    hechos: [
      borrador("CIERRE_ESPECIE", deDecimal(cierre.precio), FUENTES.CIERRES, marcas, { sujeto: especie }),
      borrador("FECHA_CIERRE_ESPECIE", dia, FUENTES.CIERRES, marcas, { sujeto: especie }),
    ],
    avisos,
  };
}

function hechosDelProximo(c: Contexto, p: ProximoParaHechos, especie: Especie): readonly Borrador[] {
  const decreto = marcasDeHoy(c.hoy, "DECRETO");
  const ex = diaDe(p.fechaEx);
  const de = { sujeto: especie } as const;
  return [
    borrador("PROXIMO_EX_DIVIDENDO", ex, FUENTES.DECRETOS, decreto, de),
    borrador("DIAS_A_EX_DIVIDENDO", deEntero(diasEntre(c.hoy, ex)), FUENTES.DECRETOS, conOrigen(decreto, "CALCULO"), de),
    borrador("DIVIDENDO_POR_ACCION", deDecimal(p.valorPorAccion), FUENTES.DECRETOS, decreto, de),
    borrador("DIVIDENDO_FECHA_PAGO", diaDe(p.fechaPago), FUENTES.DECRETOS, decreto, de),
    ...(p.brutoEstimado === null ? [] : [borrador("DIVIDENDO_BRUTO_ESTIMADO", deDecimal(p.brutoEstimado), FUENTES.DECRETOS, conOrigen(decreto, "ESTIMACION"), de)]),
  ];
}

type ProximoConNombre = ProximoParaHechos & { readonly nemotecnico: string };
const tieneNombre = (p: ProximoParaHechos): p is ProximoConNombre => p.nemotecnico !== null;

/** El primero de cada clave (en el orden dado). */
const primeroPor = <T>(lista: readonly T[], clave: (x: T) => string): ReadonlyMap<string, T> =>
  lista.reduce<ReadonlyMap<string, T>>((m, x) => (m.has(clave(x)) ? m : new Map([...m, [clave(x), x]])), new Map());

/** El próximo más cercano de cada especie con nombre (los demás y los sin nombre, con aviso); solo con la ex desde hoy. */
function proximosPorEspecie(c: Contexto): { readonly porEspecie: ReadonlyMap<string, ProximoConNombre>; readonly avisos: readonly CodigoAvisoArmado[] } {
  const vigentes = c.e.proximos.filter((p) => diaDe(p.fechaEx) >= c.hoy).sort((a, b) => a.fechaEx.getTime() - b.fechaEx.getTime());
  const conNombre = vigentes.filter(tieneNombre);
  const porEspecie = primeroPor(conNombre, (p) => p.instrumentoId);
  const avisos: CodigoAvisoArmado[] = [
    ...(conNombre.length < vigentes.length ? (["PROXIMO_SIN_NOMBRE"] as const) : []),
    ...(porEspecie.size < conNombre.length ? (["DIVIDENDOS_PROXIMOS_OMITIDOS"] as const) : []),
  ];
  return { porEspecie, avisos };
}

interface DeEspecie {
  readonly instrumentoId: string;
  readonly nombre: string;
  readonly reglas: readonly ReglaParaHechos[];
  readonly proximo: ProximoConNombre | null;
}

/** Las especies con reglas o con un próximo dividendo, de la A a la Z (por unidades de código, nunca `localeCompare`). */
function especiesDe(c: Contexto, proximos: ReadonlyMap<string, ProximoConNombre>): readonly DeEspecie[] {
  const conNombre = c.e.reglas.flatMap((r) => (r.instrumentoId !== null && r.nemotecnico !== null ? [{ id: r.instrumentoId, nombre: r.nemotecnico }] : []));
  const nombres = primeroPor([...conNombre, ...[...proximos.values()].map((p) => ({ id: p.instrumentoId, nombre: p.nemotecnico }))], (x) => x.id);
  return [...nombres.values()]
    .map(({ id, nombre }): DeEspecie => ({ instrumentoId: id, nombre, reglas: c.e.reglas.filter((r) => r.instrumentoId === id && r.nemotecnico !== null), proximo: proximos.get(id) ?? null }))
    .sort((a, b) => compararTexto(a.nombre, b.nombre));
}

function grupoDeEspecie(c: Contexto, de: DeEspecie): Parte<ClaveReglas> {
  const especie = borrador("ESPECIE_NOMBRE", de.nombre, FUENTES.REGISTRO, marcasDeHoy(c.hoy, "REGISTRO"));
  const reglas = de.reglas.flatMap((r) => armarRegla(c, r, especie) ?? []);
  if (reglas.length === 0 && de.proximo === null) return { grupos: [], avisos: [] };
  const cierre = reglas.length === 0 ? { hechos: [], avisos: [] } : hechosDelCierre(c, c.e.cierres.get(de.instrumentoId), especie);
  const prioridad = Math.min(PRIORIDAD.RESTO, ...reglas.map((r) => r.prioridad), de.proximo === null ? PRIORIDAD.RESTO : PRIORIDAD.DIVIDENDO);
  const hechos = [especie, ...cierre.hechos, ...reglas.flatMap((r) => r.hechos), ...(de.proximo === null ? [] : hechosDelProximo(c, de.proximo, especie))];
  return { grupos: [{ prioridad, hechos }], avisos: [...cierre.avisos, ...reglas.flatMap((r) => r.avisos)] };
}

function gruposDePortafolio(c: Contexto): Parte<ClaveReglas> {
  const reglas = c.e.reglas.filter((r) => r.instrumentoId === null).flatMap((r) => armarRegla(c, r, null) ?? []);
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
  const partes: readonly Parte<ClaveReglas>[] = [
    { grupos: [], avisos: sinNombre ? ["REGLA_SIN_NOMBRE"] : [] },
    { grupos: [], avisos: proximos.avisos },
    ...especiesDe(c, proximos.porEspecie).map((de) => grupoDeEspecie(c, de)),
    gruposDePortafolio(c),
  ];
  return cerrarPaquete("REGLAS", hoy, partes);
}
