/**
 * Escritura de la certificación dentro de la transacción de importación (PR-B):
 * - especies por nemotécnico (o símbolo de Trii), creadas si faltan, como el importador de Trii;
 * - el fondo se reconoce por su NIT (`instrumento.nitFondo`); la primera vez se vincula con `--fondo <codigoFic>`;
 * - cada fila del PDF queda como FilaFuente AV_CERTIFICACION con el crudo cifrado, más su FilaDeCarga;
 * - el encargo se guarda cifrado con `cifrarEncargo`, atado a (certificación, fondo).
 * Los errores llevan un código y la ubicación de la fila, nunca valores.
 */
import type { Prisma } from "@prisma/client";
import { cifrarCrudo, cifrarEncargo, descifrarCrudo } from "../../cifrado/campos";
import type { Llavero } from "../../cifrado/llavero";
import { referencia } from "./agregar";
import type { CertificacionAnalizada } from "./analisis";
import type { RegistroAvConClave } from "./clave";
import type { ErrorFilaAv, FondoCertificado } from "./filas";

type Tx = Prisma.TransactionClient;
export const TIPO_FUENTE = "AV_CERTIFICACION" as const;

export class ErrorImportacionAv extends Error {
  constructor(readonly codigo: string, readonly ubicacion: Omit<ErrorFilaAv, "codigo"> = { pagina: 0, fila: 0, columna: null }) {
    super(codigo);
    this.name = "ErrorImportacionAv";
  }
}

const enFondo = (f: FondoCertificado) => ({ pagina: f.pagina, fila: f.numero, columna: "NIT DEL FONDO" });

/**
 * Cada nemotécnico → su acción (por símbolo de Trii o por nemotécnico, como el importador de Trii), en una sola
 * consulta y solo entre acciones. Si dos acciones distintas lo reclaman, no se elige: ESPECIE_AMBIGUA.
 * Si ninguna, se crea. `ubicaciones` dice en qué fila del PDF aparece cada nemotécnico (para el error).
 */
/** Las acciones que reclaman cada nemotécnico (por símbolo de Trii o por nemotécnico), en una sola consulta. */
async function candidatasDe(tx: Tx, nemos: readonly string[]): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  const candidatas = await tx.instrumento.findMany({
    where: { tipo: "ACCION", OR: [{ simboloTrii: { in: [...nemos] } }, { nemotecnico: { in: [...nemos] } }] },
    select: { id: true, simboloTrii: true, nemotecnico: true },
  });
  return new Map(nemos.map((nemo) => [nemo, new Set(candidatas.filter((c) => c.simboloTrii === nemo || c.nemotecnico === nemo).map((c) => c.id))]));
}

/**
 * Solo lectura (señal 1 del corte real): cada nemotécnico → su acción, sin crear nada. Los que no existen o son
 * ambiguos no salen: no tienen con qué compararse (no cuentan en la regla del corte real).
 */
export async function buscarEspecies(tx: Tx, nemos: readonly string[]): Promise<Map<string, string>> {
  const porNemo = await candidatasDe(tx, nemos);
  return new Map(nemos.flatMap((nemo) => {
    const propias = [...(porNemo.get(nemo) ?? [])];
    return propias.length === 1 ? [[nemo, propias[0]!] as const] : [];
  }));
}

export async function resolverEspecies(
  tx: Tx, nemos: readonly string[], ubicaciones: ReadonlyMap<string, Omit<ErrorFilaAv, "codigo">>,
): Promise<{ ids: Map<string, string>; creadas: number }> {
  const porNemo = await candidatasDe(tx, nemos);
  const ids = new Map<string, string>();
  let creadas = 0;
  for (const nemo of nemos) {
    const propias = porNemo.get(nemo) ?? new Set<string>();
    if (propias.size > 1) throw new ErrorImportacionAv("ESPECIE_AMBIGUA", ubicaciones.get(nemo));
    const id = [...propias][0] ?? (await tx.instrumento.create({ data: { tipo: "ACCION", nemotecnico: nemo, nombre: nemo }, select: { id: true } })).id;
    if (propias.size === 0) creadas += 1;
    ids.set(nemo, id);
  }
  return { ids, creadas };
}

/** Vincula el NIT al FIC del código dado, si es el único fondo sin vincular y el FIC está libre. */
async function vincular(tx: Tx, f: FondoCertificado, codigoFic: string): Promise<string> {
  const fic = await tx.instrumento.findUnique({ where: { codigoFic }, select: { id: true, tipo: true, activo: true, nitFondo: true } });
  if (!fic || fic.tipo !== "FIC") throw new ErrorImportacionAv("FONDO_NO_REGISTRADO", enFondo(f));
  if (!fic.activo) throw new ErrorImportacionAv("FONDO_INACTIVO", enFondo(f));
  if (fic.nitFondo !== null && fic.nitFondo !== f.nit) throw new ErrorImportacionAv("FONDO_NO_COINCIDE", enFondo(f));
  if (fic.nitFondo === null) await tx.instrumento.update({ where: { id: fic.id }, data: { nitFondo: f.nit } });
  return fic.id;
}

