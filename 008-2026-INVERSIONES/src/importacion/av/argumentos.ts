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

/** corregir-corte-certificacion: el corte con que se cargó, el corte real y el MISMO PDF. */
export interface ArgumentosCorregirCorte {
  readonly email: string;
  readonly fechaCorte: Date;
  readonly nuevaFechaCorte: Date;
  readonly archivo: string;
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

/** Una fecha obligatoria AAAA-MM-DD; los códigos llevan el prefijo de la opción (FECHA_CORTE, NUEVA_FECHA_CORTE). */
function fechaCorte(texto: string | undefined, prefijo = "FECHA_CORTE"): Date {
  if (texto === undefined) throw new ErrorArgumentosAv(`${prefijo}_OBLIGATORIA`);
  const r = leerFechaIso(texto);
  if (!r.ok) throw new ErrorArgumentosAv(`${prefijo}_INVALIDA`);
  return r.valor;
}

const correo = (email: string | undefined): string => {
  if (email === undefined || !EMAIL.test(email)) throw new ErrorArgumentosAv("EMAIL_INVALIDO");
  return email;
};

/** Exactamente un argumento suelto, y que sea un .pdf. */
function unPdf(sueltos: readonly string[]): string {
  if (sueltos.length !== 1) throw new ErrorArgumentosAv(sueltos.length === 0 ? "ARCHIVO_FALTANTE" : "UN_SOLO_ARCHIVO");
  if (!sueltos[0]!.toLowerCase().endsWith(".pdf")) throw new ErrorArgumentosAv("ARCHIVO_NO_PDF");
  return sueltos[0]!;
}

export function leerArgumentosImportar(argv: readonly string[]): ArgumentosImportarCertificacion {
  const { opciones, sueltos } = separar(argv, ["--email", "--fecha-corte", "--fondo"]);
  const email = correo(opciones.get("--email"));
  const fecha = fechaCorte(opciones.get("--fecha-corte"));
  const fondo = opciones.get("--fondo") ?? null;
  if (fondo !== null && !CODIGO_FIC_RE.test(fondo)) throw new ErrorArgumentosAv("FONDO_INVALIDO");
  return { email, fechaCorte: fecha, fondo, archivo: unPdf(sueltos) };
}

/** Sin --fondo: el NIT del fondo ya quedó vinculado cuando se importó con el corte equivocado. */
export function leerArgumentosCorregir(argv: readonly string[]): ArgumentosCorregirCorte {
  const { opciones, sueltos } = separar(argv, ["--email", "--fecha-corte", "--nueva-fecha-corte"]);
  const email = correo(opciones.get("--email"));
  const fecha = fechaCorte(opciones.get("--fecha-corte"));
  const nueva = fechaCorte(opciones.get("--nueva-fecha-corte"), "NUEVA_FECHA_CORTE");
  if (fecha.getTime() === nueva.getTime()) throw new ErrorArgumentosAv("MISMA_FECHA");
  return { email, fechaCorte: fecha, nuevaFechaCorte: nueva, archivo: unPdf(sueltos) };
}

export function leerArgumentosConciliar(argv: readonly string[]): ArgumentosConciliar {
  const { opciones, sueltos } = separar(argv, ["--fecha-corte"]);
  if (sueltos.length > 0) throw new ErrorArgumentosAv("ARGUMENTO_DESCONOCIDO");
  return { fechaCorte: fechaCorte(opciones.get("--fecha-corte")) };
}
