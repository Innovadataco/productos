/**
 * El análisis del portafolio en acciones (fase E, A1). Puro: sin base, sin red y sin reloj (`hoy` entra).
 * Junta, por especie y para el portafolio, las métricas de los módulos de esta carpeta sobre las entradas validadas.
 * - El tablero manda qué especies hay, su valor y su peso; la historia (Yahoo) da las series y los dividendos.
 * - Los avisos de las historias salen una vez cada uno, ordenados.
 */
import { Prisma } from "@prisma/client";
import { preciosAtrasados } from "../plan/cierre-frescura";
import { diaIso } from "../precios/horario";
import type { AccionEntrada, AvisoCrudo } from "../proyecciones/tipos";
import type { FilaTablero } from "../tablero/calculo";
import { calendarioDe, estadoCierre } from "./cierres";
import { concentracionDe } from "./concentracion";
import { resumirDecisiones } from "./decisiones";
import { proximaFechaEx, rendimientoDividendo12m } from "./dividendo";
import { historiaPropia } from "./historia-propia";
import { compararTexto, redondear } from "./numeros";
import { riesgoComun, type ResultadoRiesgoComun } from "./riesgo-comun";
import { validarEntradas } from "./validar";
import { VERSION_ANALISIS, type Analisis, type AnalisisEspecie, type AvisoAnalisis, type CaidaMaxima, type EfectoCaida, type EntradasAnalisis } from "./tipos";

/** Sin valor ordena después de cualquier valor (los del tablero son positivos). */
const SIN_VALOR = new Prisma.Decimal(-1);
const porValor = (a: FilaTablero, b: FilaTablero): number => (b.valor ?? SIN_VALOR).cmp(a.valor ?? SIN_VALOR) || compararTexto(a.instrumentoId, b.instrumentoId);

interface Contexto {
  readonly e: EntradasAnalisis;
  readonly acciones: ReadonlyMap<string, AccionEntrada>;
  readonly comun: ResultadoRiesgoComun;
  readonly calendario: ReturnType<typeof calendarioDe>;
}

function efectoDe(valor: Prisma.Decimal, caida: CaidaMaxima, total: Prisma.Decimal): EfectoCaida {
  if (caida.estado === "SIN_CAIDA") return { pesos: new Prisma.Decimal(0), fraccionPortafolio: 0 };
  const pesos = valor.mul(caida.fraccion).neg();
  return { pesos, fraccionPortafolio: redondear(pesos.div(total).toNumber()) };
}

const SIN_HISTORIA_PROPIA = { historia: { estado: "SIN_CIERRES" }, avisos: [] } as const;

function especieDe(f: FilaTablero, c: Contexto): { readonly especie: AnalisisEspecie; readonly avisos: readonly AvisoCrudo[] } {
  const { e, acciones, comun, calendario } = c;
  const accion = acciones.get(f.instrumentoId);
  const propia = accion ? historiaPropia(e.historia, accion) : SIN_HISTORIA_PROPIA;
  const base = { instrumentoId: f.instrumentoId, historia: propia.historia, proximaEx: accion ? proximaFechaEx(accion, e.hoy) : null };
  // En una viva, valor y cierre son null a la vez (src/tablero/calculo.ts).
  if (f.cierre === null || f.valor === null) {
    const especie = { ...base, valor: null, peso: null, cierre: { estado: "SIN_CIERRE" }, dividendo12m: null, riesgo: { estado: "SIN_VALOR" }, efectoCaida: null } as const;
    return { especie, avisos: propia.avisos };
  }
  const especie: AnalisisEspecie = {
    ...base,
    valor: f.valor,
    peso: redondear(f.valor.div(e.tablero.valorAcciones).toNumber()),
    cierre: estadoCierre(f.cierre, e.tablero.fechaReferencia, calendario),
    dividendo12m: accion ? rendimientoDividendo12m(accion, e.hoy, f.cierre.precio) : null,
    riesgo: comun.porEspecie.get(f.instrumentoId)!,
    efectoCaida: propia.historia.estado === "CON_HISTORIA" ? efectoDe(f.valor, propia.historia.caidaMaxima, e.tablero.valorAcciones) : null,
  };
  return { especie, avisos: propia.avisos };
}

const claveAviso = (a: AvisoCrudo): string => `${a.codigo}|${a.instrumentoId}|${a.dia}|${a.dato}`;

/** Una vez cada uno (por código, especie, día y dato), sin el nombre, ordenados por esa clave. */
function unicos(avisos: readonly AvisoCrudo[]): readonly AvisoAnalisis[] {
  const porClave = new Map(avisos.map((a): [string, AvisoAnalisis] => [claveAviso(a), { codigo: a.codigo, instrumentoId: a.instrumentoId, dia: a.dia, dato: a.dato }]));
  return [...porClave.keys()].sort(compararTexto).map((k) => porClave.get(k)!);
}

export function analizar(e: EntradasAnalisis): Analisis {
  validarEntradas(e);
  const calendario = calendarioDe(e.historia.noHabiles);
  const acciones = new Map(e.historia.posiciones.filter((p): p is AccionEntrada => p.tipo === "ACCION").map((a) => [a.instrumentoId, a]));
  const vivas = [...e.tablero.filas].sort(porValor);
  // El valor de una viva es null (sin cierre) o positivo: validarEntradas rechaza un precio que no lo sea.
  const cubiertas = vivas.flatMap((f) => (f.valor === null ? [] : [{ instrumentoId: f.instrumentoId, valor: f.valor }]));
  const comun = riesgoComun(e.historia, cubiertas, e.tablero.valorAcciones);
  const porEspecie = vivas.map((f) => especieDe(f, { e, acciones, comun, calendario }));
  const referencia = e.tablero.fechaReferencia;
  return {
    version: VERSION_ANALISIS,
    hoy: diaIso(e.hoy),
    valorAcciones: e.tablero.valorAcciones,
    referencia: referencia === null ? null : { dia: diaIso(referencia), cargaDetenida: preciosAtrasados(referencia, e.hoy, calendario) },
    especies: porEspecie.map((x) => x.especie),
    sinTenencia: [...e.tablero.cerradas]
      .sort((a, b) => compararTexto(a.instrumentoId, b.instrumentoId))
      .map((f) => ({ instrumentoId: f.instrumentoId, cierre: estadoCierre(f.cierre, referencia, calendario) })),
    concentracion: concentracionDe(vivas),
    riesgo: comun.portafolio,
    decisiones: resumirDecisiones(e.decisiones),
    avisos: unicos([...porEspecie.flatMap((x) => x.avisos), ...comun.avisos]),
  };
}
