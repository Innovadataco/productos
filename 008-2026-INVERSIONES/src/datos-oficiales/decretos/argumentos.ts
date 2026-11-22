/**
 * Argumentos de scripts/importar-decretos.ts (fase C, C4a). Puros y estrictos: se leen ANTES de abrir el archivo y la
 * base, así que lo que no se reconoce sale con 2 sin tocar nada.
 *   --archivo <decretos.csv> --email <correo-del-dueño> [--aplicar]
 * - Cada opción una sola vez; nada suelto; ni `--`; un valor nunca empieza por «-».
 * - El correo pasa por src/cli/correo.ts. Sin --aplicar es ensayo.
 * - Los códigos nunca repiten lo que se escribió (la ruta o el correo del dueño).
 */
import { parseArgs } from "node:util";
import { correoDeCli } from "../../cli/correo";
import { fallo, type OpcionesSalida, type SalidaCli } from "../registro/reporte";

/** La condición que dejó C1, dicha en la ayuda (local y vía B). */
const AVISO_CRUCE = [
  "  ⚠️  NO cargue decretos reales todavía: hasta que el motor de proyecciones cruce los decretos con los pagos de Trii",
  "  por ventana (C5b), contaría dos veces un pago que Trii acredita otro día. Por eso --aplicar solo escribe en una base",
  "  de pruebas (nombre terminado en _test); en cualquier otra sale CRUCE_PENDIENTE. El ensayo funciona en todas.",
];

export const USO_IMPORTAR_DECRETOS = [
  "Uso: npx tsx scripts/importar-decretos.ts --archivo <decretos.csv> --email <correo-del-dueño> [--aplicar]",
  "  Registra los decretos de dividendos del CSV del dueño (contrato en src/datos-oficiales/decretos/csv.ts), una fila por",
  "  cuota y con su referencia oficial (SFC o BVC). Sin --aplicar es ensayo: valida y cuenta, no escribe nada.",
  "  Una fila distinta de lo registrado es la versión siguiente, que retira a la anterior; anular es la misma fila con",
  "  anulada=SI y una nota (borrar la fila del archivo no anula). Solo en pesos y en dinero: moneda=COP, forma=DINERO.",
  ...AVISO_CRUCE,
  "  Salida: 0 bien · 1 error de la base o del cifrado · 2 uso o archivo ilegible · 3 rechazado (no escribió nada).",
].join("\n");

export const USO_VIA_B_DECRETOS = [
  "Uso (vía B, §11 del runbook): el CSV va en el sobre; la cabecera privada lleva --email y el correo del dueño, y",
  "  --aplicar para escribir (sin él, ensayo).",
  ...AVISO_CRUCE,
  "  Salida: 0 bien · 1 error de la base o del cifrado · 2 uso o archivo ilegible · 3 rechazado (no escribió nada).",
].join("\n");

export type CodigoArgumentos = "ARGUMENTOS_INVALIDOS" | "OPCION_REPETIDA" | "FALTA_ARCHIVO" | "ARCHIVO_NO_CSV" | "FALTA_EMAIL" | "EMAIL_INVALIDO";

export type ArgumentosDecretos =
  | { readonly ok: true; readonly archivo: string; readonly email: string; readonly aplicar: boolean }
  | { readonly ok: false; readonly codigo: CodigoArgumentos };

const OPCIONES = { archivo: { type: "string" }, email: { type: "string" }, aplicar: { type: "boolean" } } as const;

function leer(argv: readonly string[]) {
  try {
    return parseArgs({ args: [...argv], strict: true, allowPositionals: false, tokens: true, options: OPCIONES });
  } catch {
    return null;
  }
}

const no = (codigo: CodigoArgumentos): ArgumentosDecretos => ({ ok: false, codigo });

export function leerArgumentosDecretos(argv: readonly string[]): ArgumentosDecretos {
  const r = leer(argv);
  if (!r || r.tokens.some((t) => t.kind === "option-terminator")) return no("ARGUMENTOS_INVALIDOS");
  const nombres = r.tokens.flatMap((t) => (t.kind === "option" ? [t.name] : []));
  if (new Set(nombres).size !== nombres.length) return no("OPCION_REPETIDA");
  const { archivo, email, aplicar } = r.values;
  if (archivo === undefined || archivo.trim() === "") return no("FALTA_ARCHIVO");
  if (archivo.startsWith("-")) return no("ARGUMENTOS_INVALIDOS");
  if (!archivo.toLowerCase().endsWith(".csv")) return no("ARCHIVO_NO_CSV");
  if (email === undefined) return no("FALTA_EMAIL");
  const correo = correoDeCli(email);
  if (!correo) return no("EMAIL_INVALIDO");
  return { ok: true, archivo, email: correo, aplicar: aplicar === true };
}

/** Uso inválido: 2, con el código y la ayuda (la de la vía B en producción: sin `npx tsx`). */
export function salidaUso(codigo: CodigoArgumentos, o: OpcionesSalida): SalidaCli {
  return fallo(o, 2, [`❌ argumentos · ${codigo}`, o.produccion ? USO_VIA_B_DECRETOS : USO_IMPORTAR_DECRETOS]);
}
