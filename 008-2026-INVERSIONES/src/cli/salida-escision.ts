/**
 * Salidas de los dos CLI de escisión (scripts/registrar-escision.ts y scripts/lote-escision.ts) con un solo
 * criterio (O2). Puro: arma las líneas y el código de salida; `emitir` las escribe.
 *   0 registrado: el id interno y el siguiente paso.
 *   1 rechazado o error: «❌ No se registró: CÓDIGO[ (campo)] · qué significa y qué hacer», o ERROR_BASE y la clase.
 *   2 argumentos o datos inválidos, antes de abrir la base: «campo · CÓDIGO».
 *   3 (solo registrar-escision) registrado, pero hay dividendos ya importados como ordinarios: sin siguiente paso.
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

const PARE_VIA_B = "pare la carga y avise al CEO de 008 (§11 del runbook)";

const comandos = (o: OpcionesSalida): Comandos => (o.produccion ? COMANDOS_PRODUCCION : COMANDOS_LOCAL);
const siguientePaso = (o: OpcionesSalida, texto: string): string =>
  `➡️  Siguiente paso${o.produccion ? " (vía B, §11 del runbook)" : ""}: ${texto}`;

const salida = (codigoSalida: SalidaCli["codigoSalida"], lineas: readonly string[], errores: readonly string[] = []): SalidaCli => ({ codigoSalida, lineas, errores });

export function salidaArgumentosInvalidos(opciones: string): SalidaCli {
  return salida(2, [], [`❌ Argumentos inválidos. Opciones: ${opciones}`]);
}

export function salidaDatosInvalidos(errores: readonly ErrorCampo[]): SalidaCli {
  return salida(2, [], ["❌ Datos inválidos, no se registró nada:", ...errores.map((e) => `   ${e.campo} · ${e.codigo}`)]);
}

export function salidaEventoRegistrado(r: ResultadoEscision, o: OpcionesSalida): SalidaCli {
  const registrado = `✅ Evento de escisión registrado (${r.eventoId})${r.destinoCreado ? "; se creó la especie destino" : ""}.`;
  if (r.dividendosYaImportados > 0) {
    const aviso = `⚠️  Ya hay ${r.dividendosYaImportados} dividendo(s) importado(s) como ordinario(s) en la fecha del pago de la fracción: hay que revertir esa carga y volver a importarla.`;
    return salida(3, [registrado, aviso, ...(o.produccion ? [`⚠️  Vía B: ${PARE_VIA_B}.`] : [])]);
  }
  const c = comandos(o);
  return salida(0, [registrado, siguientePaso(o, `registre las demás escisiones, si las hay (${c.registrar}), y después cargue los dividendos con ${c.dividendos}.`)]);
}

export function salidaLoteRegistrado(r: { readonly loteId: string }, o: OpcionesSalida): SalidaCli {
  const c = comandos(o);
  return salida(0, [
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

/** Qué significa cada rechazo y qué hacer; un código nuevo sin su significado no compila. */
const SIGNIFICADO: Readonly<Record<CodigoConSignificado, (c: Comandos, campo: CampoInstrumento | undefined) => string>> = {
  INSTRUMENTO_DESCONOCIDO: (_c, campo) => INSTRUMENTO_DESCONOCIDO[campo ?? "ninguno"],
  EVENTO_DUPLICADO: () => "ese evento ya estaba registrado y no se registró otra vez (un evento registrado no se corrige con este comando)",
  PAGO_FRACCION_DUPLICADO: () => "ese pago de fracción ya es de otro evento: no se registró nada",
  EVENTO_NO_ENCONTRADO: (c) => `no hay un evento de escisión con ese destino en esa fecha: revise --destino y --fecha-evento, o registre antes el evento (${c.registrar})`,
  EVENTO_AMBIGUO: () => "hay más de un evento de escisión con ese destino en esa fecha: este comando no elige uno; avise",
  LOTE_YA_REGISTRADO: () => "ese evento ya tiene su lote de escisión y no se registró otro",
  SIN_LOTE_MADRE: (c) => `la especie origen no tiene un lote vivo en la fecha del evento: construya antes los lotes (${c.construir}) o revise --fecha-evento`,
};

const conSignificado = (codigo: string): codigo is CodigoConSignificado => Object.hasOwn(SIGNIFICADO, codigo);

/** La clase del error si tiene forma de nombre de clase; si no, «error» (un nombre armado con datos no se imprime). */
const NOMBRE_DE_CLASE = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;
const claseDe = (e: unknown): string => (e instanceof Error && NOMBRE_DE_CLASE.test(e.name) ? e.name : "error");

/** El registro falló dentro de su transacción (no quedó nada): el código del dominio o ERROR_BASE y la clase. */
export function salidaRechazo(e: unknown, o: OpcionesSalida): SalidaCli {
  if (!(e instanceof ErrorEvento || e instanceof ErrorLote)) return salida(1, [], [`❌ No se registró: ERROR_BASE · ${claseDe(e)}`]);
  const campo = e instanceof ErrorEvento ? e.campo : undefined;
  const significado = conSignificado(e.codigo) ? ` · ${SIGNIFICADO[e.codigo](comandos(o), campo)}.` : "";
  return salida(1, [], [`❌ No se registró: ${e.codigo}${campo ? ` (${campo})` : ""}${significado}`]);
}

/** Un error fuera del registro (p. ej. al cerrar la conexión): no se sabe si quedó registrado, así que no lo promete. */
export function salidaInesperada(e: unknown, o: OpcionesSalida): SalidaCli {
  const accion = o.produccion ? PARE_VIA_B : "revíselo antes de repetir";
  return salida(1, [], [`❌ Error inesperado: ${claseDe(e)}. No se pudo confirmar si quedó registrado: ${accion}.`]);
}

/** Escribe las líneas (stdout) y los errores (stderr), en ese orden, y devuelve el código de salida. */
export function emitir(s: SalidaCli, consola: Consola): number {
  for (const linea of s.lineas) consola.log(linea);
  for (const linea of s.errores) consola.error(linea);
  return s.codigoSalida;
}
