/**
 * Lector CSV mínimo (RFC 4180): comas, comillas dobles, comillas escapadas ("") y saltos de
 * línea dentro de comillas. Quita el BOM UTF-8 y las líneas vacías del final.
 * Devuelve filas como arreglos de texto, sin interpretar valores.
 */
export class ErrorCsv extends Error {
  constructor(readonly codigo: "COMILLA_SIN_CERRAR") {
    super(codigo);
    this.name = "ErrorCsv";
  }
}

export function leerCsv(texto: string): string[][] {
  const contenido = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;

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
    if (c === '"') {
      enComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && contenido[i + 1] === "\n") i += 1;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (enComillas) throw new ErrorCsv("COMILLA_SIN_CERRAR");
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return quitarVaciasDelFinal(filas);
}

function quitarVaciasDelFinal(filas: string[][]): string[][] {
  let fin = filas.length;
  while (fin > 0 && filas[fin - 1]!.every((v) => v.trim() === "")) fin -= 1;
  return filas.slice(0, fin);
}
