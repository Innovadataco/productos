/**
 * Salida de la CLI: modo, conteos, códigos y números de línea («línea.ítem» si la línea se parte en
 * « · »). Nunca especies, cifras, fechas ni textos de la ficha: es real y privada.
 */
import type { Conteo, EstadoImportacion, ModoImportacion, ResultadoImportacion } from "./resultado";
import { PENDIENTES_DE_ENLAZAR, type Hallazgo } from "./tipos";

const EXPLICACION: Readonly<Record<string, string>> = {
  VERSION_EN_CONFLICTO: "ya hay una versión con esa fecha y otro contenido: una ficha nueva debe traer una fecha nueva",
  VIGENCIA_RETROCEDE: "la base ya tiene una versión posterior",
  PLAN_POSTERIOR: "otra versión posterior ya manda en la fecha de la decisión",
  DUENO_NO_AUTORIZADO: "el correo no es de un dueño activo",
  ESPECIE_SIN_INSTRUMENTO: "importe primero las órdenes de Trii de esa especie",
  DECISION_ANTES_DE_VIGENCIA: "la decisión no puede ser anterior a la vigencia de su versión",
  CANTIDAD_NO_RECONOCIDA: "la cantidad debe ser un entero (no se trunca)",
  CANDADO_NO_SOLTADO: "el candado no se soltó limpio; PostgreSQL lo suelta al cerrar la conexión",
};

const RESULTADO: Readonly<Record<Exclude<EstadoImportacion, "FALLO_PARCIAL">, string>> = {
  LISTO: "listo para --aplicar (no se escribió nada)",
  SIN_CAMBIOS: "ya estaba importada; no hay nada nuevo",
  BLOQUEADO: "bloqueado; no se escribió nada",
  APLICADO: "aplicado",
  CANDADO_OCUPADO: "otra importación en curso; no se escribió nada",
};

const ubicacion = (h: Hallazgo) => (h.linea === 0 ? "toda la ficha" : h.item === null ? `${h.linea}` : `${h.linea}.${h.item}`);

function conteo(nombre: string, c: Conteo, modo: ModoImportacion): string {
  return `${nombre}: ${c.leidas} leídas · ${c.nuevas} ${modo === "ENSAYO" ? "por crear" : "creadas"} · ${c.existentes} ya en la base`;
}

function listaDeLineas(hs: readonly Hallazgo[]): string {
  const lugares = [...new Set(hs.map(ubicacion))];
  if (lugares.length === 1 && lugares[0] === "toda la ficha") return "toda la ficha";
  return `${lugares.length === 1 ? "línea" : "líneas"} ${lugares.join(", ")}`;
}

/** Un renglón por código (y campo), en el orden en que aparecen. */
function porCodigo(titulo: string, hs: readonly Hallazgo[]): string[] {
  if (hs.length === 0) return [];
  const grupos = new Map<string, Hallazgo[]>();
  for (const h of hs) {
    const clave = h.campo ? `${h.codigo} (${h.campo})` : h.codigo;
    grupos.set(clave, [...(grupos.get(clave) ?? []), h]);
  }
  const renglones = [...grupos.entries()].map(([clave, grupo]) => {
    const explicacion = EXPLICACION[grupo[0]!.codigo];
    return `  ${clave} · ${listaDeLineas(grupo)}${explicacion ? ` — ${explicacion}` : ""}`;
  });
  return [`${titulo}:`, ...renglones];
}

function resultado(r: ResultadoImportacion): string {
  if (r.estado !== "FALLO_PARCIAL") return `Resultado: ${RESULTADO[r.estado]}`;
  const donde = r.error ? `en la línea ${ubicacion(r.error)} (${r.error.codigo}${r.error.nombre ? `: ${r.error.nombre}` : ""})` : "a mitad";
  return `Resultado: falló ${donde}; repita el comando para completar lo que falta`;
}

export function formatearReporte(r: ResultadoImportacion, nombreArchivo: string): readonly string[] {
  const pendientes = r.noImportados.filter((h) => PENDIENTES_DE_ENLAZAR.has(h.codigo));
  return [
    `Ficha: ${nombreArchivo} · ${r.modo === "ENSAYO" ? "ENSAYO (no escribe nada)" : "APLICAR (escribe en la base)"}`,
    conteo("Versiones", r.versiones, r.modo),
    conteo("Reglas", r.reglas, r.modo),
    conteo("Decisiones", r.decisiones, r.modo),
    `No importado: ${r.noImportados.length} · avisos: ${r.avisos.length} · bloqueos: ${r.bloqueos.length}`,
    ...porCodigo("No importado, por código", r.noImportados),
    ...(pendientes.length > 0 ? [`Pendientes de enlazar (corte siguiente, con el dueño): ${listaDeLineas(pendientes)}`] : []),
    ...porCodigo("Avisos (importado, con una parte solo en el texto)", r.avisos),
    ...porCodigo("Bloqueos", r.bloqueos),
    resultado(r),
  ];
}

/** 0: bien · 1: bloqueado o a mitad · 3: otra importación en curso (2 lo usa la CLI para el uso). */
export function codigoDeSalida(r: ResultadoImportacion): number {
  if (r.estado === "CANDADO_OCUPADO") return 3;
  return r.estado === "BLOQUEADO" || r.estado === "FALLO_PARCIAL" ? 1 : 0;
}
