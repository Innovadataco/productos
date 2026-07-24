/**
 * Validación de entregables de proyecto (spec 008, US3 / FR-010).
 *
 * Pura y aparte de la ruta para que la suite la cubra sin BD, igual que
 * `validarPartidas` en Oportunidades.
 */

/** Estados admitidos. Cortos y libres, pero no cualquier cosa (§5.2). */
export const ESTADOS_ENTREGABLE = ["pendiente", "en curso", "entregado", "cancelado"] as const;

export interface DatosEntregable {
  nombre: string;
  descripcion: string;
  avance: number;
  estado: string;
  fechaInicio: Date | null;
  fechaCompromiso: Date | null;
  responsable: string;
  dependeDe: string | null;
}

/**
 * Valida lo que llega por la API. Devuelve el mensaje legible del primer
 * problema, o `null` si está bien.
 */
export function validarEntregable(datos: unknown): string | null {
  if (typeof datos !== "object" || datos === null) return "Datos del entregable inválidos";
  const d = datos as Record<string, unknown>;

  if (typeof d.nombre !== "string" || d.nombre.trim() === "") {
    return "El nombre del entregable es obligatorio";
  }

  if (d.avance !== undefined && d.avance !== null && d.avance !== "") {
    const avance = Number(d.avance);
    if (!Number.isFinite(avance) || avance < 0 || avance > 100) {
      return "El avance debe ser un número entre 0 y 100";
    }
  }

  if (d.estado !== undefined && d.estado !== null && d.estado !== "") {
    if (!ESTADOS_ENTREGABLE.includes(String(d.estado) as (typeof ESTADOS_ENTREGABLE)[number])) {
      return `Estado no válido. Admitidos: ${ESTADOS_ENTREGABLE.join(", ")}`;
    }
  }

  const inicio =
    d.fechaInicio !== undefined && d.fechaInicio !== null && d.fechaInicio !== ""
      ? new Date(String(d.fechaInicio))
      : null;
  if (d.fechaInicio !== undefined && d.fechaInicio !== null && d.fechaInicio !== "" && isNaN(inicio!.getTime())) {
    return "La fecha de inicio no es una fecha válida";
  }

  let compromiso: Date | null = null;
  if (d.fechaCompromiso !== undefined && d.fechaCompromiso !== null && d.fechaCompromiso !== "") {
    compromiso = new Date(String(d.fechaCompromiso));
    if (isNaN(compromiso.getTime())) return "La fecha de compromiso no es una fecha válida";
  }

  // Una barra que termina antes de empezar no es un dato raro: es imposible.
  if (inicio && compromiso && compromiso < inicio) {
    return "La fecha de compromiso no puede ser anterior a la de inicio";
  }

  return null;
}

/** Normaliza lo validado a los campos que persiste Prisma. */
function comoFechaOpcional(valor: unknown): Date | null {
  return valor === undefined || valor === null || valor === "" ? null : new Date(String(valor));
}

export function datosEntregable(datos: Record<string, unknown>): DatosEntregable {
  return {
    nombre: String(datos.nombre).trim(),
    descripcion: datos.descripcion ? String(datos.descripcion) : "",
    avance:
      datos.avance === undefined || datos.avance === null || datos.avance === ""
        ? 0
        : Math.round(Number(datos.avance)),
    estado: datos.estado ? String(datos.estado) : "pendiente",
    fechaInicio: comoFechaOpcional(datos.fechaInicio),
    fechaCompromiso: comoFechaOpcional(datos.fechaCompromiso),
    responsable: datos.responsable ? String(datos.responsable) : "",
    // Dependencia del Gantt (spec 016). "" limpia la dependencia.
    dependeDe: datos.dependeDe ? String(datos.dependeDe) : null,
  };
}