export async function resolverFondos(tx: Tx, fondos: readonly FondoCertificado[], codigoFic: string | null): Promise<{ ids: Map<string, string>; vinculado: boolean }> {
  const ids = new Map<string, string>();
  const sinVincular: FondoCertificado[] = [];
  for (const f of fondos) {
    const inst = await tx.instrumento.findUnique({ where: { nitFondo: f.nit }, select: { id: true, activo: true, codigoFic: true } });
    if (!inst) sinVincular.push(f);
    else if (!inst.activo) throw new ErrorImportacionAv("FONDO_INACTIVO", enFondo(f));
    else if (codigoFic !== null && inst.codigoFic !== codigoFic && fondos.length === 1) throw new ErrorImportacionAv("FONDO_NO_COINCIDE", enFondo(f));
    else ids.set(f.nit, inst.id);
  }
  if (sinVincular.length === 0) return { ids, vinculado: false };
  if (codigoFic === null) throw new ErrorImportacionAv("FONDO_NIT_DESCONOCIDO", enFondo(sinVincular[0]!));
  if (sinVincular.length > 1) throw new ErrorImportacionAv("FONDO_AMBIGUO", enFondo(sinVincular[1]!));
  ids.set(sinVincular[0]!.nit, await vincular(tx, sinVincular[0]!, codigoFic));
  return { ids, vinculado: true };
}

/** Cada fila del PDF: FilaFuente con el crudo cifrado (atado a su llave natural) y su FilaDeCarga. */
export async function guardarFilas(tx: Tx, cargaId: string, registros: readonly RegistroAvConClave[], llavero: Llavero): Promise<void> {
  for (const r of registros) {
    const llave = { tipoFuente: TIPO_FUENTE, claveNatural: r.clave, ocurrencia: r.ocurrencia };
    const fila = await tx.filaFuente.create({
      data: { ...llave, primeraCargaId: cargaId, primeraFilaNo: r.numero, crudo: cifrarCrudo(r.crudo, llave, llavero) },
      select: { id: true },
    });
    await tx.filaDeCarga.create({ data: { cargaId, filaNo: r.numero, filaFuenteId: fila.id } });
  }
}

const llaveDe = (clave: string, ocurrencia: number) => `${clave}|${ocurrencia}`;

const mismoCrudo = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>) => {
  const ka = Object.keys(a).sort();
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/**
 * ¿La certificación ya guardada para esa fecha tiene EXACTAMENTE las mismas filas? Se compara el conjunto
 * (clave, ocurrencia) en los dos sentidos —una fila de más o de menos también es otra certificación— y el crudo
 * descifrado de cada fila: así cuenta también lo que la clave no lleva (el encargo y la descripción del fondo).
 * Devuelve las filas existentes por llave, o null si difieren.
 */
export async function filasSiCoinciden(tx: Tx, cargaExistente: string, registros: readonly RegistroAvConClave[], llavero: Llavero): Promise<Map<string, string> | null> {
  const previas = await tx.filaFuente.findMany({
    where: { primeraCargaId: cargaExistente, tipoFuente: TIPO_FUENTE },
    select: { id: true, tipoFuente: true, claveNatural: true, ocurrencia: true, crudo: true },
  });
  const porLlave = new Map(previas.map((p) => [llaveDe(p.claveNatural, p.ocurrencia), p]));
  if (previas.length !== registros.length) return null;
  for (const r of registros) {
    const p = porLlave.get(llaveDe(r.clave, r.ocurrencia));
    if (!p || !mismoCrudo(descifrarCrudo(p.crudo, p, llavero), r.crudo)) return null;
  }
  return new Map([...porLlave].map(([llave, p]) => [llave, p.id]));
}

/** Reimportar: la carga nueva deja constancia de que vio cada fila, sin crear ningún hecho. */
export async function registrarVistas(tx: Tx, cargaId: string, registros: readonly RegistroAvConClave[], porLlave: ReadonlyMap<string, string>): Promise<void> {
  for (const r of registros) await tx.filaDeCarga.create({ data: { cargaId, filaNo: r.numero, filaFuenteId: porLlave.get(llaveDe(r.clave, r.ocurrencia))! } });
}

export interface DatosCertificacion {
  readonly cargaId: string;
  readonly fechaCorte: Date;
  readonly analizada: CertificacionAnalizada;
  readonly especies: ReadonlyMap<string, string>;
  readonly fondos: ReadonlyMap<string, string>;
}

export async function guardarCertificacion(tx: Tx, d: DatosCertificacion, llavero: Llavero): Promise<string> {
  const { leida, posiciones } = d.analizada;
  const cert = await tx.certificacion.create({
    data: { cargaId: d.cargaId, fechaCorte: d.fechaCorte, saldoEfectivo: leida.efectivo.saldo, referenciaEfectivo: referencia(leida.efectivo) },
    select: { id: true },
  });
  for (const p of posiciones) {
    await tx.certificacionPosicion.create({
      data: { certificacionId: cert.id, instrumentoId: d.especies.get(p.nemo)!, cantidad: p.cantidad, precioValoracion: p.precioValoracion, valorMercado: p.valorMercado, referenciaPdf: p.referenciaPdf },
    });
  }
  for (const f of leida.fondos) {
    const llave = { certificacionId: cert.id, instrumentoId: d.fondos.get(f.nit)! };
    await tx.certificacionFondo.create({ data: { ...llave, encargo: cifrarEncargo(f.encargo, llave, llavero), saldo: f.saldo, referenciaPdf: referencia(f) } });
  }
  return cert.id;
}
