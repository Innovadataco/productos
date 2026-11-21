/**
 * Validaciones puras del plan, las decisiones y los enlaces (fase B). No tocan la base: las
 * funciones de dominio las usan antes de escribir, y los CHECK de la migración son el respaldo.
 * El código calcula y registra; no recomienda comprar ni vender.
 */
import type { AccionPlan, CondicionRegla, EstadoOrden, LadoOrden } from "@prisma/client";
import type { ErrorCampo } from "./errores";
import { esFechaDeNegocio, sumarDias } from "./fechas";

export const MAX_TEXTO = 2000;
/** Tope de `vigenteDesde`: hoy + un año. La vigencia no retrocede y la tabla no se edita, así que un
 *  año mal escrito bloquearía para siempre las versiones siguientes. */
export const MAX_DIAS_VIGENCIA_FUTURA = 365;
/** Decimal(20,6): hasta 14 enteros y 6 decimales, sin signo ni notación científica. */
const NIVEL = /^\d{1,14}(\.\d{1,6})?$/;

const ACCIONES = { COMPRAR: true, VENDER: true, NO_ACTUAR: true } satisfies Record<AccionPlan, true>;
const CONDICIONES = { NINGUNA: true, CIERRE_BAJO: true, CIERRE_SOBRE: true, MONTO_ORDEN_BAJO: true, LIBRE: true } satisfies Record<CondicionRegla, true>;
const SIN_NIVEL: ReadonlySet<string> = new Set<CondicionRegla>(["NINGUNA", "LIBRE"]);
const LADO_DE: Readonly<Record<AccionPlan, LadoOrden | null>> = { COMPRAR: "COMPRA", VENDER: "VENTA", NO_ACTUAR: null };

// Propias del objeto: `in` aceptaría claves heredadas como «toString».
const esAccion = (v: unknown): v is AccionPlan => typeof v === "string" && Object.hasOwn(ACCIONES, v);
const esCondicion = (v: unknown): v is CondicionRegla => typeof v === "string" && Object.hasOwn(CONDICIONES, v);

export interface DatosRegla {
  /** Nulo = regla de portafolio (aplica a todas las especies). */
  readonly instrumentoId: string | null;
  readonly condicion: CondicionRegla;
  /** Texto decimal («1250.5»): precio de cierre o pesos por orden, según la condición. */
  readonly nivel: string | null;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  readonly plazoHasta: Date | null;
  readonly detalle: string;
}

export interface DatosVersionValidable {
  readonly vigenteDesde: Date;
  readonly motivo: string;
  readonly reglas: readonly DatosRegla[];
}

export interface DatosDecisionValidable {
  readonly fechaDecision: Date;
  readonly instrumentoId: string;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  readonly reglaId: string | null;
  readonly excepcion: boolean;
  readonly motivo: string;
}

function revisarTexto(campo: string, valor: unknown): ErrorCampo[] {
  if (typeof valor !== "string" || valor.trim() === "") return [{ campo, codigo: "VACIO" }];
  return valor.length > MAX_TEXTO ? [{ campo, codigo: "DEMASIADO_LARGO" }] : [];
}

function revisarFecha(campo: string, valor: unknown): ErrorCampo[] {
  return esFechaDeNegocio(valor) ? [] : [{ campo, codigo: "FECHA_INVALIDA" }];
}

function revisarCantidad(campo: string, valor: unknown): ErrorCampo[] {
  if (valor === null) return [];
  return typeof valor === "bigint" && valor > 0n ? [] : [{ campo, codigo: "CANTIDAD_INVALIDA" }];
}

function revisarNivel(campo: string, condicion: string, nivel: unknown): ErrorCampo[] {
  if (!esCondicion(condicion)) return [];
  if (SIN_NIVEL.has(condicion)) return nivel === null ? [] : [{ campo, codigo: "NIVEL_SOBRA" }];
  if (nivel === null) return [{ campo, codigo: "NIVEL_FALTA" }];
  const valido = typeof nivel === "string" && NIVEL.test(nivel) && /[1-9]/.test(nivel);
  return valido ? [] : [{ campo, codigo: "NIVEL_INVALIDO" }];
}

function revisarRegla(r: DatosRegla, i: number, vigenteDesde: Date): ErrorCampo[] {
  const c = (campo: string) => `reglas[${i}].${campo}`;
  const errores = [
    ...(r.instrumentoId !== null && (typeof r.instrumentoId !== "string" || r.instrumentoId.trim() === "") ? [{ campo: c("instrumentoId"), codigo: "VACIO" }] : []),
    ...(esCondicion(r.condicion) ? [] : [{ campo: c("condicion"), codigo: "CONDICION_INVALIDA" }]),
    ...(esAccion(r.accion) ? [] : [{ campo: c("accion"), codigo: "ACCION_INVALIDA" }]),
    ...revisarNivel(c("nivel"), r.condicion, r.nivel),
    ...revisarCantidad(c("cantidad"), r.cantidad),
    ...revisarTexto(c("detalle"), r.detalle),
  ];
  // Plazo ≥ vigencia: una regla vencida no se arrastra; sale de la foto nueva y queda en la versión
  // anterior, que es su historia.
  if (r.plazoHasta === null) return errores;
  if (!esFechaDeNegocio(r.plazoHasta)) return [...errores, { campo: c("plazoHasta"), codigo: "FECHA_INVALIDA" }];
  const antes = esFechaDeNegocio(vigenteDesde) && r.plazoHasta < vigenteDesde;
  return antes ? [...errores, { campo: c("plazoHasta"), codigo: "PLAZO_ANTES_DE_LA_VIGENCIA" }] : errores;
}

