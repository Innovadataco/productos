/**
 * Importación de la ficha de inversiones de ODIN al plan (D-013, paso 1). Por defecto es un ensayo que
 * solo lee la base. Con `aplicar`, toma el candado de sesión, vuelve a mirar todo y escribe con las
 * funciones del dominio (`crearVersionPlan`, `registrarDecision`). Idempotente: lo que ya está no se
 * repite, y una corrida cortada se completa al repetirla. Nunca devuelve valores, solo conteos y códigos.
 */
import type { PrismaClient } from "@prisma/client";
import { registrarDecision } from "../decisiones";
import { ErrorPlan } from "../errores";
import { crearVersionPlan, hoyDe } from "../versiones";
import { buscarDueno, decisionesRegistradas, estadoVersion, fueraDeLaVersion, resolverEspecies, type EstadoVersion } from "./base";
import { tomarCandado, type Candado } from "./candado";
import { leerFicha } from "./interpretar";
import { prepararImportacion, type DecisionPreparada, type Preparada } from "./mapear";
import { resumenLectura, type Conteo, type ModoImportacion, type ResultadoImportacion } from "./resultado";
import type { FichaLeida, Hallazgo, PlanLeido } from "./tipos";

export interface EntradaImportacion {
  readonly contenido: string;
  readonly email: string;
  readonly aplicar: boolean;
}

export type EntradaLeida = Omit<EntradaImportacion, "contenido">;

export interface OpcionesImportacion {
  /** URL de la MISMA base de `db`: el candado de `aplicar` va en una conexión propia. */
  readonly url?: string;
  /** Fecha de negocio de hoy (pruebas); por defecto, la de Colombia. */
  readonly hoy?: Date;
}

interface Analisis {
  readonly plan: PlanLeido;
  readonly duenoId: string;
  readonly preparada: Preparada;
  readonly estado: EstadoVersion;
  readonly faltantes: readonly DecisionPreparada[];
  readonly conteos: Pick<ResultadoImportacion, "versiones" | "reglas" | "decisiones">;
}

const enTodaLaFicha = (codigo: string): Hallazgo => ({ linea: 0, item: null, codigo });

function contar(plan: PlanLeido, estado: EstadoVersion, faltantes: number): Analisis["conteos"] {
  const nueva = estado.estado === "NUEVA";
  const ya = estado.estado === "YA_IMPORTADA";
  const de = (leidas: number, siNueva: number): Conteo => ({ leidas, nuevas: nueva ? siNueva : 0, existentes: ya ? leidas : 0 });
  const decisiones = plan.decisiones.length;
  return { versiones: de(1, 1), reglas: de(plan.reglas.length, plan.reglas.length), decisiones: { leidas: decisiones, nuevas: faltantes, existentes: decisiones - faltantes } };
}

/** Todo lo que se puede saber sin escribir: bloqueos, qué está y qué falta. */
async function analizar(db: PrismaClient, ficha: FichaLeida, email: string, hoy: Date): Promise<{ bloqueos: Hallazgo[]; analisis: Analisis | null }> {
  const duenoId = await buscarDueno(db, email);
  const sinDueno = duenoId ? [] : [enTodaLaFicha("DUENO_NO_AUTORIZADO")];
  const plan = ficha.plan;
  if (!plan) return { bloqueos: [...sinDueno, ...ficha.bloqueos], analisis: null };
  const especies = await resolverEspecies(db, [...plan.reglas.flatMap((r) => (r.especie ? [r.especie] : [])), ...plan.decisiones.map((d) => d.especie)]);
  const preparada = prepararImportacion(plan, especies, hoy);
  const estado = await estadoVersion(db, preparada.version);
  const registradas = estado.estado === "YA_IMPORTADA" ? await decisionesRegistradas(db, estado.id, preparada.version.reglas, preparada.decisiones) : preparada.decisiones.map(() => false);
  const faltantes = preparada.decisiones.filter((_, i) => !registradas[i]);
  const posteriores = estado.estado === "YA_IMPORTADA" ? await fueraDeLaVersion(db, estado.id, faltantes) : [];
  const deVersion = estado.estado === "CONFLICTO" ? ["VERSION_EN_CONFLICTO"] : estado.estado === "RETROCEDE" ? ["VIGENCIA_RETROCEDE"] : [];
  return {
    bloqueos: [...sinDueno, ...ficha.bloqueos, ...preparada.bloqueos, ...deVersion.map((codigo) => ({ linea: plan.linea, item: null, codigo })), ...posteriores],
    analisis: { plan, duenoId: duenoId ?? "", preparada, estado, faltantes, conteos: contar(plan, estado, faltantes.length) },
  };
}

