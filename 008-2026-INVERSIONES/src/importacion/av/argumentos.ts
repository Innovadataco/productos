/**
 * Argumentos de los CLI de la certificación de A&V. Puros: no tocan la base ni el disco. Un error lleva un código
 * fijo y nunca repite lo que se escribió (puede ser el correo del dueño o el código de su fondo).
 */
import { CODIGO_FIC_RE } from "../../fondo/sfc";
import { leerFechaIso } from "../trii/valores";

export class ErrorArgumentosAv extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
    this.name = "ErrorArgumentosAv";
  }
}

export interface ArgumentosImportarCertificacion {
  readonly email: string;
  readonly fechaCorte: Date;
  readonly fondo: string | null;
  readonly archivo: string;
}

export interface ArgumentosConciliar {
  readonly fechaCorte: Date;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}$/;

/** Separa `--opción valor` de los argumentos sueltos; solo admite las opciones dadas y cada una una vez. */
function separar(argv: readonly string[], permitidas: readonly string[]): { opciones: Map<string, string>; sueltos: string[] } {
  const opciones = new Map<string, string>();
  const sueltos: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (!a.startsWith("--")) {
      sueltos.push(a);
      continue;
    }
    if (!permitidas.includes(a)) throw new ErrorArgumentosAv("OPCION_DESCONOCIDA");
    if (opciones.has(a)) throw new ErrorArgumentosAv("OPCION_REPETIDA");
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith("--")) throw new ErrorArgumentosAv("VALOR_FALTANTE");
    opciones.set(a, valor);
    i += 1;
  }
  return { opciones, sueltos };
}

function fechaCorte(texto: string | undefined): Date {
  if (texto === undefined) throw new ErrorArgumentosAv("FECHA_CORTE_OBLIGATORIA");
  const r = leerFechaIso(texto);
  if (!r.ok) throw new ErrorArgumentosAv("FECHA_CORTE_INVALIDA");
  return r.valor;
}

export function leerArgumentosImportar(argv: readonly string[]): ArgumentosImportarCertificacion {
  const { opciones, sueltos } = separar(argv, ["--email", "--fecha-corte", "--fondo"]);
  const email = opciones.get("--email");
  if (email === undefined || !EMAIL.test(email)) throw new ErrorArgumentosAv("EMAIL_INVALIDO");
  const fecha = fechaCorte(opciones.get("--fecha-corte"));
  const fondo = opciones.get("--fondo") ?? null;
  if (fondo !== null && !CODIGO_FIC_RE.test(fondo)) throw new ErrorArgumentosAv("FONDO_INVALIDO");
  if (sueltos.length !== 1) throw new ErrorArgumentosAv(sueltos.length === 0 ? "ARCHIVO_FALTANTE" : "UN_SOLO_ARCHIVO");
  if (!sueltos[0]!.toLowerCase().endsWith(".pdf")) throw new ErrorArgumentosAv("ARCHIVO_NO_PDF");
  return { email, fechaCorte: fecha, fondo, archivo: sueltos[0]! };
}

export function leerArgumentosConciliar(argv: readonly string[]): ArgumentosConciliar {
  const { opciones, sueltos } = separar(argv, ["--fecha-corte"]);
  if (sueltos.length > 0) throw new ErrorArgumentosAv("ARGUMENTO_DESCONOCIDO");
  return { fechaCorte: fechaCorte(opciones.get("--fecha-corte")) };
}
