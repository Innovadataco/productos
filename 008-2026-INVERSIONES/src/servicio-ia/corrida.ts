/**
 * La corrida diaria del servicio inv-008-ia (E6): por cada paquete de hechos del día (DIARIO, REGLAS y ESCENARIOS),
 * de a uno:
 * 1. si la tarea está inactiva en la configuración, nada;
 * 2. si ya hay un PUBLICADO con la misma clave (tipo, fecha, hechos, prompt y digest del modelo), nada: no se llama
 *    al modelo ni se duplica;
 * 3. `generarSegunConfig` (las puertas del modo, con la guarda de la vista ciega); cada puerta que falla queda FALLIDO;
 * 4. si respondió, `validarSalida`: PUBLICADO con el texto que renderiza el código, o RECHAZADO con los códigos;
 * 5. si el modelo no está disponible, hasta MAX_REINTENTOS reintentos (cada intento queda registrado), por RONDAS: primero
 *    todos los tipos y después, con una pausa por ronda, solo los que no tuvieron modelo.
 * Con la configuración ausente o en «apagado» no hace NADA (ni lee los hechos). Un error en un tipo (el registro, la
 * base) no tumba los demás: queda como ERROR con el nombre o el código del error, nunca su mensaje (el de PostgreSQL
 * trae la fila). El log solo lleva tipos, estados y códigos: ninguna cifra.
 */
import { corridaDe, generarSegunConfig } from "../ia/config/cableado";
import type { ConfigIaVigente } from "../ia/config/leer";
import type { PaqueteHechos, TipoResumen } from "../ia/contrato";
import type { ResultadoExportacion } from "../ia/evaluacion/exportar/exportar";
import type { Generador } from "../ia/generador";
import { ESQUEMA_SALIDA } from "../ia/prompts/esquema";
import { promptDe } from "../ia/prompts/prompts";
import type { ResultadoPuertas } from "../ia/puertas";
import { fallidosDeCorrida, type ComunCorrida } from "../ia/registro/corrida";
import type { ClaveResumen, EntradaResumen } from "../ia/registro/fila";
import { VERSION_VALIDADOR } from "../ia/validador/codigos";
import { validarSalida } from "../ia/validador/validar";

export const MAX_REINTENTOS = 3;
export const PAUSA_REINTENTO_MS = 5 * 60_000;

export type EstadoTipo = "PUBLICADO" | "RECHAZADO" | "FALLIDO" | "YA_PUBLICADO" | "TAREA_INACTIVA" | "APAGADO" | "OMITIDO" | "ERROR";

export interface ResumenCorrida {
  readonly estado: "APAGADO" | "HECHA";
  readonly porTipo: Readonly<Partial<Record<TipoResumen, EstadoTipo>>>;
}

export interface DependenciasCorrida {
  /** Los paquetes de hechos del día (una foto de solo lectura). */
  exportar(hoy: Date): Promise<ResultadoExportacion>;
  /** Los generadores de las puertas para una tarea, con la configuración vigente. */
  generadores(config: ConfigIaVigente, tarea: TipoResumen): readonly Generador[];
  /** Los digests de modelo con los que esta corrida podría publicar (para no duplicar). */
  digests(config: ConfigIaVigente, tarea: TipoResumen): readonly string[];
  /** Las opciones del pedido que quedan en el registro. */
  opciones(config: ConfigIaVigente): Readonly<Record<string, unknown>>;
  yaPublicado(clave: ClaveResumen): Promise<boolean>;
  registrar(entrada: EntradaResumen): Promise<unknown>;
  esperar(ms: number): Promise<void>;
  registrarLog(mensaje: string): void;
}

const APAGADA: ResumenCorrida = Object.freeze({ estado: "APAGADO", porTipo: Object.freeze({}) });

/** El código o el nombre de un error para el log; nunca su mensaje. */
export function codigoDeError(error: unknown): string {
  const codigo = (error as { readonly codigo?: unknown; readonly code?: unknown } | null)?.codigo ?? (error as { readonly code?: unknown } | null)?.code;
  if (typeof codigo === "string" && /^[A-Z0-9_]{1,64}$/.test(codigo)) return codigo;
  return error instanceof Error ? error.name : "ERROR";
}

const sinModelo = (r: ResultadoPuertas): boolean => r.estado === "FALLO" && r.fallos.some((f) => f.motivo === "MODELO_NO_DISPONIBLE");

/** Registra lo que dejó un intento y dice cómo quedó. */
async function registrarIntento(deps: DependenciasCorrida, paquete: PaqueteHechos, comun: ComunCorrida, r: ResultadoPuertas): Promise<EstadoTipo> {
  for (const fallido of fallidosDeCorrida(r, comun)) await deps.registrar(fallido);
  if (r.estado === "APAGADO") return "APAGADO";
  if (r.estado !== "EXITO") return "FALLIDO";
  const validacion = validarSalida(r.exito.salidaCruda, paquete);
  if (validacion.ok) {
    await deps.registrar({ ...comun, estado: "PUBLICADO", exito: r.exito, texto: validacion.resumen.texto });
    return "PUBLICADO";
  }
  await deps.registrar({ ...comun, estado: "RECHAZADO", exito: r.exito, motivos: validacion.motivos });
  return "RECHAZADO";
}

