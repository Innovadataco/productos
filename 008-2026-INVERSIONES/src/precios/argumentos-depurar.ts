/** Argumentos de scripts/depurar-precios.ts (SPEC-13). Sin --aplicar es un ensayo: solo cuenta. */
import { leerFechaIso } from "../importacion/trii/valores";

export const USO_DEPURAR = [
  "Uso: npm run precios:depurar -- --desde AAAA-MM-DD [--hasta AAAA-MM-DD] [--aplicar --base <nombre-de-la-base>]",
  "  Retira (reemplazadoEn, sin sucesor; nada se borra) los cierres vigentes de Yahoo de días no hábiles",
  "  (calendario_bvc) o sin negociación (Yahoo trae volumen 0). Sin --aplicar es un ensayo: solo conteos.",
  "  Para escribir, --base debe ser el nombre de la base conectada (DATABASE_URL). --hasta por defecto: hoy.",
  "  Aplíquelo solo cuando el arreglo esté desplegado donde corran las cargas de precios (si no, el código",
  "  viejo vuelve a guardarlos), y córralo dos veces: la segunda debe dar 0 retirados.",
].join("\n");

export interface ArgumentosDepurar {
  readonly desde: Date;
  readonly hasta: Date;
  readonly aplicar: boolean;
  readonly base: string | undefined;
}

export class ErrorArgumentosDepurar extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorArgumentosDepurar";
  }
}

const OPCIONES = ["--desde", "--hasta", "--aplicar", "--base"] as const;
const CON_VALOR = new Set<string>(["--desde", "--hasta", "--base"]);
const NOMBRE_BASE = /^[a-z0-9_]+$/;

function valorDe(argv: readonly string[], i: number, opcion: string): string {
  const valor = argv[i + 1];
  if (valor === undefined || valor.startsWith("--")) throw new ErrorArgumentosDepurar(`${opcion} necesita un valor.`);
  return valor;
}

function fecha(texto: string | undefined, opcion: string): Date | undefined {
  if (texto === undefined) return undefined;
  const r = leerFechaIso(texto);
  if (!r.ok) throw new ErrorArgumentosDepurar(`${opcion} debe ser una fecha válida AAAA-MM-DD.`);
  return r.valor;
}

/** Lee las opciones; `hoy` es la fecha de negocio en Colombia (tope y valor por defecto de --hasta). */
export function leerArgumentosDepurar(argv: readonly string[], hoy: Date): ArgumentosDepurar {
  const valores = new Map<string, string>();
  const vistas = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const opcion = argv[i]!;
    if (!(OPCIONES as readonly string[]).includes(opcion)) throw new ErrorArgumentosDepurar(`Opción desconocida: «${opcion}».`);
    if (vistas.has(opcion)) throw new ErrorArgumentosDepurar(`${opcion} está repetida.`);
    vistas.add(opcion);
    if (CON_VALOR.has(opcion)) {
      valores.set(opcion, valorDe(argv, i, opcion));
      i += 1;
    }
  }
  const desde = fecha(valores.get("--desde"), "--desde");
  if (!desde) throw new ErrorArgumentosDepurar("Falta --desde AAAA-MM-DD.");
  const hasta = fecha(valores.get("--hasta"), "--hasta") ?? hoy;
  if (desde > hasta || hasta > hoy) throw new ErrorArgumentosDepurar("Rango inválido: --desde ≤ --hasta ≤ hoy.");
  const base = valores.get("--base");
  if (base !== undefined && !NOMBRE_BASE.test(base)) throw new ErrorArgumentosDepurar("--base solo admite minúsculas, dígitos y «_».");
  const aplicar = vistas.has("--aplicar");
  if (aplicar && base === undefined) throw new ErrorArgumentosDepurar("Para escribir hay que nombrar la base con --base <nombre>.");
  return { desde, hasta, aplicar, base };
}
