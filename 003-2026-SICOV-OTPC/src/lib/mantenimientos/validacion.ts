import { REGEX_HORA, REGEX_PLACA, esTipoIdentificacionValido } from "@/lib/mantenimientos/tipos";
import { limpiarPlaca } from "@/lib/normalizar";

/// Validación server-side de la carga masiva (paridad ControladorMantenimiento del legacy +
/// reglas del manual §10.10). Mensajes "Fila N: ..." y política TODO-O-NADA: la decisión de
/// rechazar el lote completo ante cualquier fila inválida la aplica el caller con estos errores.

export interface ColumnaRequerida {
  nombre: string;
  descripcion: string;
}

/// Las 10 columnas EXACTAS de la plantilla preventivo/correctivo (manual §10.10).
export const COLUMNAS_PREVENTIVO_CORRECTIVO: ColumnaRequerida[] = [
  { nombre: "vigiladoId", descripcion: "Nit de la empresa de transporte" },
  { nombre: "placa", descripcion: "placa del vehiculo al que se le realiza el mantenimiento" },
  { nombre: "fecha", descripcion: "fecha del mantenimiento (AAAA-MM-DD)" },
  { nombre: "hora", descripcion: "hora del mantenimiento (HH:mm)" },
  { nombre: "nit", descripcion: "nit de la empresa que realiza el mantenimiento" },
  { nombre: "razonSocial", descripcion: "razón social de la empresa que realiza el mantenimiento" },
  { nombre: "tipoIdentificacion", descripcion: "tipo de identificación del responsable (1-12)" },
  { nombre: "numeroIdentificacion", descripcion: "número de identificación del responsable" },
  { nombre: "nombresResponsable", descripcion: "nombre del responsable del mantenimiento" },
  { nombre: "detalleActividades", descripcion: "descripción detallada del mantenimiento realizado" },
];

export interface RegistroFila {
  [clave: string]: unknown;
  __fila__?: number;
}

const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_NUMERO = /^[0-9]+$/;

function esNumeroValido(valor: unknown): boolean {
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor === "string") return REGEX_NUMERO.test(valor.trim()) && valor.trim() !== "";
  return false;
}

function valorDe(registro: RegistroFila, columna: string): unknown {
  // Encabezados case-insensitive (paridad legacy).
  const llave = Object.keys(registro).find((k) => k.trim().toLowerCase() === columna.toLowerCase());
  return llave === undefined ? undefined : registro[llave];
}

function estaVacio(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/// Valida tipos y formatos por fila (los campos requeridos vacíos ya vienen reportados por el
/// lector). Devuelve mensajes "Fila N: ..." — cualquier mensaje implica TODO-O-NADA en el caller.
export function validarTiposDeDato(registros: RegistroFila[]): string[] {
  const errores: string[] = [];
  registros.forEach((registro, i) => {
    const fila = registro.__fila__ ?? i + 2;
    const err = (msj: string) => errores.push(`Fila ${fila}: ${msj}`);

    for (const col of ["vigiladoId", "nit"] as const) {
      const v = valorDe(registro, col);
      if (!estaVacio(v) && !esNumeroValido(v)) err(`la columna ${col} debe contener un número válido.`);
    }

    const placa = valorDe(registro, "placa");
    if (!estaVacio(placa) && !REGEX_PLACA.test(limpiarPlaca(placa))) {
      err("la columna placa debe ser 3 letras + 3 dígitos (ej. ABC123).");
    }

    const fecha = valorDe(registro, "fecha");
    if (!estaVacio(fecha) && !REGEX_FECHA_ISO.test(String(fecha))) {
      err("la columna fecha debe quedar en formato AAAA-MM-DD.");
    }

    // Condición vinculante del gate D-022 #3: regex de hora en el borde.
    const hora = valorDe(registro, "hora");
    if (!estaVacio(hora) && !REGEX_HORA.test(String(hora))) {
      err("la columna hora debe tener formato HH:mm (00:00–23:59).");
    }

    const tipoIdent = valorDe(registro, "tipoIdentificacion");
    if (!estaVacio(tipoIdent)) {
      if (!esNumeroValido(tipoIdent)) {
        err("la columna tipoIdentificacion debe contener un número válido.");
      } else if (!esTipoIdentificacionValido(tipoIdent)) {
        err("la columna tipoIdentificacion debe estar entre 1 y 12 (hoja tipos_identificacion).");
      }
    }

    for (const col of ["razonSocial", "numeroIdentificacion", "nombresResponsable", "detalleActividades"] as const) {
      const v = valorDe(registro, col);
      if (!estaVacio(v) && typeof v !== "string" && typeof v !== "number") {
        err(`la columna ${col} debe contener un texto válido.`);
      }
    }
  });
  return errores;
}

/// Extrae los valores canónicos de una fila ya validada (claves case-insensitive → canónicas).
export function filaCanonica(registro: RegistroFila): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of COLUMNAS_PREVENTIVO_CORRECTIVO) {
    const v = valorDe(registro, col.nombre);
    out[col.nombre] = estaVacio(v) ? "" : String(v).trim();
  }
  out["placa"] = limpiarPlaca(out["placa"]);
  return out;
}
