/**
 * Argumentos de scripts/registrar-rendimientos-fondo.ts (frente fondo-rendimientos). Puros y estrictos: se leen ANTES
 * de abrir el archivo y la base, así que lo que no se reconoce sale con 2 sin tocar nada.
 *   --archivo <rendimientos.csv> --email <correo-del-dueño> --fondo <código del fondo en la SFC> [--aplicar]
 * - Cada opción una sola vez; nada suelto; ni `--`; la ruta nunca empieza por «-» y termina en .csv.
 * - El correo pasa por src/cli/correo.ts; el fondo, por CODIGO_FIC_RE (src/fondo/sfc.ts). Sin --aplicar es ensayo.
 * - Los códigos nunca repiten lo que se escribió (la ruta, el correo o el código del fondo).
 */
import { correoDeCli } from "../../cli/correo";
import { leerConParseArgs } from "../../cli/opciones";
import { fallo, type OpcionesSalida, type SalidaCli } from "../../datos-oficiales/registro/reporte";
import { CODIGO_FIC_RE } from "../sfc";

const LO_QUE_HACE = [
  "  Registra los rendimientos del fondo (FIC) pagados en efectivo y su retención en la fuente, del CSV del dueño:",
  "  fecha,tipo,valor (una fila por operación del encargo; tipo RENDIMIENTO o RETENCION; valor con punto, sin miles).",
  "  El RENDIMIENTO entra a la caja (ajuste de caja RENDIMIENTO_FIC); la RETENCION queda como hecho del fondo:",
  "  no mueve la caja (el pago ya llega neto). Sin --aplicar es ensayo: valida y cuenta, no escribe nada. Lo registrado",
  "  no se corrige: repetir el mismo CSV no escribe nada, y una fila ya registrada con otro valor rechaza el archivo.",
];

const SALIDAS = "  Salida: 0 bien · 1 error de la base o del cifrado · 2 uso o archivo ilegible · 3 rechazado (no escribió nada).";

export const USO_RENDIMIENTOS = [
  "Uso: npx tsx scripts/registrar-rendimientos-fondo.ts --archivo <rendimientos.csv> --email <correo-del-dueño> \\",
  "       --fondo <código del fondo en la SFC> [--aplicar]",
  ...LO_QUE_HACE,
  SALIDAS,
].join("\n");

export const USO_VIA_B_RENDIMIENTOS = [
  "Uso (vía B, §11 del runbook): el CSV va en el sobre; la cabecera privada lleva --email y el correo del dueño, --fondo",
  "  y el código del fondo en la SFC, y --aplicar para escribir (sin él, ensayo):",
  "  scripts/armar-sobre.sh <cabecera> <rendimientos.csv> | ssh <vps> <raíz>/repo/008-2026-INVERSIONES/scripts/cargar-prod.sh registrar-rendimientos-fondo",
  ...LO_QUE_HACE,
  SALIDAS,
].join("\n");

export type CodigoArgumentosRendimientos =
  | "ARGUMENTOS_INVALIDOS"
  | "OPCION_REPETIDA"
  | "FALTA_ARCHIVO"
  | "ARCHIVO_NO_CSV"
  | "FALTA_EMAIL"
  | "EMAIL_INVALIDO"
  | "FALTA_FONDO"
  | "FONDO_INVALIDO";

export type ArgumentosRendimientos =
  | { readonly ok: true; readonly archivo: string; readonly email: string; readonly codigoFic: string; readonly aplicar: boolean }
  | { readonly ok: false; readonly codigo: CodigoArgumentosRendimientos };

const OPCIONES = { archivo: { type: "string" }, email: { type: "string" }, fondo: { type: "string" }, aplicar: { type: "boolean" } } as const;

const no = (codigo: CodigoArgumentosRendimientos): ArgumentosRendimientos => ({ ok: false, codigo });

export function leerArgumentosRendimientos(argv: readonly string[]): ArgumentosRendimientos {
  const r = leerConParseArgs(argv, OPCIONES);
  if (!r) return no("ARGUMENTOS_INVALIDOS");
  if (r.repetidas.length > 0) return no("OPCION_REPETIDA");
  const { archivo, email, fondo, aplicar } = r.valores;
  if (archivo === undefined || archivo.trim() === "") return no("FALTA_ARCHIVO");
  if (archivo.startsWith("-")) return no("ARGUMENTOS_INVALIDOS");
  if (!archivo.toLowerCase().endsWith(".csv")) return no("ARCHIVO_NO_CSV");
  if (email === undefined) return no("FALTA_EMAIL");
  const correo = correoDeCli(email);
  if (!correo) return no("EMAIL_INVALIDO");
  if (fondo === undefined) return no("FALTA_FONDO");
  if (!CODIGO_FIC_RE.test(fondo)) return no("FONDO_INVALIDO");
  return { ok: true, archivo, email: correo, codigoFic: fondo, aplicar: aplicar === true };
}

/** Uso inválido: 2, con el código y la ayuda (la de la vía B en producción: sin `npx tsx`). */
export function salidaUsoRendimientos(codigo: CodigoArgumentosRendimientos, o: OpcionesSalida): SalidaCli {
  return fallo(o, 2, [`❌ argumentos · ${codigo}`, o.produccion ? USO_VIA_B_RENDIMIENTOS : USO_RENDIMIENTOS]);
}
