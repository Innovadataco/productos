/**
 * importar-decretos (fase C, C4a): el CSV de decretos del dueño. Ensayo por defecto (valida, resuelve las especies y
 * planifica contra la base, sin escribir); con `aplicar`, escribe por el camino único (guardar.ts) en una sola
 * transacción. Todo o nada: con un solo hallazgo no se escribe nada (tampoco una carga RECHAZADA).
 * - El llavero va primero, en los dos modos: sin claves de cifrado no se toca la base.
 * - Solo el dueño activo. Una especie que no es una acción registrada (por nemotécnico o símbolo de Trii) sale con
 *   ESPECIE_NO_REGISTRADA: no se crean instrumentos.
 * - Hasta C5b, `aplicar` solo escribe en una base de pruebas (CRUCE_PENDIENTE, guardar.ts); el ensayo dice si esta base
 *   lo admitiría.
 * La salida (`salidaDecretos`) lleva solo el modo, conteos, códigos, números de línea y el id de la carga: nunca
 * especies, valores, fechas, referencias, notas ni el correo.
 */
import type { PrismaClient } from "@prisma/client";
import { obtenerLlavero, type Llavero } from "../../cifrado/llavero";
import { buscarDueno } from "../../plan/importar/base";
import { fechaEnBogota } from "../../precios/horario";
import { enTodoElArchivo, recortar, type Hallazgo } from "../registro/hallazgos";
import { bien, fallo, lineasHallazgos, type OpcionesSalida, type SalidaCli } from "../registro/reporte";
import { MAX_BYTES_DECRETOS, leerCsvDecretos, type FilaDecreto } from "./csv";
import {
  basePermiteAplicar, claveDecreto, contar, guardarDecretos, hayCambios, leerVersiones, nombreDeLaBase, planificarTodos,
  type ConteosDecretos, type DecretoResuelto,
} from "./guardar";

export interface EntradaDecretos {
  readonly contenido: Uint8Array;
  readonly nombreArchivo: string;
  readonly email: string;
  readonly aplicar: boolean;
}

export interface OpcionesDecretos {
  /** Reloj (pruebas); por defecto, ahora. Un anuncio posterior a hoy en Bogotá se rechaza. */
  readonly ahora?: Date;
  readonly llavero?: Llavero;
}

export type ModoDecretos = "ENSAYO" | "APLICAR";

export type ResultadoDecretos =
  | { readonly modo: ModoDecretos; readonly estado: "RECHAZADO"; readonly total: number; readonly hallazgos: readonly Hallazgo[] }
  | {
      readonly modo: ModoDecretos;
      /** LISTO: el ensayo tiene algo por escribir · SIN_CAMBIOS: ya estaba todo · APLICADO: se escribió. */
      readonly estado: "LISTO" | "SIN_CAMBIOS" | "APLICADO";
      readonly conteos: ConteosDecretos;
      readonly cargaId: string | null;
      /** Si esta base admite --aplicar (CRUCE_PENDIENTE hasta C5b). */
      readonly aplicarPermitido: boolean;
    };

/** Nemotécnico (o símbolo de Trii) → id de la ACCIÓN registrada. No crea nada: un decreto es de una acción. */
async function resolverAcciones(db: PrismaClient, especies: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const lista = [...new Set(especies)];
  const filas = await db.instrumento.findMany({
    where: { tipo: "ACCION", OR: [{ nemotecnico: { in: lista } }, { simboloTrii: { in: lista } }] },
    select: { id: true, nemotecnico: true, simboloTrii: true },
  });
  return new Map(lista.flatMap((e): [string, string][] => {
    const fila = filas.find((f) => f.nemotecnico === e) ?? filas.find((f) => f.simboloTrii === e);
    return fila ? [[e, fila.id]] : [];
  }));
}

/** Cada fila con su instrumento; sin él, ESPECIE_NO_REGISTRADA; dos filas del mismo instrumento y clave, DECRETO_REPETIDO. */
function resolver(filas: readonly FilaDecreto[], ids: ReadonlyMap<string, string>): { resueltos: DecretoResuelto[]; hallazgos: Hallazgo[] } {
  const resueltos: DecretoResuelto[] = [];
  const hallazgos: Hallazgo[] = [];
  const vistas = new Set<string>();
  for (const fila of filas) {
    const d = fila.decreto;
    const instrumentoId = ids.get(d.especie);
    if (!instrumentoId) {
      hallazgos.push({ linea: d.linea, columna: "especie", codigo: "ESPECIE_NO_REGISTRADA" });
      continue;
    }
    const clave = claveDecreto(instrumentoId, d.tipo, d.fechaAnuncio, d.cuota);
    if (vistas.has(clave)) hallazgos.push({ linea: d.linea, columna: null, codigo: "DECRETO_REPETIDO" });
    vistas.add(clave);
    resueltos.push({ fila, instrumentoId });
  }
  return { resueltos, hallazgos };
}

async function ensayo(db: PrismaClient, resueltos: readonly DecretoResuelto[]): Promise<ResultadoDecretos> {
  const { planes, hallazgos } = planificarTodos(resueltos, await leerVersiones(db, resueltos.map((r) => r.instrumentoId)));
  if (hallazgos.length > 0) return { modo: "ENSAYO", estado: "RECHAZADO", ...recortar(hallazgos) };
  const conteos = contar(planes);
  const aplicarPermitido = basePermiteAplicar(await nombreDeLaBase(db));
  return { modo: "ENSAYO", estado: hayCambios(conteos) ? "LISTO" : "SIN_CAMBIOS", conteos, cargaId: null, aplicarPermitido };
}

