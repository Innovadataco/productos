/**
 * Ficha de ODIN (markdown) → estructura intermedia: la versión del plan («Posición única»), sus reglas
 * y las decisiones que se derivan de su tabla, más lo que no se importa, con línea y código. Cada
 * línea no vacía queda clasificada una sola vez (candado con prueba): nada se descarta en silencio.
 * Puro: no toca la base ni imprime nada.
 */
import { leerFilaPlan, leerVinetaPlan, type LecturaDeFila } from "./filas-plan";
import { leerBloques, partirNivelSuperior, textoPlano, type Bloque, type FilaTabla } from "./markdown";
import type { DecisionLeida, Destino, FichaLeida, Hallazgo, ReglaLeida } from "./tipos";
import { leerDiaMes, leerEnteroEs, leerPie } from "./valores-es";

type TipoTabla = "METADATOS" | "POSICIONES" | "PLAN" | "DESCONOCIDA";
type Seccion = "INICIO" | "PORTAFOLIO" | "CONTEXTO";

const ENCABEZADO_PLAN = /^posici[oó]n [uú]nica\s*\(([^)]*)\)/i;
const OPERACION = /\borden\s+(?:n\.?\s*[º°o]?\s*)?\d{5,}\b|\b(?:vendid|comprad)[oa]s?\b/i;
/** Sin línea: la falta es de la ficha entera. */
const TODA_LA_FICHA = 0;

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function tipoDeTabla(encabezado: readonly string[]): TipoTabla {
  const [a, b, c] = encabezado.map((e) => sinTildes(textoPlano(e)));
  if (a === "campo" && b === "valor") return "METADATOS";
  if (a === "ticker" && b === "acciones") return "POSICIONES";
  if (a === "ticker" && b === "decision" && c === "detalle") return "PLAN";
  return "DESCONOCIDA";
}

/** Primera pasada: la fecha del pie (la más reciente) y la cantidad de cada posición (lectura estricta). */
function leerReferencias(bloques: readonly Bloque[]): { referencia: Date | null; cantidades: ReadonlyMap<string, bigint | null> } {
  const fechas = bloques.flatMap((b) => (b.tipo === "cita" ? [leerPie(b.texto)?.fecha ?? null] : [])).filter((f): f is Date => f !== null);
  const referencia = fechas.length > 0 ? new Date(Math.max(...fechas.map((f) => f.getTime()))) : null;
  const cantidades = new Map<string, bigint | null>();
  for (const b of bloques) {
    if (b.tipo !== "tabla" || tipoDeTabla(b.encabezado) !== "POSICIONES") continue;
    for (const fila of b.filas) {
      const especie = textoPlano(fila.celdas[0] ?? "");
      // Una especie repetida es ambigua: queda sin cantidad.
      cantidades.set(especie, cantidades.has(especie) ? null : leerEnteroEs(textoPlano(fila.celdas[1] ?? "")));
    }
  }
  return { referencia, cantidades };
}

interface Encabezado {
  readonly linea: number;
  readonly fecha: Date | null;
  readonly motivo: string;
}

interface DecisionPendiente {
  readonly linea: number;
  readonly especie: string;
  readonly accion: DecisionLeida["accion"];
  readonly cantidad: bigint | null;
  readonly indiceRegla: number;
}

/** Acumula la segunda pasada. Mutable solo aquí adentro; `leerFicha` devuelve copias de solo lectura. */
class Lectura {
  readonly lineas = new Map<number, Destino>();
  readonly reglas: ReglaLeida[] = [];
  readonly decisiones: DecisionPendiente[] = [];
  readonly noImportados: Hallazgo[] = [];
  readonly avisos: Hallazgo[] = [];
  readonly bloqueos: Hallazgo[] = [];
  seccion: Seccion = "INICIO";
  encabezado: Encabezado | null = null;
  /** Entre «Posición única» y el siguiente título de sección. */
  enPlan = false;
  hayTablaDePlan = false;

  constructor(
    readonly referencia: Date | null,
    readonly cantidades: ReadonlyMap<string, bigint | null>,
  ) {}

  marcar(linea: number, destino: Destino): void {
    this.lineas.set(linea, destino);
  }

  noImportar(linea: number, codigo: string, item: number | null = null): void {
    this.noImportados.push({ linea, item, codigo });
    this.marcar(linea, "NO_IMPORTADA");
  }

  sumar(linea: number, l: LecturaDeFila): void {
    const base = this.reglas.length;
    this.reglas.push(...l.reglas);
    this.decisiones.push(...l.decisiones.map((d) => ({ linea: d.linea, especie: d.especie, accion: d.accion, cantidad: d.cantidad, indiceRegla: base + d.indiceLocal })));
    this.noImportados.push(...l.noImportados);
    this.avisos.push(...l.avisos);
    this.bloqueos.push(...l.bloqueos);
    this.marcar(linea, l.reglas.length > 0 ? "IMPORTADA" : "NO_IMPORTADA");
  }
}

function leerEncabezadoPlan(l: Lectura, linea: number, texto: string, fechaTexto: string): void {
  l.marcar(linea, "IMPORTADA");
  if (l.encabezado) {
    l.bloqueos.push({ linea, item: null, codigo: "PLAN_DUPLICADO" });
    return;
  }
  const fecha = l.referencia ? leerDiaMes(fechaTexto, l.referencia) : null;
  if (l.referencia && !fecha) l.bloqueos.push({ linea, item: null, codigo: "FECHA_DEL_PLAN_INVALIDA" });
  l.encabezado = { linea, fecha, motivo: texto };
  l.enPlan = true;
}