/**
 * Dónde se cortó: un ErrorPlan con su código; otro error, si ya se escribió algo, como ERROR_INTERNO con
 * su clase (nunca su mensaje, que puede traer valores), para avisar que repetir el comando completa.
 * Si todavía no se escribió nada, el error sube tal cual.
 */
function corte(error: unknown, linea: number, algoEscrito: boolean): Hallazgo {
  if (error instanceof ErrorPlan) return { linea, item: null, codigo: error.codigo };
  if (!algoEscrito) throw error;
  return { linea, item: null, codigo: "ERROR_INTERNO", nombre: error instanceof Error ? error.name : "desconocido" };
}

async function escribir(db: PrismaClient, a: Analisis, hoy: Date, base: ResultadoImportacion): Promise<ResultadoImportacion> {
  const n = a.plan.reglas.length;
  const resultado = (versionCreada: boolean, decisiones: number, error: Hallazgo | null): ResultadoImportacion => ({
    ...base,
    ...a.conteos,
    versiones: { ...a.conteos.versiones, nuevas: versionCreada ? 1 : 0 },
    reglas: { ...a.conteos.reglas, nuevas: versionCreada ? n : 0 },
    decisiones: { ...a.conteos.decisiones, nuevas: decisiones },
    estado: error ? "FALLO_PARCIAL" : "APLICADO",
    error,
  });
  let reglaIds: readonly string[];
  const creaVersion = a.estado.estado !== "YA_IMPORTADA";
  try {
    reglaIds = a.estado.estado === "YA_IMPORTADA" ? a.estado.reglaIds : (await crearVersionPlan(db, { ...a.preparada.version, autorId: a.duenoId }, { hoy })).reglaIds;
  } catch (error) {
    return resultado(false, 0, corte(error, a.plan.linea, false));
  }
  let creadas = 0;
  for (const d of a.faltantes) {
    const datos = { fechaDecision: d.fechaDecision, instrumentoId: d.instrumentoId, accion: d.accion, cantidad: d.cantidad, reglaId: reglaIds[d.indiceRegla]!, excepcion: false, motivo: d.motivo, autorId: a.duenoId };
    try {
      await registrarDecision(db, datos, { hoy });
      creadas += 1;
    } catch (error) {
      return resultado(creaVersion, creadas, corte(error, d.linea, creaVersion || creadas > 0));
    }
  }
  return resultado(creaVersion, creadas, null);
}

async function importarCon(db: PrismaClient, ficha: FichaLeida, email: string, hoy: Date, modo: ModoImportacion): Promise<ResultadoImportacion> {
  const base = resumenLectura(ficha, modo);
  const { bloqueos, analisis } = await analizar(db, ficha, email, hoy);
  const conConteos = { ...base, ...(analisis?.conteos ?? {}) };
  if (bloqueos.length > 0 || !analisis) return { ...conConteos, bloqueos, estado: "BLOQUEADO" };
  if (analisis.estado.estado === "YA_IMPORTADA" && analisis.faltantes.length === 0) return { ...conConteos, estado: "SIN_CAMBIOS" };
  if (modo === "ENSAYO") return { ...conConteos, estado: "LISTO" };
  return escribir(db, analisis, hoy, base);
}

/** Soltar nunca tapa el resultado ni el error de la importación: si no sale limpio, queda como aviso. */
async function soltarSinTapar(candado: Candado): Promise<boolean> {
  try {
    return await candado.soltar();
  } catch {
    return false;
  }
}

/** Como `importarFicha`, con la ficha ya leída (la usan las pruebas para casos que la lectura no produce). */
export async function importarLeida(db: PrismaClient, ficha: FichaLeida, e: EntradaLeida, o: OpcionesImportacion = {}): Promise<ResultadoImportacion> {
  const hoy = hoyDe(o);
  if (!e.aplicar) return importarCon(db, ficha, e.email, hoy, "ENSAYO");
  if (!o.url) throw new ErrorPlan("SIN_URL_DE_BASE");
  const candado = await tomarCandado(o.url);
  if (!candado) return { ...resumenLectura(ficha, "APLICAR"), estado: "CANDADO_OCUPADO" };
  let r: ResultadoImportacion;
  try {
    r = await importarCon(db, ficha, e.email, hoy, "APLICAR");
  } catch (error) {
    await soltarSinTapar(candado);
    throw error;
  }
  return (await soltarSinTapar(candado)) ? r : { ...r, avisos: [...r.avisos, enTodaLaFicha("CANDADO_NO_SOLTADO")] };
}

export async function importarFicha(db: PrismaClient, e: EntradaImportacion, o: OpcionesImportacion = {}): Promise<ResultadoImportacion> {
  return importarLeida(db, leerFicha(e.contenido), { email: e.email, aplicar: e.aplicar }, o);
}
