/**
 * Qué lee /edicion/ia (E8): la vigente (precargada como la escribe el dueño), la última versión (contra ella se crea la
 * nueva), la historia, el gasto del mes de la nube frente al tope, el estado de cada puerta, la lista de modelos que
 * publica PI y la llave solo como sí/no (nunca su valor). Solo lectura; el entorno se inyecta (en la página, el del
 * proceso).
 */
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { usdDeMicro } from "@/ia/config/crear";
import { ErrorConfigIa } from "@/ia/config/errores";
import { estadoPuertas } from "@/ia/config/estado-puertas";
import { gastoNubeDelMes } from "@/ia/config/gasto";
import { leerConfigIa, leerHistoriaConfigIa, type ConfigIaVigente } from "@/ia/config/leer";
import { HORAS_RESUMEN, HORA_POR_OMISION, LIMITE_MAX_S, LIMITE_MIN_S, LIMITE_POR_OMISION_S, MODELO_LOCAL_RECOMENDADO, TAREAS_IA, TOPE_MAX_MICRO_USD, TOPE_MIN_MICRO_USD } from "@/ia/config/parametros";
import { sondaDelEntorno } from "@/ia/config/sonda-ollama";
import { LISTA_MODELOS_PI, type ListaModelosPi } from "@/ia/local/modelos";
import { VARIABLE_LLAVE_NUBE } from "@/ia/nube/config";
import { ESFUERZOS_NUBE, ESFUERZO_NUBE, MODELOS_NUBE, MODELO_NUBE } from "@/ia/nube/peticion";
import { TARIFAS_NUBE, type PrecioNube } from "@/ia/nube/tope";
import { MODOS_PUERTAS } from "@/ia/puertas";
import { fechaEnBogota } from "@/precios/horario";
import { fecha } from "../../tablero/formato";
import type { ConfigEditable, DatosEdicionIa, GastoVista, Opcion, OpcionModeloLocal, OpcionModeloNube } from "./tipos-ia";

type Entorno = Readonly<Record<string, string | undefined>>;

const MODOS: Readonly<Record<string, string>> = { apagado: "Apagada", local: "Solo la local (Ollama del Mac)", nube: "Solo la nube (Claude)", "local-luego-nube": "La local y, si falla, la nube" };
const TAREAS: Readonly<Record<string, string>> = { DIARIO: "Resumen diario (tablero)", REGLAS: "Reglas del plan", ESCENARIOS: "Escenarios (proyecciones)" };
const MODELOS_NUBE_TEXTO: Readonly<Record<string, string>> = { "claude-opus-5-5": "Claude Opus 5.5", "claude-sonnet-5-5": "Claude Sonnet 5.5", "claude-haiku-5-5": "Claude Haiku 5.5" };
const ESFUERZOS: Readonly<Record<string, string>> = { low: "Bajo", medium: "Medio" };
const HISTORIA = 10;
const DESFASE_BOGOTA_MS = 5 * 3_600_000;
const VERSION = /^[1-9][0-9]{0,8}$/;

export const textoModo = (modo: string): string => MODOS[modo] ?? modo;

/** micro-USD como «4,61» o «5» (es-CO). */
function usdTexto(micro: bigint): string {
  const [enteros, centavos] = usdDeMicro(micro).split(".");
  return centavos === "00" ? enteros! : `${enteros},${centavos}`;
}

/** micro-USD por millón como «4» o «0,10». */
const porMillon = (micro: bigint): string => (micro % 1_000_000n === 0n ? String(micro / 1_000_000n) : usdTexto(micro));
const par = (p: PrecioNube): string => `USD ${porMillon(p.entradaPorMillon)} y USD ${porMillon(p.salidaPorMillon)}`;

function precioTexto(modelo: (typeof MODELOS_NUBE)[number]): string {
  const { base, largo } = TARIFAS_NUBE[modelo];
  const tramo = largo === undefined ? "" : ` (hasta 100K tokens de entrada; por encima, ${par(largo.precio)})`;
  return `${par(base)} por millón de tokens de entrada y de salida${tramo}`;
}

/** La temperatura en centésimas como la escribe el dueño: «0», «0,37», «1». */
function temperaturaTexto(c: number): string {
  if (c % 100 === 0) return String(c / 100);
  return `0,${String(c).padStart(2, "0").replace(/0$/, "")}`;
}

/** Una fecha y hora de la base en hora de Colombia: «17-mar-2027 18:41». */
function fechaHora(instante: Date): string {
  const local = new Date(instante.getTime() - DESFASE_BOGOTA_MS);
  const hora = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  return `${fecha(local.toISOString().slice(0, 10))} ${hora}`;
}

function modelosLocales(lista: ListaModelosPi): readonly OpcionModeloLocal[] {
  if (lista.estado !== "LISTA") return [];
  return lista.modelos.map((m) => ({ nombre: m.nombre, nota: m.nota ?? null, recomendado: m.nombre === MODELO_LOCAL_RECOMENDADO, aviso32b: /:32b$/.test(m.nombre) }));
}

