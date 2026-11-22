/**
 * Salidas de los dos CLI de escisión (scripts/registrar-escision.ts y scripts/lote-escision.ts) con un solo
 * criterio (O2). Puro: arma las líneas y el código de salida; `emitir` las escribe.
 *   0 registrado: el id interno y el siguiente paso.
 *   1 rechazado: «❌ No se registró: CÓDIGO[ (campo)] · qué significa y qué hacer»; o un error de la base (ERROR_BASE
 *     y la clase), que no promete nada: un fallo al confirmar la transacción pudo dejar el registro hecho.
 *   2 argumentos o datos inválidos, antes de abrir la base: «campo · CÓDIGO».
 *   3 (solo registrar-escision) registrado, pero hay dividendos ya importados como ordinarios: sin siguiente paso.
 * En producción, toda salida distinta de 0 termina con «Vía B: pare la carga y avise al CEO de 008» (§11: si un paso
 * no sale bien, se para y se avisa), y ningún texto invita a corregir por su cuenta (--crear-destino, revertir).
 * Nunca un dato del evento ni del lote (nemotécnicos, fechas, cantidades, costos, notas) ni el mensaje de un error
 * (el de Prisma lleva el host y el puerto de la base): solo ids internos, conteos, nombres de campo, códigos y
 * texto fijo. En producción (NODE_ENV=production, la imagen del migrador) los pasos son los de la vía B
 * (`cargar-prod.sh`, docs/despliegue/produccion.md §11); en local, los de `npm run`.
 */
import { ErrorEvento, type CampoInstrumento, type CodigoEvento, type ErrorCampo, type ResultadoEscision } from "../eventos/escision";
import { ErrorLote, type CodigoLote } from "../lotes/escision";

export interface SalidaCli {
  readonly codigoSalida: 0 | 1 | 2 | 3;
  /** Por stdout. */
  readonly lineas: readonly string[];
  /** Por stderr. */
  readonly errores: readonly string[];
}

export interface OpcionesSalida {
  /** NODE_ENV=production: los pasos van por cargar-prod.sh (vía B). */
  readonly produccion: boolean;
}

export interface Consola {
  readonly log: (linea: string) => void;
  readonly error: (linea: string) => void;
}

export const OPCIONES_REGISTRAR = "--origen --destino --fecha [--razon] [--pago-fraccion] [--monto-fraccion] [--nota] [--crear-destino]";
export const OPCIONES_LOTE = "--destino --fecha-evento --cantidad --costo-unitario";

interface Comandos {
  readonly registrar: string;
  readonly dividendos: string;
  readonly lote: string;
  readonly construir: string;
}

const COMANDOS_LOCAL: Comandos = {
  registrar: "`npm run escision:registrar -- …`",
  dividendos: "`npm run importar:trii -- --email <correo> <dividendos.csv>`",
  lote: "`npm run lote:escision -- …`",
  construir: "`npm run lotes:construir`",
};

const COMANDOS_PRODUCCION: Comandos = {
  registrar: "`cargar-prod.sh registrar-escision`",
  dividendos: "`cargar-prod.sh importar-trii` y el CSV de dividendos",
  lote: "`cargar-prod.sh lote-escision`",
  construir: "`cargar-prod.sh construir-lotes`",
};

const PARE_VIA_B = "⚠️  Vía B: pare la carga y avise al CEO de 008 (§11 del runbook).";

const comandos = (o: OpcionesSalida): Comandos => (o.produccion ? COMANDOS_PRODUCCION : COMANDOS_LOCAL);
const siguientePaso = (o: OpcionesSalida, texto: string): string =>
  `➡️  Siguiente paso${o.produccion ? " (vía B, §11 del runbook)" : ""}: ${texto}`;

const exito = (lineas: readonly string[]): SalidaCli => ({ codigoSalida: 0, lineas, errores: [] });

/** Un fallo (1 o 2 por stderr; 3 por stdout, tras su aviso). En producción, su última línea pide parar la carga. */
function fallo(o: OpcionesSalida, codigoSalida: 1 | 2 | 3, textos: readonly string[]): SalidaCli {
  const conPare = o.produccion ? [...textos, PARE_VIA_B] : textos;
  return codigoSalida === 3 ? { codigoSalida, lineas: conPare, errores: [] } : { codigoSalida, lineas: [], errores: conPare };
}

export function salidaArgumentosInvalidos(opciones: string, o: OpcionesSalida): SalidaCli {
  return fallo(o, 2, [`❌ Argumentos inválidos. Opciones: ${opciones}`]);
}

export function salidaDatosInvalidos(errores: readonly ErrorCampo[], o: OpcionesSalida): SalidaCli {
  return fallo(o, 2, ["❌ Datos inválidos, no se registró nada:", ...errores.map((e) => `   ${e.campo} · ${e.codigo}`)]);
}

export function salidaEventoRegistrado(r: ResultadoEscision, o: OpcionesSalida): SalidaCli {
  const registrado = `✅ Evento de escisión registrado (${r.eventoId})${r.destinoCreado ? "; se creó la especie destino" : ""}.`;
  if (r.dividendosYaImportados > 0) {
    // En la vía B se para y se avisa: el aviso no invita a revertir por su cuenta.
    const queHacer = o.produccion ? "no revierta nada por su cuenta" : "hay que revertir esa carga y volver a importarla";
    return fallo(o, 3, [registrado, `⚠️  Ya hay ${r.dividendosYaImportados} dividendo(s) importado(s) como ordinario(s) en la fecha del pago de la fracción: ${queHacer}.`]);
  }
  const c = comandos(o);
  return exito([registrado, siguientePaso(o, `registre las demás escisiones, si las hay (${c.registrar}), y después cargue los dividendos con ${c.dividendos}.`)]);
}

