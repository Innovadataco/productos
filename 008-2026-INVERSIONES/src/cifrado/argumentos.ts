/** Argumentos de scripts/cifrar-existentes.ts (#11). Sin opciones es un ensayo: solo cuenta. */
export const LOTE_POR_DEFECTO = 500;
export const LOTE_MAXIMO = 5000;
export const USO = [
  "Uso: npx tsx scripts/cifrar-existentes.ts [--aplicar] [--re-cifrar] [--base <nombre-de-la-base>] [--lote <1-5000>]",
  "  sin opciones: ensayo, solo conteos · --aplicar: cifra lo que está en claro · --re-cifrar: pasa a la versión",
  "  activa los sobres de otra versión · para escribir, --base debe ser el nombre de la base conectada (DATABASE_URL).",
  "  Córralo con los importadores detenidos y dos veces: la segunda debe dar 0 cambios.",
  `  Lote por defecto: ${LOTE_POR_DEFECTO}; si el crudo es grande, use uno más chico.`,
  "  Al terminar se recomienda VACUUM (ANALYZE) fila_fuente; y VACUUM (ANALYZE) certificacion_fondo;",
].join("\n");

export interface Argumentos {
  readonly aplicar: boolean;
  readonly reCifrar: boolean;
  readonly base: string | undefined;
  readonly lote: number;
}

export class ErrorArgumentos extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorArgumentos";
  }
}

const NOMBRE_BASE = /^[a-z0-9_]+$/;
const ENTERO = /^[1-9][0-9]*$/;

function valorDe(argv: readonly string[], i: number, opcion: string): string {
  const valor = argv[i + 1];
  if (valor === undefined || valor.startsWith("--")) throw new ErrorArgumentos(`${opcion} necesita un valor.`);
  return valor;
}

export function leerArgumentos(argv: readonly string[]): Argumentos {
  const vistas = new Set<string>();
  let base: string | undefined;
  let lote = LOTE_POR_DEFECTO;
  for (let i = 0; i < argv.length; i += 1) {
    const opcion = argv[i]!;
    if (!["--aplicar", "--re-cifrar", "--base", "--lote"].includes(opcion)) throw new ErrorArgumentos(`Opción desconocida: «${opcion}».`);
    if (vistas.has(opcion)) throw new ErrorArgumentos(`${opcion} está repetida.`);
    vistas.add(opcion);
    if (opcion === "--base") {
      base = valorDe(argv, i, opcion);
      if (!NOMBRE_BASE.test(base)) throw new ErrorArgumentos("--base solo admite minúsculas, dígitos y «_».");
      i += 1;
    } else if (opcion === "--lote") {
      const valor = valorDe(argv, i, opcion);
      if (!ENTERO.test(valor) || Number(valor) > LOTE_MAXIMO) throw new ErrorArgumentos(`--lote debe ser un entero entre 1 y ${LOTE_MAXIMO}.`);
      lote = Number(valor);
      i += 1;
    }
  }
  const aplicar = vistas.has("--aplicar");
  const reCifrar = vistas.has("--re-cifrar");
  if ((aplicar || reCifrar) && base === undefined) throw new ErrorArgumentos("Para escribir hay que nombrar la base con --base <nombre>.");
  return { aplicar, reCifrar, base, lote };
}
