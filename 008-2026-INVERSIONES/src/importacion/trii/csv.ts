/**
 * Lector CSV mínimo (RFC 4180): comas, comillas dobles, comillas escapadas ("") y saltos de
 * línea dentro de comillas. Quita el BOM UTF-8. Devuelve los registros con su texto, sin interpretar valores,
 * y con su número en el archivo (el encabezado es el 1): la trazabilidad de filas y errores (O4).
 * - Una línea totalmente vacía (cero caracteres entre dos saltos, fuera de comillas) se omite en cualquier
 *   posición, pero cuenta para la numeración. «,,,», «   » y «""» NO son vacías: se conservan.
 * - Al final del archivo se quitan además los registros en blanco (todas sus celdas en blanco: también «,,,» y
 *   «   »), como antes. Asimetría a propósito (decisión G7): en medio, esos registros los rechaza quien los
 *   interpreta.
 * El número es el del registro, no el de la línea física: un salto dentro de comillas no suma.
 */
export class ErrorCsv extends Error {
  constructor(readonly codigo: "COMILLA_SIN_CERRAR") {
    super(codigo);
    this.name = "ErrorCsv";
  }
}

export interface RegistroCsv {
  /** Número del registro en el archivo, contando el encabezado como 1 y las líneas vacías omitidas. */
  readonly numero: number;
  readonly celdas: readonly string[];
}

export function leerCsv(texto: string): RegistroCsv[] {
  const contenido = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const registros: RegistroCsv[] = [];
  let numero = 1;
  let celdas: string[] = [];
  let campo = "";
  let conTexto = false; // si el registro en curso tuvo algún carácter (comillas y comas incluidas)
  let enComillas = false;
  /** Cierra el registro en curso: si no tuvo ningún carácter es una línea vacía y solo suma a la numeración. */
  const cerrar = (): void => {
    if (conTexto) registros.push({ numero, celdas: [...celdas, campo] });
    numero += 1;
    celdas = [];
    campo = "";
    conTexto = false;
  };

  for (let i = 0; i < contenido.length; i += 1) {
    const c = contenido[i];
    if (enComillas) {
      if (c === '"' && contenido[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else if (c === '"') {
        enComillas = false;
      } else {
        campo += c;
      }
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && contenido[i + 1] === "\n") i += 1;
      cerrar();
      continue;
    }
    conTexto = true;
    if (c === '"') {
      enComillas = true;
    } else if (c === ",") {
      celdas.push(campo);
      campo = "";
    } else {
      campo += c;
    }
  }
  if (enComillas) throw new ErrorCsv("COMILLA_SIN_CERRAR");
  if (conTexto) cerrar();
  return quitarEnBlancoDelFinal(registros);
}

function quitarEnBlancoDelFinal(registros: readonly RegistroCsv[]): RegistroCsv[] {
  let fin = registros.length;
  while (fin > 0 && registros[fin - 1]!.celdas.every((v) => v.trim() === "")) fin -= 1;
  return registros.slice(0, fin);
}
