/**
 * Lo que imprime scripts/registrar-movimiento-fondo.ts (frentes fondo-movimientos y fondo-movimientos-via-b): ids internos
 * y códigos, nunca las cifras, el correo ni el código del fondo (son datos reales), ni el mensaje de un error (el de
 * Prisma lleva el host de la base). Puro: arma el código de salida y las líneas; `emitir` las escribe.
 *   0 ensayo, registrada o ya existía (stdout) · 1 error de la base o inesperado · 2 datos inválidos · 3 rechazado.
 * Cada rechazo dice su código y qué revisar; si el contraste con el valor de unidad falla, qué mirar en el extracto: el
 * día y el valor de unidad (decisión de la Fábrica: se niega siempre, sin opción para seguir).
 * En producción (NODE_ENV=production, la imagen del migrador) los pasos son los de la vía B (`cargar-prod.sh`, §11 del
 * runbook) y todo fallo termina con «pare la carga y avise al CEO de 008»: ningún texto invita a repetir por su cuenta.
 * Nunca recomienda comprar ni vender.
 */
import { detalleDeError } from "../precios/guardar";
import { PARE_VIA_B } from "../cli/via-b";
import { USO_MOVIMIENTO } from "./argumentos-movimiento";
import type { CodigoRechazo, ErrorCampo, ResultadoConstitucion } from "./movimiento";

export interface OpcionesSalida {
  /** NODE_ENV=production: el CLI corre por `cargar-prod.sh registrar-movimiento-fondo` (vía B). */
  readonly produccion: boolean;
}

export interface SalidaCli {
  readonly codigoSalida: 0 | 1 | 2 | 3;
  /** Por stdout. */
  readonly lineas: readonly string[];
  /** Por stderr. */
  readonly errores: readonly string[];
}

export interface Consola {
  readonly log: (linea: string) => void;
  readonly error: (linea: string) => void;
}

const LOCAL: OpcionesSalida = { produccion: false };

const USO_VIA_B = [
  "Uso (vía B, §11 del runbook): la cabecera privada del sobre lleva, una por línea, --email y el correo del dueño,",
  "  --fondo y el código del fondo en la SFC, --fecha y AAAA-MM-DD, --unidades y <n>, --monto y <n> (punto decimal, sin",
  "  miles), y --aplicar para escribir (sin él, ensayo):",
  "  scripts/armar-sobre.sh <cabecera> | ssh <vps> <raíz>/repo/008-2026-INVERSIONES/scripts/cargar-prod.sh registrar-movimiento-fondo",
  "  Salida: 0 bien · 1 error de la base · 2 uso · 3 rechazado (no escribió nada).",
].join("\n");

const REGISTRAR_FONDO = (o: OpcionesSalida) =>
  o.produccion ? "`cargar-prod.sh registrar-fondo`" : "`npx tsx scripts/actualizar-fondo.ts --registrar --codigo … --nombre …`";
const CARGAR_VALORES = (o: OpcionesSalida) =>
  o.produccion
    ? "`fondo:exportar --desde <ese día>` en el Mac y `cargar-prod.sh importar-valores-fondo`"
    : "`npx tsx scripts/actualizar-fondo.ts --desde <ese día>`";

const QUE_REVISAR: Readonly<Record<CodigoRechazo, (o: OpcionesSalida) => string>> = {
  USUARIO_NO_AUTORIZADO: () => "el correo no es el de un dueño activo.",
  FONDO_NO_REGISTRADO: (o) => `ese código no es un fondo (FIC) registrado: regístrelo primero (${REGISTRAR_FONDO(o)}).`,
  FONDO_INACTIVO: () => "el fondo está inactivo.",
  CONSTITUCION_DISTINTA: () =>
    "el fondo ya tiene una constitución con otro día, otras unidades u otro monto. No se cambia: la corrección será un ajuste aparte.",
  MOVIMIENTO_ANTES_DE_LA_CONSTITUCION: () => "el fondo ya tiene movimientos anteriores a ese día: revise en el extracto el día de la constitución.",
  SIN_VALOR_UNIDAD_DEL_DIA: (o) =>
    `falta el valor de unidad de la SFC de ese día (nunca se usa el de otro día): revise en el extracto el día de la constitución y cargue los valores del fondo desde ese día (${CARGAR_VALORES(o)}).`,
  MONTO_NO_CUADRA_CON_VALOR_UNIDAD: () =>
    "el monto no es unidades × valor de unidad de la SFC de ese día (±0,5 %): revise en el extracto el día y el valor de unidad con que se asignaron las unidades.",
  REGISTRO_EN_CONFLICTO: (o) => `otro registro del mismo fondo chocó con este${o.produccion ? "." : ": vuelva a intentarlo."}`,
};

