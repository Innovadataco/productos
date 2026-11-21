/**
 * Estructura intermedia → datos de `crearVersionPlan` y `registrarDecision`, validados con las mismas
 * funciones puras del corte 1 ANTES de escribir: si algo no pasa, no se escribe nada. Los errores
 * vuelven con la línea de la ficha y el nombre del campo, nunca con el valor.
 */
import { Prisma } from "@prisma/client";
import type { ErrorCampo } from "../errores";
import { esFechaDeNegocio } from "../fechas";
import { validarDecision, validarDecisionContraRegla, validarVersionPlan, type DatosDecisionValidable, type DatosRegla, type DatosVersionValidable } from "../validar";
import type { Hallazgo, PlanLeido } from "./tipos";

/** Marcadores para validar sin base: nunca llegan a escribirse (hay bloqueo si una especie falta). */
const ESPECIE_POR_RESOLVER = "especie-por-resolver";
const VERSION_PREVISTA = "version-prevista";
const ESCALA_NIVEL = 6;
const CAMPO_DE_REGLA = /^reglas\[(\d+)\]\.(.+)$/;

export interface DecisionPreparada extends DatosDecisionValidable {
  /** Índice en `version.reglas` de la regla que cita. */
  readonly indiceRegla: number;
  readonly linea: number;
}

export interface Preparada {
  readonly version: DatosVersionValidable;
  readonly decisiones: readonly DecisionPreparada[];
  readonly bloqueos: readonly Hallazgo[];
}

/** Lo que se compara de una regla para saber si ya está en la base (sin columnas nuevas). */
export interface ReglaComparable {
  readonly instrumentoId: string | null;
  readonly condicion: string;
  readonly nivel: Prisma.Decimal | string | null;
  readonly accion: string;
  readonly cantidad: bigint | null;
  readonly plazoHasta: Date | null;
  readonly detalle: string;
}

/** Clave natural de una regla: el nivel con su escala de la base y el detalle recortado, como se guardan. */
export function claveRegla(r: ReglaComparable): string {
  const nivel = r.nivel === null ? null : new Prisma.Decimal(r.nivel.toString()).toFixed(ESCALA_NIVEL);
  return JSON.stringify([r.instrumentoId, r.condicion, nivel, r.accion, r.cantidad?.toString() ?? null, r.plazoHasta?.toISOString() ?? null, r.detalle.trim()]);
}

function unicos(hallazgos: readonly Hallazgo[]): Hallazgo[] {
  const vistos = new Set<string>();
  return hallazgos.filter((h) => {
    const clave = JSON.stringify([h.linea, h.item, h.codigo, h.campo ?? null]);
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/** «reglas[3].detalle» → línea e ítem de esa regla en la ficha; lo demás, a la línea del encabezado. */
function ubicarErrorDeVersion(plan: PlanLeido, e: ErrorCampo): Hallazgo {
  const m = CAMPO_DE_REGLA.exec(e.campo);
  const regla = m ? plan.reglas[Number(m[1])] : undefined;
  return regla ? { linea: regla.linea, item: regla.item, codigo: e.codigo, campo: m![2]! } : { linea: plan.linea, item: null, codigo: e.codigo, campo: e.campo };
}

export function prepararImportacion(plan: PlanLeido, especies: ReadonlyMap<string, string>, hoy: Date): Preparada {
  const idDe = (especie: string) => especies.get(especie) ?? ESPECIE_POR_RESOLVER;
  const reglas = plan.reglas.map(
    (r): DatosRegla => ({ instrumentoId: r.especie === null ? null : idDe(r.especie), condicion: r.condicion, nivel: r.nivel, accion: r.accion, cantidad: r.cantidad, plazoHasta: r.plazoHasta, detalle: r.detalle }),
  );
  const version: DatosVersionValidable = { vigenteDesde: plan.vigenteDesde, motivo: plan.motivo, reglas };
  const decisiones = plan.decisiones.map(
    (d): DecisionPreparada => ({ fechaDecision: d.fechaDecision, instrumentoId: idDe(d.especie), accion: d.accion, cantidad: d.cantidad, reglaId: null, excepcion: false, motivo: d.motivo, indiceRegla: d.indiceRegla, linea: d.linea }),
  );
  const sinInstrumento = [...plan.reglas, ...plan.decisiones]
    .filter((x) => x.especie !== null && !especies.has(x.especie))
    .map((x): Hallazgo => ({ linea: x.linea, item: null, codigo: "ESPECIE_SIN_INSTRUMENTO" }));
  const deVersion = validarVersionPlan(version, hoy).map((e) => ubicarErrorDeVersion(plan, e));
  const deDecisiones = decisiones.flatMap((d) => {
    const regla = reglas[d.indiceRegla]!;
    // Siempre, también en una versión NUEVA: una decisión anterior a la vigencia no cae en esta versión,
    // y la versión (de solo inserción) quedaría sin sus decisiones para siempre.
    const antes = esFechaDeNegocio(d.fechaDecision) && esFechaDeNegocio(version.vigenteDesde) && d.fechaDecision < version.vigenteDesde;
    const errores = [
      ...(antes ? [{ campo: "fechaDecision", codigo: "DECISION_ANTES_DE_VIGENCIA" }] : []),
      ...validarDecision(d, hoy),
      ...validarDecisionContraRegla(d, { planVersionId: VERSION_PREVISTA, instrumentoId: regla.instrumentoId, accion: regla.accion }, VERSION_PREVISTA),
    ];
    return errores.map((e): Hallazgo => ({ linea: d.linea, item: null, codigo: e.codigo, campo: e.campo }));
  });
  return { version, decisiones, bloqueos: unicos([...sinInstrumento, ...deVersion, ...deDecisiones]) };
}
