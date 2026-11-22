/**
 * Lo que imprime scripts/registrar-rendimientos-fondo.ts (frente fondo-rendimientos). Puro: arma el código de salida y
 * las líneas; `emitir` (src/datos-oficiales/registro/reporte.ts) las escribe. Solo el modo, conteos, códigos, números de
 * línea e ids internos: nunca valores, fechas, el código del fondo, el correo ni el mensaje de un error (el de Prisma
 * lleva el host de la base).
 *   0 ensayo, sin cambios o aplicado · 1 error de la base o del cifrado (salidaError) · 2 uso o archivo ilegible ·
 *   3 rechazado o archivo demasiado grande (no escribió nada).
 * En producción (NODE_ENV=production, la vía B) todo fallo termina con PARE_VIA_B y el ensayo dice repetir por el sobre.
 * Nunca recomienda comprar ni vender.
 */
import { bien, fallo, lineasHallazgos, type OpcionesSalida, type SalidaCli } from "../../datos-oficiales/registro/reporte";
import type { Hallazgo } from "../../datos-oficiales/registro/hallazgos";
import { MAX_BYTES_RENDIMIENTOS } from "./csv";
import type { ConteosRendimientos } from "./planificar";
import type { ModoRendimientos, ResultadoRendimientos } from "./registrar";

const QUE_REVISAR: Readonly<Record<string, string>> = {
  USUARIO_NO_AUTORIZADO: "el correo no es el de un dueño activo",
  FONDO_NO_REGISTRADO: "ese código no es un fondo (FIC) registrado: regístrelo primero (`registrar-fondo`); este comando no crea fondos",
  FONDO_INACTIVO: "el fondo está inactivo",
  FONDO_SIN_CONSTITUCION: "el fondo no tiene su constitución registrada: regístrela primero (`registrar-movimiento-fondo`)",
  FECHA_ANTES_DE_LA_CONSTITUCION: "esa fila es anterior a la constitución del fondo: revise la fecha en el encargo",
  VALOR_DISTINTO: "esa fecha y tipo ya están registrados con otro valor y lo registrado no se corrige: revise el valor en el encargo y avise al CEO de 008",
  FILA_REPETIDA: "dos filas con la misma fecha y tipo (la base guarda una por día y tipo)",
  FECHA_FUTURA: "la fecha es posterior a hoy",
  TIPO_DESCONOCIDO: "el tipo es RENDIMIENTO o RETENCION, exacto y sin tilde",
  VALOR_NO_POSITIVO: "el valor va sin signo y mayor que 0",
  NUMERO_FORMATO: "el valor va con punto decimal, sin miles, signo de pesos ni exponente",
  NUMERO_PRECISION: "el valor admite hasta 4 decimales",
  CONFLICTO_CONCURRENTE: "otra carga del mismo fondo chocó con esta",
};

function explicaciones(hallazgos: readonly Hallazgo[]): string[] {
  const codigos = [...new Set(hallazgos.map((h) => h.codigo))].filter((c) => QUE_REVISAR[c] !== undefined);
  return codigos.map((c) => `   ${c}: ${QUE_REVISAR[c]}.`);
}

const encabezado = (modo: ModoRendimientos): string => `Rendimientos del fondo · ${modo === "ENSAYO" ? "ENSAYO (no escribe nada)" : "APLICAR (escribe en la base)"}`;

const lineaConteos = (fondoId: string, c: ConteosRendimientos, modo: ModoRendimientos): string =>
  `Fondo ${fondoId} · filas: ${c.filas} · ${modo === "ENSAYO" ? "por registrar" : "registradas"}: rendimientos ${c.rendimientos}, retenciones ${c.retenciones} · sin cambios: ${c.sinCambios}`;

const RETENCION_SIN_CAJA = "Las retenciones quedan como hecho del fondo: no mueven la caja (el pago del rendimiento ya llega neto).";

function cierre(r: Extract<ResultadoRendimientos, { readonly conteos: ConteosRendimientos }>, o: OpcionesSalida): string[] {
  if (r.estado === "SIN_CAMBIOS") return ["Resultado: ya estaba todo registrado; no se escribió nada"];
  if (r.estado === "LISTO") {
    return [
      o.produccion
        ? "Resultado: listo; no se escribió nada. Para registrarlo, repita por la vía B con --aplicar en la cabecera del sobre"
        : "Resultado: listo para --aplicar; no se escribió nada",
    ];
  }
  const siguiente = o.produccion
    ? "Siguiente paso (vía B, §11 del runbook): `cargar-prod.sh conciliar-certificacion` de cada corte posterior a los rendimientos registrados."
    : "Siguiente paso: `npx tsx scripts/conciliar-certificacion.ts --fecha-corte <corte>` de cada corte posterior a los rendimientos registrados.";
  return [`Resultado: aplicado · carga ${r.cargaId}`, siguiente];
}

export function salidaRendimientos(r: ResultadoRendimientos, o: OpcionesSalida): SalidaCli {
  if (r.estado === "RECHAZADO") {
    return fallo(o, 3, [`❌ Rechazado, no se escribió nada · ${r.total} hallazgo(s):`, ...lineasHallazgos(r.hallazgos, r.total), ...explicaciones(r.hallazgos)], [encabezado(r.modo)]);
  }
  return bien([encabezado(r.modo), lineaConteos(r.fondoId, r.conteos, r.modo), RETENCION_SIN_CAJA, ...cierre(r, o)]);
}

/** El archivo no se pudo leer: 3 si pasa del tope (no se tocó la base), 2 si no es un archivo regular legible. */
export function salidaArchivoRendimientos(codigo: "ARCHIVO_ILEGIBLE" | "ARCHIVO_NO_REGULAR" | "ARCHIVO_DEMASIADO_GRANDE", o: OpcionesSalida): SalidaCli {
  if (codigo === "ARCHIVO_DEMASIADO_GRANDE") return fallo(o, 3, [`❌ ARCHIVO_DEMASIADO_GRANDE · el CSV pasa de ${MAX_BYTES_RENDIMIENTOS} bytes; no se tocó la base.`]);
  return fallo(o, 2, [`❌ ${codigo} · no se pudo leer el CSV indicado (debe ser un archivo regular); no se tocó la base.`]);
}