export function textoRechazo(codigo: CodigoRechazo, o: OpcionesSalida = LOCAL): string {
  return `❌ No se registró: ${codigo} · ${QUE_REVISAR[codigo](o)}`;
}

export function textoResultado(r: ResultadoConstitucion, o: OpcionesSalida = LOCAL): string {
  switch (r.estado) {
    case "ENSAYO":
      return o.produccion
        ? `🔎 Ensayo: la constitución del fondo ${r.fondoId} cuadra con el valor de unidad de la SFC de ese día. No se escribió nada: para registrarla, repita \`cargar-prod.sh registrar-movimiento-fondo\` con --aplicar en la cabecera del sobre.`
        : `🔎 Ensayo: la constitución del fondo ${r.fondoId} cuadra con el valor de unidad de la SFC de ese día. No se escribió nada: para registrarla, repita con --aplicar.`;
    case "REGISTRADA": {
      const siguiente = o.produccion
        ? "Siguiente paso (vía B, §11 del runbook): los precios si faltan y `cargar-prod.sh conciliar-certificacion`."
        : "Siguiente paso: `npx tsx scripts/conciliar-certificacion.ts --fecha-corte <corte>`.";
      return `✅ Constitución del fondo registrada (fondo ${r.fondoId} · movimiento ${r.movimientoId} · ajuste de caja ${r.ajusteId}). ${siguiente}`;
    }
    case "YA_EXISTIA":
      return `✅ La constitución del fondo ${r.fondoId} ya estaba registrada con esos datos (movimiento ${r.movimientoId}): no se escribió nada.`;
  }
}

/** Un fallo por stderr; en producción, su última línea pide parar la carga. */
function fallo(o: OpcionesSalida, codigoSalida: 1 | 2 | 3, textos: readonly string[]): SalidaCli {
  return { codigoSalida, lineas: [], errores: o.produccion ? [...textos, PARE_VIA_B] : textos };
}

export function salidaResultado(r: ResultadoConstitucion, o: OpcionesSalida): SalidaCli {
  return { codigoSalida: 0, lineas: [textoResultado(r, o)], errores: [] };
}

export function salidaDatosInvalidos(errores: readonly ErrorCampo[], o: OpcionesSalida): SalidaCli {
  return fallo(o, 2, ["❌ Datos inválidos, no se registró nada:", ...errores.map((e) => `   ${e.campo} · ${e.codigo}`), o.produccion ? USO_VIA_B : USO_MOVIMIENTO]);
}

export function salidaRechazo(codigo: CodigoRechazo, o: OpcionesSalida): SalidaCli {
  return fallo(o, 3, [textoRechazo(codigo, o)]);
}

/** Un fallo al confirmar la transacción pudo dejarla registrada: no se promete «no se registró». */
export function salidaErrorBase(e: unknown, o: OpcionesSalida): SalidaCli {
  return fallo(o, 1, [`❌ No se pudo confirmar el registro: ERROR_BASE (${detalleDeError(e)}).${o.produccion ? "" : " Revíselo antes de repetir."}`]);
}

/** Lo que falla fuera del registro (al cerrar la base o al escribir la salida): tampoco se sabe qué quedó. */
export function salidaInesperada(e: unknown, o: OpcionesSalida): SalidaCli {
  return fallo(o, 1, [`❌ Error inesperado (${detalleDeError(e)}). No se pudo confirmar si quedó registrado${o.produccion ? "." : ": revíselo antes de repetir."}`]);
}

/** Escribe las líneas (stdout) y los errores (stderr), en ese orden, y devuelve el código de salida. */
export function emitir(s: SalidaCli, consola: Consola): number {
  for (const linea of s.lineas) consola.log(linea);
  for (const linea of s.errores) consola.error(linea);
  return s.codigoSalida;
}