function leerFilasDeTabla(l: Lectura, tipo: TipoTabla, filas: readonly FilaTabla[]): void {
  for (const fila of filas) {
    if (l.seccion === "CONTEXTO") l.noImportar(fila.linea, "CONTEXTO");
    else if (tipo === "METADATOS") l.noImportar(fila.linea, "METADATOS");
    else if (tipo === "POSICIONES") l.noImportar(fila.linea, fila.celdas.some((c) => OPERACION.test(c)) ? "OPERACION_EJECUTADA" : "POSICION");
    else if (tipo === "PLAN" && l.enPlan) l.sumar(fila.linea, leerFilaPlan(fila, l.cantidades));
    else l.noImportar(fila.linea, "TEXTO_NO_RECONOCIDO");
  }
}

function leerTabla(l: Lectura, b: Extract<Bloque, { tipo: "tabla" }>): void {
  l.marcar(b.linea, "ESTRUCTURA");
  l.marcar(b.lineaSeparador, "ESTRUCTURA");
  const tipo = tipoDeTabla(b.encabezado);
  if (tipo === "PLAN" && l.seccion !== "CONTEXTO") {
    l.hayTablaDePlan = true;
    if (!l.enPlan) l.bloqueos.push({ linea: b.linea, item: null, codigo: "PLAN_SIN_FECHA" });
  }
  leerFilasDeTabla(l, tipo, b.filas);
}

function leerParrafo(l: Lectura, linea: number, crudo: string): void {
  const texto = textoPlano(crudo);
  const encabezado = ENCABEZADO_PLAN.exec(texto);
  if (l.seccion === "CONTEXTO") l.noImportar(linea, "CONTEXTO");
  else if (/^calendario\b/i.test(texto)) partirNivelSuperior(texto).forEach((_, i) => l.noImportar(linea, "CALENDARIO", i + 1));
  else if (encabezado) leerEncabezadoPlan(l, linea, texto, encabezado[1]!.trim());
  else l.noImportar(linea, l.enPlan ? "TEXTO_NO_RECONOCIDO" : "METADATOS");
}

function leerVineta(l: Lectura, linea: number, texto: string): void {
  if (l.seccion === "CONTEXTO") l.noImportar(linea, "CONTEXTO");
  else if (l.enPlan) l.sumar(linea, leerVinetaPlan(linea, texto));
  else l.noImportar(linea, l.seccion === "PORTAFOLIO" ? "CIFRA_AGREGADA" : "METADATOS");
}

function leerBloque(l: Lectura, b: Bloque): void {
  switch (b.tipo) {
    case "titulo":
      l.marcar(b.linea, "ESTRUCTURA");
      if (b.nivel >= 2) {
        l.seccion = /contexto/i.test(b.texto) ? "CONTEXTO" : "PORTAFOLIO";
        // El bloque del plan termina con la sección: lo que sigue ya no es del plan.
        l.enPlan = false;
      }
      return;
    case "separador":
      l.marcar(b.linea, "ESTRUCTURA");
      return;
    case "cita":
      if (leerPie(b.texto)) l.marcar(b.linea, "ESTRUCTURA");
      else l.noImportar(b.linea, l.seccion === "CONTEXTO" ? "CONTEXTO" : "METADATOS");
      return;
    case "tabla":
      leerTabla(l, b);
      return;
    case "vineta":
      leerVineta(l, b.linea, b.texto);
      return;
    case "parrafo":
      leerParrafo(l, b.linea, b.texto);
  }
}

const porLinea = (a: Hallazgo, b: Hallazgo) => a.linea - b.linea || (a.item ?? 0) - (b.item ?? 0);

function armarPlan(l: Lectura): FichaLeida["plan"] {
  const e = l.encabezado;
  if (!e?.fecha) return null;
  const fecha = e.fecha;
  const decisiones = l.decisiones.map(
    (d): DecisionLeida => ({ ...d, fechaDecision: fecha, motivo: `${e.motivo} — ${l.reglas[d.indiceRegla]!.detalle}` }),
  );
  return { linea: e.linea, vigenteDesde: fecha, motivo: e.motivo, reglas: [...l.reglas], decisiones };
}

export function leerFicha(contenido: string): FichaLeida {
  const bloques = leerBloques(contenido);
  const { referencia, cantidades } = leerReferencias(bloques);
  const l = new Lectura(referencia, cantidades);
  for (const b of bloques) leerBloque(l, b);
  const globales: Hallazgo[] = [
    ...(referencia ? [] : [{ linea: TODA_LA_FICHA, item: null, codigo: "SIN_FECHA_DE_REFERENCIA" }]),
    ...(referencia && !l.encabezado && !l.hayTablaDePlan ? [{ linea: TODA_LA_FICHA, item: null, codigo: "SIN_PLAN" }] : []),
  ];
  return {
    referencia,
    plan: armarPlan(l),
    noImportados: [...l.noImportados].sort(porLinea),
    avisos: [...l.avisos].sort(porLinea),
    bloqueos: [...globales, ...l.bloqueos].sort(porLinea),
    lineas: [...l.lineas.entries()].sort(([a], [b]) => a - b).map(([linea, destino]) => ({ linea, destino })),
  };
}
