/**
 * registrar-rendimientos-fondo (frente fondo-rendimientos): el CSV de los rendimientos del FIC y su retención. Ensayo por
 * defecto (valida y planifica contra la base, sin escribir); con `aplicar`, escribe por el camino único (guardar.ts) en
 * una sola transacción. Todo o nada: con un solo hallazgo no se escribe nada (tampoco una carga RECHAZADA).
 * - El llavero va primero, en los dos modos: sin claves de cifrado no se toca la base.
 * - Solo el dueño activo; el fondo, un FIC registrado y activo con su constitución (este comando no crea fondos).
 * El resultado lleva solo el modo, conteos, códigos, números de línea y ids internos: nunca valores, fechas, el código
 * del fondo ni el correo (los imprime salida.ts).
 */
import type { PrismaClient } from "@prisma/client";
import { obtenerLlavero, type Llavero } from "../../cifrado/llavero";
import { enTodoElArchivo, recortar, type Hallazgo } from "../../datos-oficiales/registro/hallazgos";
import { buscarDueno } from "../../plan/importar/base";
import { fechaEnBogota } from "../../precios/horario";
import { leerCsvRendimientos, type FilaRendimiento } from "./csv";
import { guardarRendimientos, leerContexto, leerGuardados } from "./guardar";
import { contarRendimientos, hayNuevos, planificarRendimientos, type ConteosRendimientos } from "./planificar";

export interface EntradaRendimientos {
  readonly contenido: Uint8Array;
  readonly email: string;
  /** `codigo_negocio` de la SFC (instrumento.codigoFic). */
  readonly codigoFic: string;
  readonly aplicar: boolean;
}

export interface OpcionesRendimientos {
  /** Reloj (pruebas); por defecto, ahora. Una fila posterior a hoy en Bogotá se rechaza. */
  readonly ahora?: Date;
  readonly llavero?: Llavero;
}

export type ModoRendimientos = "ENSAYO" | "APLICAR";

export type ResultadoRendimientos =
  | { readonly modo: ModoRendimientos; readonly estado: "RECHAZADO"; readonly total: number; readonly hallazgos: readonly Hallazgo[] }
  | {
      readonly modo: ModoRendimientos;
      /** LISTO: el ensayo tiene algo por escribir · SIN_CAMBIOS: ya estaba todo · APLICADO: se escribió. */
      readonly estado: "LISTO" | "SIN_CAMBIOS" | "APLICADO";
      readonly fondoId: string;
      readonly conteos: ConteosRendimientos;
      readonly cargaId: string | null;
    };

async function ensayo(db: PrismaClient, codigoFic: string, filas: readonly FilaRendimiento[]): Promise<ResultadoRendimientos> {
  const contexto = await leerContexto(db, codigoFic);
  if (typeof contexto === "string") return { modo: "ENSAYO", estado: "RECHAZADO", ...recortar([enTodoElArchivo(contexto)]) };
  const { planes, hallazgos } = planificarRendimientos(filas, await leerGuardados(db, contexto.fondoId), contexto.constitucion);
  if (hallazgos.length > 0) return { modo: "ENSAYO", estado: "RECHAZADO", ...recortar(hallazgos) };
  const conteos = contarRendimientos(planes);
  return { modo: "ENSAYO", estado: hayNuevos(conteos) ? "LISTO" : "SIN_CAMBIOS", fondoId: contexto.fondoId, conteos, cargaId: null };
}

export async function registrarRendimientos(db: PrismaClient, e: EntradaRendimientos, o: OpcionesRendimientos = {}): Promise<ResultadoRendimientos> {
  const llavero = o.llavero ?? obtenerLlavero();
  const modo: ModoRendimientos = e.aplicar ? "APLICAR" : "ENSAYO";
  const rechazo = (hallazgos: readonly Hallazgo[]): ResultadoRendimientos => ({ modo, estado: "RECHAZADO", ...recortar(hallazgos) });
  const csv = leerCsvRendimientos(e.contenido, fechaEnBogota(o.ahora ?? new Date()));
  if (!csv.ok) return rechazo(csv.hallazgos);
  const usuarioId = await buscarDueno(db, e.email);
  if (!usuarioId) return rechazo([enTodoElArchivo("USUARIO_NO_AUTORIZADO")]);
  if (!e.aplicar) return ensayo(db, e.codigoFic, csv.filas);
  const r = await guardarRendimientos(db, { usuarioId, codigoFic: e.codigoFic, sha256: csv.sha256, filas: csv.filas, llavero });
  if (r.estado === "RECHAZADO") return rechazo(r.hallazgos);
  return { modo, estado: r.estado, fondoId: r.fondoId, conteos: r.conteos, cargaId: r.estado === "APLICADO" ? r.cargaId : null };
}