export async function importarDecretos(db: PrismaClient, e: EntradaDecretos, o: OpcionesDecretos = {}): Promise<ResultadoDecretos> {
  const llavero = o.llavero ?? obtenerLlavero();
  const modo: ModoDecretos = e.aplicar ? "APLICAR" : "ENSAYO";
  const rechazo = (hallazgos: readonly Hallazgo[]): ResultadoDecretos => ({ modo, estado: "RECHAZADO", ...recortar(hallazgos) });
  const csv = leerCsvDecretos(e.contenido, fechaEnBogota(o.ahora ?? new Date()));
  if (!csv.ok) return rechazo(csv.hallazgos);
  const usuarioId = await buscarDueno(db, e.email);
  if (!usuarioId) return rechazo([enTodoElArchivo("USUARIO_NO_AUTORIZADO")]);
  const ids = await resolverAcciones(db, csv.filas.map((f) => f.decreto.especie));
  const { resueltos, hallazgos } = resolver(csv.filas, ids);
  if (hallazgos.length > 0) return rechazo(hallazgos);
  if (!e.aplicar) return ensayo(db, resueltos);
  const r = await guardarDecretos(db, { usuarioId, nombreArchivo: e.nombreArchivo, sha256: csv.sha256, resueltos, llavero });
  if (r.estado === "RECHAZADO") return rechazo(r.hallazgos);
  return { modo, estado: r.estado, conteos: r.conteos, cargaId: r.estado === "APLICADO" ? r.cargaId : null, aplicarPermitido: true };
}

// ───────────── Salida del CLI ─────────────

const CRUCE = "los decretos reales no se cargan hasta que el motor de proyecciones cruce por ventana (C5b): contaría dos veces un pago de Trii que llega otro día";

const QUE_REVISAR: Readonly<Record<string, string>> = {
  USUARIO_NO_AUTORIZADO: "el correo no es el de un dueño activo",
  ESPECIE_NO_REGISTRADA: "esa especie no es una acción registrada: importe primero sus órdenes de Trii (este comando no crea especies)",
  DECRETO_REPETIDO: "dos filas con la misma especie, fecha de anuncio, tipo y cuota",
  MONEDA_NO_ADMITIDA: "solo decretos en pesos (moneda=COP); los de USD quedan fuera (P11)",
  FORMA_NO_ADMITIDA: "solo decretos en dinero (forma=DINERO); los de acciones quedan fuera (P11)",
  ANULACION_SIN_DECRETO: "no hay un decreto registrado con esa clave que anular",
  CADENA_ROTA: "las versiones guardadas de ese decreto no son 1..n con la última vigente: avise al CEO de 008 antes de seguir",
  CONFLICTO_CONCURRENTE: "otra carga de decretos se adelantó",
  CRUCE_PENDIENTE: `esta base no es de pruebas: ${CRUCE}`,
};

function explicaciones(hallazgos: readonly Hallazgo[]): string[] {
  const codigos = [...new Set(hallazgos.map((h) => h.codigo))].filter((c) => QUE_REVISAR[c] !== undefined);
  return codigos.map((c) => `   ${c}: ${QUE_REVISAR[c]}.`);
}

const lineaConteos = (c: ConteosDecretos, modo: ModoDecretos): string =>
  `Filas: ${c.filas} · ${modo === "ENSAYO" ? "por registrar" : "registradas"}: nuevas ${c.nuevos}, versiones ${c.versiones}, anulaciones ${c.anulaciones} · sin cambios: ${c.sinCambios}`;

function resultado(r: Extract<ResultadoDecretos, { readonly conteos: ConteosDecretos }>, o: OpcionesSalida): string {
  if (r.estado === "APLICADO") return `Resultado: aplicado · carga ${r.cargaId}`;
  if (r.estado === "SIN_CAMBIOS") return "Resultado: ya estaba todo registrado; no se escribió nada";
  if (!r.aplicarPermitido) return `Resultado: el archivo es válido, pero --aplicar está bloqueado en esta base (CRUCE_PENDIENTE: ${CRUCE}). No se escribió nada`;
  return o.produccion
    ? "Resultado: listo; no se escribió nada. Para registrarlo, repita por la vía B con --aplicar en la cabecera del sobre"
    : "Resultado: listo para --aplicar; no se escribió nada";
}

export function salidaDecretos(r: ResultadoDecretos, o: OpcionesSalida): SalidaCli {
  const encabezado = `Decretos · ${r.modo === "ENSAYO" ? "ENSAYO (no escribe nada)" : "APLICAR (escribe en la base)"}`;
  if (r.estado === "RECHAZADO") {
    return fallo(o, 3, [`❌ Rechazado, no se escribió nada · ${r.total} hallazgo(s):`, ...lineasHallazgos(r.hallazgos, r.total), ...explicaciones(r.hallazgos)], [encabezado]);
  }
  return bien([encabezado, lineaConteos(r.conteos, r.modo), resultado(r, o)]);
}

/** El archivo no se pudo leer: 3 si pasa del tope (no se tocó la base), 2 si no es un archivo regular legible. */
export function salidaArchivo(codigo: "ARCHIVO_ILEGIBLE" | "ARCHIVO_NO_REGULAR" | "ARCHIVO_DEMASIADO_GRANDE", o: OpcionesSalida): SalidaCli {
  if (codigo === "ARCHIVO_DEMASIADO_GRANDE") return fallo(o, 3, [`❌ ARCHIVO_DEMASIADO_GRANDE · el CSV pasa de ${MAX_BYTES_DECRETOS} bytes; no se tocó la base.`]);
  return fallo(o, 2, [`❌ ${codigo} · no se pudo leer el CSV indicado (debe ser un archivo regular); no se tocó la base.`]);
}
