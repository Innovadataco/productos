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
  fechaCompromiso: Date | null;
  responsable: string;
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

  if (d.fechaCompromiso !== undefined && d.fechaCompromiso !== null && d.fechaCompromiso !== "") {
    const fecha = new Date(String(d.fechaCompromiso));
    if (isNaN(fecha.getTime())) return "La fecha de compromiso no es una fecha válida";
  }

  return null;
}

/** Normaliza lo validado a los campos que persiste Prisma. */
export function datosEntregable(datos: Record<string, unknown>): DatosEntregable {
  const fecha =
    datos.fechaCompromiso === undefined ||
    datos.fechaCompromiso === null ||
    datos.fechaCompromiso === ""
      ? null
      : new Date(String(datos.fechaCompromiso));

  return {
    nombre: String(datos.nombre).trim(),
    descripcion: datos.descripcion ? String(datos.descripcion) : "",
    avance:
      datos.avance === undefined || datos.avance === null || datos.avance === ""
        ? 0
        : Math.round(Number(datos.avance)),
    estado: datos.estado ? String(datos.estado) : "pendiente",
    fechaCompromiso: fecha,
    responsable: datos.responsable ? String(datos.responsable) : "",
  };
}