export function salidaLoteRegistrado(r: { readonly loteId: string }, o: OpcionesSalida): SalidaCli {
  const c = comandos(o);
  return exito([
    `✅ Lote de escisión registrado (${r.loteId}).`,
    siguientePaso(o, `registre los demás lotes de escisión, si los hay (${c.lote}), y después recalcule las ventas con ${c.construir}.`),
  ]);
}

type CodigoConSignificado = CodigoEvento | Exclude<CodigoLote, `DATOS_INVALIDOS:${string}`>;

const INSTRUMENTO_DESCONOCIDO: Readonly<Record<CampoInstrumento | "ninguno", string>> = {
  origen: "la especie origen no está registrada (llega con las órdenes importadas): revise --origen",
  destino: "la especie destino no está registrada: revise --destino; si solo le llegó por la escisión (no está en ninguna orden), repita con --crear-destino",
  ninguno: "la especie origen o la destino no está registrada: revise --origen y --destino",
};
/** En la vía B un destino mal escrito con --crear-destino crearía una especie falsa: eso lo confirma el CEO de 008. */
const DESTINO_DESCONOCIDO_VIA_B =
  "la especie destino no está registrada: revise --destino; --crear-destino va solo si el CEO de 008 confirma que la especie solo llegó por la escisión";

/** Qué significa cada rechazo y qué hacer; un código nuevo sin su significado no compila. */
const SIGNIFICADO: Readonly<Record<CodigoConSignificado, (o: OpcionesSalida, campo: CampoInstrumento | undefined) => string>> = {
  INSTRUMENTO_DESCONOCIDO: (o, campo) => (campo === "destino" && o.produccion ? DESTINO_DESCONOCIDO_VIA_B : INSTRUMENTO_DESCONOCIDO[campo ?? "ninguno"]),
  EVENTO_DUPLICADO: () => "ese evento ya estaba registrado y no se registró otra vez (un evento registrado no se corrige con este comando)",
  PAGO_FRACCION_DUPLICADO: () => "ese pago de fracción ya es de otro evento: no se registró nada",
  EVENTO_NO_ENCONTRADO: (o) => `no hay un evento de escisión con ese destino en esa fecha: revise --destino y --fecha-evento, o registre antes el evento (${comandos(o).registrar})`,
  EVENTO_AMBIGUO: () => "hay más de un evento de escisión con ese destino en esa fecha: este comando no elige uno (hay que revisar los eventos registrados)",
  LOTE_YA_REGISTRADO: () => "ese evento ya tiene su lote de escisión y no se registró otro",
  SIN_LOTE_MADRE: (o) => `la especie origen no tiene un lote vivo en la fecha del evento: construya antes los lotes (${comandos(o).construir}) o revise --fecha-evento`,
};

const conSignificado = (codigo: string): codigo is CodigoConSignificado => Object.hasOwn(SIGNIFICADO, codigo);

/** La clase del error si tiene forma de nombre de clase; si no, «error» (un nombre armado con datos no se imprime). */
const NOMBRE_DE_CLASE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const claseDe = (e: unknown): string => (e instanceof Error && NOMBRE_DE_CLASE.test(e.name) ? e.name : "error");

/**
 * El registro falló. Un rechazo del dominio ocurre dentro de la transacción (no quedó nada): su código y qué hacer.
 * Cualquier otro error es ERROR_BASE y la clase, sin prometer que no se registró.
 */
export function salidaRechazo(e: unknown, o: OpcionesSalida): SalidaCli {
  if (!(e instanceof ErrorEvento || e instanceof ErrorLote)) {
    return fallo(o, 1, [`❌ No se pudo confirmar el registro: ERROR_BASE · ${claseDe(e)}.${o.produccion ? "" : " Revíselo antes de repetir."}`]);
  }
  const campo = e instanceof ErrorEvento ? e.campo : undefined;
  const significado = conSignificado(e.codigo) ? ` · ${SIGNIFICADO[e.codigo](o, campo)}.` : "";
  return fallo(o, 1, [`❌ No se registró: ${e.codigo}${campo ? ` (${campo})` : ""}${significado}`]);
}

/** Un error fuera del registro (p. ej. al cerrar la conexión): no se sabe si quedó registrado, así que no lo promete. */
export function salidaInesperada(e: unknown, o: OpcionesSalida): SalidaCli {
  return fallo(o, 1, [`❌ Error inesperado: ${claseDe(e)}. No se pudo confirmar si quedó registrado${o.produccion ? "." : ": revíselo antes de repetir."}`]);
}

/** Escribe las líneas (stdout) y los errores (stderr), en ese orden, y devuelve el código de salida. */
export function emitir(s: SalidaCli, consola: Consola): number {
  for (const linea of s.lineas) consola.log(linea);
  for (const linea of s.errores) consola.error(linea);
  return s.codigoSalida;
}