/** Lo que una ronda necesita de un tipo: su paquete, lo común de sus filas y sus generadores. */
interface Pendiente {
  readonly paquete: PaqueteHechos;
  readonly comun: ComunCorrida;
  readonly generadores: readonly Generador[];
}

/** El tipo listo para generar, o el estado con el que queda sin llamar al modelo. */
async function preparar(deps: DependenciasCorrida, config: ConfigIaVigente, paquete: PaqueteHechos): Promise<Pendiente | EstadoTipo> {
  const { tipo } = paquete;
  if (corridaDe(config, tipo).estado === "APAGADO") return "TAREA_INACTIVA";
  const prompt = promptDe(tipo);
  for (const modeloDigest of deps.digests(config, tipo)) {
    if (await deps.yaPublicado({ tipo, fechaNegocio: paquete.hoy, hechosHash: paquete.hash, promptHash: prompt.hash, modeloDigest })) return "YA_PUBLICADO";
  }
  const comun: ComunCorrida = { paquete, prompt: { version: prompt.version, hash: prompt.hash }, opciones: deps.opciones(config), validadorVersion: VERSION_VALIDADOR };
  return { paquete, comun, generadores: deps.generadores(config, tipo) };
}

/** Un intento de un tipo: genera y registra. `reintentar` si el modelo no estuvo disponible. */
async function intentar(deps: DependenciasCorrida, config: ConfigIaVigente, p: Pendiente): Promise<{ readonly estado: EstadoTipo; readonly reintentar: boolean }> {
  const prompt = promptDe(p.paquete.tipo);
  const r = await generarSegunConfig(config, p.generadores, { paquete: p.paquete, prompt: { texto: prompt.texto, version: prompt.version }, esquemaSalida: ESQUEMA_SALIDA });
  return { estado: await registrarIntento(deps, p.paquete, p.comun, r), reintentar: sinModelo(r) };
}

type Estados = Partial<Record<TipoResumen, EstadoTipo>>;

/** Corre `tarea` para un tipo; un error queda como ERROR en `porTipo` (con su código en el log) y devuelve null. */
async function protegido<T>(deps: DependenciasCorrida, porTipo: Estados, tipo: TipoResumen, tarea: () => Promise<T>): Promise<T | null> {
  try {
    return await tarea();
  } catch (error) {
    porTipo[tipo] = "ERROR";
    deps.registrarLog(`${tipo}: no se pudo terminar (${codigoDeError(error)})`);
    return null;
  }
}

/**
 * Las rondas: la primera intenta TODOS los tipos; las siguientes (hasta MAX_REINTENTOS, con una pausa por ronda) solo
 * los que no tuvieron modelo. Así un Mac caído cuesta una espera por ronda, no una por tipo.
 */
async function correrRondas(deps: DependenciasCorrida, config: ConfigIaVigente, paquetes: readonly PaqueteHechos[], porTipo: Estados): Promise<void> {
  let pendientes: Pendiente[] = [];
  for (const paquete of paquetes) {
    const p = await protegido(deps, porTipo, paquete.tipo, () => preparar(deps, config, paquete));
    if (p === null) continue;
    if (typeof p === "string") porTipo[paquete.tipo] = p;
    else pendientes.push(p);
  }
  for (let ronda = 0; pendientes.length > 0; ronda += 1) {
    const siguen: Pendiente[] = [];
    for (const p of pendientes) {
      const r = await protegido(deps, porTipo, p.paquete.tipo, () => intentar(deps, config, p));
      if (r === null) continue;
      porTipo[p.paquete.tipo] = r.estado;
      if (r.reintentar) siguen.push(p);
    }
    if (siguen.length === 0 || ronda >= MAX_REINTENTOS) return;
    deps.registrarLog(`${siguen.map((p) => p.paquete.tipo).join(", ")}: el modelo no está disponible; reintento ${ronda + 1} de ${MAX_REINTENTOS} en ${PAUSA_REINTENTO_MS / 60_000} min`);
    await deps.esperar(PAUSA_REINTENTO_MS);
    pendientes = siguen;
  }
}

/** La corrida del día `hoy` (la fecha de negocio en Colombia, a medianoche UTC) con la configuración vigente. */
export async function correrDiaria(deps: DependenciasCorrida, config: ConfigIaVigente | null, hoy: Date): Promise<ResumenCorrida> {
  if (config === null || config.modo === "apagado") return APAGADA;
  const exportacion = await deps.exportar(hoy);
  const porTipo: Estados = {};
  for (const aviso of exportacion.avisos) deps.registrarLog(`aviso de los hechos: ${aviso}`);
  await correrRondas(deps, config, exportacion.paquetes, porTipo);
  for (const omitido of exportacion.omitidos) {
    porTipo[omitido.tipo] = "OMITIDO";
    deps.registrarLog(`${omitido.tipo}: sin hechos (${omitido.codigo})`);
  }
  return Object.freeze({ estado: "HECHA", porTipo: Object.freeze(porTipo) });
}
