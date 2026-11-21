/**
 * Lecturas de la base para la importación (solo lectura): dueño, especies, si la versión ya está y qué
 * decisiones faltan. La idempotencia va por clave natural, sin columnas nuevas: una versión es la misma
 * si tiene la misma vigencia, el mismo motivo y las mismas reglas; una decisión, si coincide en todo
 * (su regla, por contenido). Las dos se cuentan como multiconjunto: dos filas idénticas son dos.
 * Otra versión con la misma vigencia y otro contenido es un conflicto: una ficha nueva trae fecha nueva.
 */
import type { Db } from "../acceso";
import type { DatosRegla, DatosVersionValidable } from "../validar";
import { versionVigente } from "../versiones";
import { claveRegla, type DecisionPreparada } from "./mapear";
import type { Hallazgo } from "./tipos";

const CAMPOS_REGLA = { instrumentoId: true, condicion: true, nivel: true, accion: true, cantidad: true, plazoHasta: true, detalle: true } as const;

export type EstadoVersion =
  | { readonly estado: "NUEVA" }
  | { readonly estado: "YA_IMPORTADA"; readonly id: string; readonly reglaIds: readonly string[] }
  | { readonly estado: "CONFLICTO" }
  | { readonly estado: "RETROCEDE" };

/** Id del usuario si es dueño activo; nulo si no existe o no puede escribir el plan. */
export async function buscarDueno(db: Db, email: string): Promise<string | null> {
  const u = await db.usuario.findUnique({ where: { email }, select: { id: true, rol: true, activo: true } });
  return u && u.rol === "DUENO" && u.activo ? u.id : null;
}

/** Nemotécnico → id del instrumento (por nemotécnico y, si no, por símbolo de Trii). No crea nada. */
export async function resolverEspecies(db: Db, especies: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const lista = [...new Set(especies)];
  if (lista.length === 0) return new Map();
  const filas = await db.instrumento.findMany({
    where: { OR: [{ nemotecnico: { in: lista } }, { simboloTrii: { in: lista } }] },
    select: { id: true, nemotecnico: true, simboloTrii: true },
  });
  const pares = lista.flatMap((e): [string, string][] => {
    const fila = filas.find((f) => f.nemotecnico === e) ?? filas.find((f) => f.simboloTrii === e);
    return fila ? [[e, fila.id]] : [];
  });
  return new Map(pares);
}

/** Ids de la base en el orden de `esperadas`, si las reglas son las mismas (como multiconjunto). */
function emparejar(esperadas: DatosVersionValidable["reglas"], guardadas: readonly (Parameters<typeof claveRegla>[0] & { readonly id: string })[]): string[] | null {
  if (esperadas.length !== guardadas.length) return null;
  const libres = guardadas.map((g) => ({ id: g.id, clave: claveRegla(g) }));
  const ids: string[] = [];
  for (const r of esperadas) {
    const i = libres.findIndex((g) => g.clave === claveRegla(r));
    if (i < 0) return null;
    ids.push(libres[i]!.id);
    libres.splice(i, 1);
  }
  return ids;
}

export async function estadoVersion(db: Db, version: DatosVersionValidable): Promise<EstadoVersion> {
  const candidatas = await db.planVersion.findMany({
    where: { vigenteDesde: version.vigenteDesde },
    select: { id: true, motivo: true, reglas: { select: { id: true, ...CAMPOS_REGLA }, orderBy: { id: "asc" } } },
    orderBy: { version: "asc" },
  });
  for (const c of candidatas) {
    const reglaIds = c.motivo === version.motivo.trim() ? emparejar(version.reglas, c.reglas) : null;
    if (reglaIds) return { estado: "YA_IMPORTADA", id: c.id, reglaIds };
  }
  if (candidatas.length > 0) return { estado: "CONFLICTO" };
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { vigenteDesde: true } });
  return ultima && ultima.vigenteDesde > version.vigenteDesde ? { estado: "RETROCEDE" } : { estado: "NUEVA" };
}

interface DecisionComparable {
  readonly instrumentoId: string;
  readonly accion: string;
  readonly cantidad: bigint | null;
  readonly fechaDecision: Date;
  readonly motivo: string;
  readonly excepcion: boolean;
}

/** La regla entra por su contenido, no por su id: dos reglas idénticas son intercambiables. */
function claveDecision(d: DecisionComparable, regla: Parameters<typeof claveRegla>[0] | null): string {
  return JSON.stringify([d.instrumentoId, d.accion, d.cantidad?.toString() ?? null, d.fechaDecision.toISOString(), d.motivo.trim(), d.excepcion, regla ? claveRegla(regla) : null]);
}

/**
 * Por cada decisión, si ya está registrada bajo esa versión (aunque se haya corregido después). Una sola
 * consulta; se empareja en memoria contando ocurrencias, para que dos decisiones idénticas sean dos.
 */
export async function decisionesRegistradas(db: Db, versionId: string, reglas: readonly DatosRegla[], decisiones: readonly DecisionPreparada[]): Promise<boolean[]> {
  const guardadas = await db.decision.findMany({
    where: { planVersionId: versionId },
    select: { instrumentoId: true, accion: true, cantidad: true, fechaDecision: true, motivo: true, excepcion: true, regla: { select: CAMPOS_REGLA } },
  });
  const disponibles = new Map<string, number>();
  for (const g of guardadas) {
    const clave = claveDecision(g, g.regla);
    disponibles.set(clave, (disponibles.get(clave) ?? 0) + 1);
  }
  return decisiones.map((d) => {
    const clave = claveDecision(d, reglas[d.indiceRegla] ?? null);
    const quedan = disponibles.get(clave) ?? 0;
    if (quedan === 0) return false;
    disponibles.set(clave, quedan - 1);
    return true;
  });
}

/** Las decisiones por registrar deben caer en esta versión; si otra posterior ya manda ese día, no. */
export async function fueraDeLaVersion(db: Db, versionId: string, decisiones: readonly DecisionPreparada[]): Promise<Hallazgo[]> {
  const fechas = [...new Set(decisiones.map((d) => d.fechaDecision.getTime()))];
  const vigentes = new Map(await Promise.all(fechas.map(async (t) => [t, (await versionVigente(db, new Date(t)))?.id ?? null] as const)));
  return decisiones.flatMap((d) => (vigentes.get(d.fechaDecision.getTime()) === versionId ? [] : [{ linea: d.linea, item: null, codigo: "PLAN_POSTERIOR" }]));
}
