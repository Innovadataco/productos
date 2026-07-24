/**
 * Validación y cálculo de las colecciones PM2 de un proyecto
 * (spec 008, US4/US5/US6 — cronograma, presupuesto, recursos y lecciones).
 *
 * Puro y aparte de las rutas, como `entregable.ts`: lo que decide comportamiento
 * queda cubierto por la suite sin BD.
 */

/** Tipos de recurso admitidos (decisión del CEO, `/speckit-clarify`). */
export const TIPOS_RECURSO = ["humano", "material"] as const;

/** Devuelve el mensaje del primer problema, o `null` si los datos son válidos. */
type Validacion = string | null;

function comoObjeto(datos: unknown): Record<string, unknown> | null {
  return typeof datos === "object" && datos !== null ? (datos as Record<string, unknown>) : null;
}

function esVacio(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === "";
}

/** Fecha válida, o `null` si el valor viene vacío. `undefined` = no es fecha. */
function comoFecha(valor: unknown): Date | null | undefined {
  if (esVacio(valor)) return null;
  const fecha = new Date(String(valor));
  return isNaN(fecha.getTime()) ? undefined : fecha;
}

/** Monto no negativo (§5.2). `undefined` = no es un número usable. */
function comoMonto(valor: unknown): number | undefined {
  if (esVacio(valor)) return 0;
  const monto = Number(valor);
  return Number.isFinite(monto) && monto >= 0 ? monto : undefined;
}

// ─────────────────────────────── US4 · Cronograma ───────────────────────────

export interface DatosHito {
  nombre: string;
  fecha: Date;
  fechaFin: Date | null;
}

export function validarHito(datos: unknown): Validacion {
  const d = comoObjeto(datos);
  if (!d) return "Datos del hito inválidos";

  if (typeof d.nombre !== "string" || d.nombre.trim() === "") {
    return "El nombre del hito es obligatorio";
  }
  const fecha = comoFecha(d.fecha);
  if (fecha === undefined) return "La fecha del hito no es una fecha válida";
  if (fecha === null) return "La fecha del hito es obligatoria";

  const fin = comoFecha(d.fechaFin);
  if (fin === undefined) return "La fecha de fin no es una fecha válida";
  // Un periodo que termina antes de empezar no es un dato raro: es imposible.
  if (fin !== null && fin < fecha) return "La fecha de fin no puede ser anterior a la de inicio";

  return null;
}

export function datosHito(datos: Record<string, unknown>): DatosHito {
  return {
    nombre: String(datos.nombre).trim(),
    fecha: comoFecha(datos.fecha) as Date,
    fechaFin: (comoFecha(datos.fechaFin) as Date | null) ?? null,
  };
}

// ──────────────────────── US5 · Presupuesto y recursos ──────────────────────

export interface DatosPartida {
  concepto: string;
  montoPlaneado: number;
  montoEjecutado: number;
  moneda: string;
}

export function validarPartidaProyecto(datos: unknown): Validacion {
  const d = comoObjeto(datos);
  if (!d) return "Datos de la partida inválidos";

  if (typeof d.concepto !== "string" || d.concepto.trim() === "") {
    return "El concepto de la partida es obligatorio";
  }
  if (comoMonto(d.montoPlaneado) === undefined) {
    return "El monto planeado debe ser un número no negativo";
  }
  if (comoMonto(d.montoEjecutado) === undefined) {
    return "El monto ejecutado debe ser un número no negativo";
  }
  return null;
}

export function datosPartida(datos: Record<string, unknown>): DatosPartida {
  return {
    concepto: String(datos.concepto).trim(),
    montoPlaneado: comoMonto(datos.montoPlaneado) as number,
    montoEjecutado: comoMonto(datos.montoEjecutado) as number,
    moneda: datos.moneda ? String(datos.moneda) : "COP",
  };
}

export interface ResumenPresupuesto {
  totalPlaneado: number;
  totalEjecutado: number;
  /** Ejecutado − planeado. **Positivo = sobrecoste**, y se muestra, no se impide. */
  desviacion: number;
}

/**
 * Control de gasto PM2 (FR-012).
 *
 * Que lo ejecutado supere lo planeado es justo lo que el control debe **mostrar**
 * (spec, Edge Cases), así que la desviación puede ser positiva y no se acota.
 */
export function resumirPresupuesto(
  partidas: Array<{ montoPlaneado: unknown; montoEjecutado: unknown }>,
): ResumenPresupuesto {
  const totalPlaneado = partidas.reduce((acc, p) => acc + Number(p.montoPlaneado), 0);
  const totalEjecutado = partidas.reduce((acc, p) => acc + Number(p.montoEjecutado), 0);
  return { totalPlaneado, totalEjecutado, desviacion: totalEjecutado - totalPlaneado };
}

export interface DatosRecurso {
  nombre: string;
  rol: string;
  tipo: string;
  costo: number;
  disponibilidad: string;
}

export function validarRecurso(datos: unknown): Validacion {
  const d = comoObjeto(datos);
  if (!d) return "Datos del recurso inválidos";

  if (typeof d.nombre !== "string" || d.nombre.trim() === "") {
    return "El nombre del recurso es obligatorio";
  }
  if (!esVacio(d.tipo) && !TIPOS_RECURSO.includes(String(d.tipo) as (typeof TIPOS_RECURSO)[number])) {
    return `Tipo de recurso no válido. Admitidos: ${TIPOS_RECURSO.join(", ")}`;
  }
  if (comoMonto(d.costo) === undefined) {
    return "El costo debe ser un número no negativo";
  }
  return null;
}

export function datosRecurso(datos: Record<string, unknown>): DatosRecurso {
  return {
    nombre: String(datos.nombre).trim(),
    // El rol aplica sobre todo a los humanos; en material puede quedar vacío
    // (spec, Edge Cases). No se exige por tipo para no bloquear la captura.
    rol: datos.rol ? String(datos.rol) : "",
    tipo: datos.tipo ? String(datos.tipo) : "humano",
    costo: comoMonto(datos.costo) as number,
    disponibilidad: datos.disponibilidad ? String(datos.disponibilidad) : "",
  };
}

// ──────────────────────── US6 · Lecciones aprendidas ────────────────────────

export interface DatosLeccion {
  descripcion: string;
  categoria: string;
  impacto: string;
}

export function validarLeccion(datos: unknown): Validacion {
  const d = comoObjeto(datos);
  if (!d) return "Datos de la lección inválidos";

  if (typeof d.descripcion !== "string" || d.descripcion.trim() === "") {
    return "La descripción de la lección es obligatoria";
  }
  return null;
}

export function datosLeccion(datos: Record<string, unknown>): DatosLeccion {
  return {
    descripcion: String(datos.descripcion).trim(),
    categoria: datos.categoria ? String(datos.categoria) : "",
    impacto: datos.impacto ? String(datos.impacto) : "",
  };
}