/** El formulario precargado con la vigente; sin ella, apagada y con el recomendado solo si está en la lista leída. */
function editable(config: ConfigIaVigente | null, lista: ListaModelosPi): ConfigEditable {
  const recomendado = lista.estado === "LISTA" && lista.modelos.some((m) => m.nombre === MODELO_LOCAL_RECOMENDADO) ? MODELO_LOCAL_RECOMENDADO : "";
  const tareas = Object.fromEntries(TAREAS_IA.map((t) => [t, config === null ? { activo: true, modeloLocal: recomendado } : { activo: config.tareas[t].activo, modeloLocal: config.tareas[t].modeloLocal ?? "" }]));
  if (config === null) {
    return { modo: "apagado", ollamaHost: "", ollamaPuerto: "", temperatura: "0", tareas, modeloNube: MODELO_NUBE, esfuerzoNube: ESFUERZO_NUBE, topeMensualUsd: "", horaResumen: HORA_POR_OMISION, limiteSegundos: String(LIMITE_POR_OMISION_S) };
  }
  return {
    modo: config.modo, ollamaHost: config.ollamaHost ?? "", ollamaPuerto: config.ollamaPuerto === null ? "" : String(config.ollamaPuerto), temperatura: temperaturaTexto(config.temperaturaCentesimas),
    tareas, modeloNube: config.modeloNube, esfuerzoNube: config.esfuerzoNube, topeMensualUsd: config.topeMicroUsd === null ? "" : usdTexto(config.topeMicroUsd),
    horaResumen: config.horaResumen, limiteSegundos: String(config.limiteSegundos),
  };
}

async function gasto(db: PrismaClient, config: ConfigIaVigente | null): Promise<GastoVista> {
  try {
    const dia = fechaEnBogota(new Date()).toISOString().slice(0, 10);
    const g = await gastoNubeDelMes(db, dia);
    return { estado: "LEIDO", mes: fecha(`${g.mes}-01`).replace(/^\d+-/, ""), usado: usdTexto(g.microUsd), tope: config?.topeMicroUsd == null ? null : usdTexto(config.topeMicroUsd), corridas: g.corridas };
  } catch (error) {
    if (error instanceof ErrorConfigIa) return { estado: "NO_VERIFICABLE" };
    throw error;
  }
}

/** ?guardada: solo el número de una versión que exista. */
async function guardadaDe(db: PrismaClient, pedido: string | string[] | undefined): Promise<number | null> {
  if (typeof pedido !== "string" || !VERSION.test(pedido)) return null;
  const v = await db.configIa.findUnique({ where: { version: Number(pedido) }, select: { version: true } });
  return v?.version ?? null;
}

const opciones = (lista: readonly string[], textos: Readonly<Record<string, string>>): Opcion[] => lista.map((valor) => ({ valor, texto: textos[valor] ?? valor }));

export async function datosEdicionIa(db: PrismaClient, entorno: Entorno, pedidoGuardada: string | string[] | undefined): Promise<DatosEdicionIa> {
  const [config, historia, ultima] = await Promise.all([leerConfigIa(db), leerHistoriaConfigIa(db, HISTORIA), db.configIa.findFirst({ orderBy: { version: "desc" }, select: { version: true } })]);
  const lista = LISTA_MODELOS_PI;
  const llaveCargada = typeof entorno[VARIABLE_LLAVE_NUBE] === "string" && entorno[VARIABLE_LLAVE_NUBE] !== "";
  const modelosNube: OpcionModeloNube[] = MODELOS_NUBE.map((m) => ({ valor: m, texto: MODELOS_NUBE_TEXTO[m] ?? m, precio: precioTexto(m) }));
  return {
    versionBase: ultima?.version ?? 0,
    vigente: config === null ? null : { version: config.version, desde: fechaHora(config.creadaEn) },
    inicial: editable(config, lista),
    guardado: { hayDestino: config?.ollamaHost != null, modelos: Object.fromEntries(TAREAS_IA.map((t) => [t, config?.tareas[t].modeloLocal ?? ""])) },
    opciones: {
      modos: opciones(MODOS_PUERTAS, MODOS), modelosNube, esfuerzos: opciones(ESFUERZOS_NUBE, ESFUERZOS), horas: HORAS_RESUMEN, tareas: opciones(TAREAS_IA, TAREAS),
      modelosLocales: modelosLocales(lista),
      limites: { limiteMin: LIMITE_MIN_S, limiteMax: LIMITE_MAX_S, topeMin: usdTexto(TOPE_MIN_MICRO_USD), topeMax: usdTexto(TOPE_MAX_MICRO_USD) },
    },
    listaPi: lista.estado === "LISTA"
      ? { estado: "LISTA", detalle: lista.modelos.length === 0 ? "LISTA_VACIA" : "LISTA_PUBLICADA", publicadoPor: lista.publicadoPor, fecha: fecha(lista.fecha) }
      : { estado: "SIN_LISTA", detalle: lista.motivo, publicadoPor: null, fecha: null },
    puertas: estadoPuertas(config, { llaveNube: llaveCargada, listaPi: lista }),
    gasto: await gasto(db, config),
    llaveCargada,
    sonda: sondaDelEntorno(entorno).tipo,
    historia: historia.map((v) => ({ version: v.version, modo: textoModo(v.modo), motivo: v.motivo, autor: v.autor, fecha: fechaHora(v.creadaEn) })),
    guardada: await guardadaDe(db, pedidoGuardada),
  };
}