/** `hoy`: fecha de negocio en Colombia (la inyecta quien llama, para poder probarla). */
export function validarVersionPlan(d: DatosVersionValidable, hoy: Date): ErrorCampo[] {
  const reglas = Array.isArray(d.reglas) ? d.reglas : [];
  const lejana = esFechaDeNegocio(d.vigenteDesde) && d.vigenteDesde > sumarDias(hoy, MAX_DIAS_VIGENCIA_FUTURA);
  return [
    ...revisarFecha("vigenteDesde", d.vigenteDesde),
    ...(lejana ? [{ campo: "vigenteDesde", codigo: "VIGENCIA_DEMASIADO_LEJANA" }] : []),
    ...revisarTexto("motivo", d.motivo),
    ...(reglas.length === 0 ? [{ campo: "reglas", codigo: "SIN_REGLAS" }] : []),
    ...reglas.flatMap((r, i) => revisarRegla(r, i, d.vigenteDesde)),
  ];
}

/** Una decisión ya ocurrió: su fecha es hoy como máximo. */
export function validarDecision(d: DatosDecisionValidable, hoy: Date): ErrorCampo[] {
  const accionValida = esAccion(d.accion);
  const futura = esFechaDeNegocio(d.fechaDecision) && d.fechaDecision > hoy;
  return [
    ...revisarFecha("fechaDecision", d.fechaDecision),
    ...(futura ? [{ campo: "fechaDecision", codigo: "FECHA_FUTURA" }] : []),
    ...(typeof d.instrumentoId === "string" && d.instrumentoId.trim() !== "" ? [] : [{ campo: "instrumentoId", codigo: "VACIO" }]),
    ...(accionValida ? [] : [{ campo: "accion", codigo: "ACCION_INVALIDA" }]),
    ...(accionValida && d.accion === "NO_ACTUAR" && d.cantidad === null ? [{ campo: "cantidad", codigo: "CANTIDAD_FALTA" }] : revisarCantidad("cantidad", d.cantidad)),
    ...(d.excepcion === true && d.reglaId === null ? [{ campo: "reglaId", codigo: "EXCEPCION_SIN_REGLA" }] : []),
    ...revisarTexto("motivo", d.motivo),
  ];
}

export interface ReglaCitada {
  readonly planVersionId: string;
  readonly instrumentoId: string | null;
  readonly accion: AccionPlan;
}

/** La regla citada es de la versión vigente y de la especie (o del portafolio); apartarse de su
 *  acción solo se registra como excepción. */
export function validarDecisionContraRegla(
  d: { readonly instrumentoId: string; readonly accion: AccionPlan; readonly excepcion: boolean },
  regla: ReglaCitada,
  planVersionVigenteId: string,
): ErrorCampo[] {
  if (regla.planVersionId !== planVersionVigenteId) return [{ campo: "reglaId", codigo: "REGLA_DE_OTRA_VERSION" }];
  if (regla.instrumentoId !== null && regla.instrumentoId !== d.instrumentoId) return [{ campo: "reglaId", codigo: "REGLA_DE_OTRA_ESPECIE" }];
  return regla.accion !== d.accion && !d.excepcion ? [{ campo: "accion", codigo: "ACCION_DISTINTA_SIN_EXCEPCION" }] : [];
}

export interface OrdenEnlazable {
  readonly estado: EstadoOrden;
  readonly instrumentoId: string;
  readonly lado: LadoOrden;
  readonly fechaOperacion: Date;
}

export interface DecisionEnlazable {
  readonly accion: AccionPlan;
  readonly instrumentoId: string;
  readonly fechaDecision: Date;
  readonly reemplazada: boolean;
}

/** Motivo de un enlace: opcional en el primero, obligatorio en una corrección (lo exige el dominio). */
export function validarMotivoEnlace(motivo: string | null | undefined): ErrorCampo[] {
  if (motivo === null || motivo === undefined || (typeof motivo === "string" && motivo.trim() === "")) return [];
  return revisarTexto("motivo", motivo);
}

/** Una orden se enlaza a la decisión que la originó: aprobada, de la misma especie y lado, y no
 *  anterior a la decisión. «No actuar» no tiene órdenes; una decisión corregida ya no recibe. */
export function validarEnlace(orden: OrdenEnlazable, decision: DecisionEnlazable): ErrorCampo[] {
  const lado = LADO_DE[decision.accion];
  return [
    ...(orden.estado === "APROBADO" ? [] : [{ campo: "ordenId", codigo: "ORDEN_NO_APROBADA" }]),
    ...(decision.reemplazada ? [{ campo: "decisionId", codigo: "DECISION_REEMPLAZADA" }] : []),
    ...(lado === null ? [{ campo: "decisionId", codigo: "NO_ACTUAR_SIN_ORDEN" }] : []),
    ...(orden.instrumentoId === decision.instrumentoId ? [] : [{ campo: "ordenId", codigo: "ESPECIE_DISTINTA" }]),
    ...(lado !== null && orden.lado !== lado ? [{ campo: "ordenId", codigo: "LADO_DISTINTO" }] : []),
    ...(orden.fechaOperacion < decision.fechaDecision ? [{ campo: "ordenId", codigo: "ORDEN_ANTERIOR_A_LA_DECISION" }] : []),
  ];
}
