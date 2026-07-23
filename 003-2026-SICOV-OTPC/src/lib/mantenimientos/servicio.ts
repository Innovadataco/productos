import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { resolverContextoEfectivo } from "@/lib/integracion/contexto-usuario";
import { extraerIdMantenimientoExterno, extraerMensajeError, limpiarPlaca } from "@/lib/normalizar";
import { crearJob } from "@/lib/mantenimientos/cola";
import {
  REGEX_HORA,
  REGEX_PLACA,
  TIPOS_OPERABLES,
  NOMBRE_TIPO,
  esTipoIdentificacionValido,
  type RegistroDetalle,
  type TipoOperable,
} from "@/lib/mantenimientos/tipos";

/// Servicio de mantenimientos (spec 005-A). Flujo en dos pasos del legacy:
/// base (tbl_mantenimientos) → detalle (tbl_preventivos/tbl_correctivos).
/// Vía web: intento de reporte INMEDIATO con caída a cola (D-021). Vía masiva: siempre diferido.
/// Ids: el enlace local (`mantenimientoId`) NUNCA se sobrescribe; el id de la Super vive en
/// `mantenimientoIdExterno` (gate B1 — corrige el bug del legacy).

export interface ResultadoBase {
  mantenimientoLocalId: number;
  procesado: boolean;
  mantenimientoIdExterno: number | null;
  jobId: number | null;
  mensaje: string;
}

export interface ResultadoDetalle {
  detalleId: number;
  mantenimientoLocalId: number;
  procesado: boolean;
  mantenimientoIdExterno: number | null;
  jobId: number | null;
  mensaje: string;
}

function validarTipoOperable(tipoId: unknown): TipoOperable {
  const n = Number(tipoId);
  if (!Number.isInteger(n) || n < 1 || n > 4) {
    throw new AppError("El tipoId no es valido", ERROR_CODES.VALIDATION_ERROR, 400);
  }
  if (!TIPOS_OPERABLES.includes(n as TipoOperable)) {
    throw new AppError(
      "Tipo de mantenimiento no disponible en esta versión (llega con las specs 006/007)",
      ERROR_CODES.VALIDATION_ERROR,
      400,
    );
  }
  return n as TipoOperable;
}

function validarPlaca(placa: unknown): string {
  const p = limpiarPlaca(placa);
  if (!REGEX_PLACA.test(p)) {
    throw new AppError(
      "La placa debe ser 3 letras + 3 dígitos (ej. ABC123)",
      ERROR_CODES.VALIDATION_ERROR,
      400,
    );
  }
  return p;
}

/// Paso 1 — mantenimiento base. Desactiva los previos del mismo vigilado+placa+tipo (paridad),
/// persiste, y si `diferido` no está activo intenta el reporte inmediato con caída a cola.
export async function guardarBase(
  datos: { vigiladoId?: unknown; placa?: unknown; tipoId?: unknown },
  usuario: string,
  idRol: number,
  opts: { diferido?: boolean } = {},
): Promise<ResultadoBase> {
  if (!datos.vigiladoId || !datos.placa || !datos.tipoId) {
    throw new AppError("Todos los campos son requeridos", ERROR_CODES.VALIDATION_ERROR, 400);
  }
  const tipoId = validarTipoOperable(datos.tipoId);
  const placa = validarPlaca(datos.placa);
  const contexto = await resolverContextoEfectivo(usuario, idRol);
  const nit = BigInt(contexto.nitVigilado);

  // Vigencia: el registro nuevo desactiva los previos del mismo vigilado+placa+tipo.
  await prisma.mantenimiento.updateMany({
    where: { usuarioId: nit, placa, tipoId },
    data: { estado: false, actualizado: new Date() },
  });

  const base = await prisma.mantenimiento.create({
    data: {
      placa,
      tipoId,
      usuarioId: nit,
      fechaDiligenciamiento: new Date(),
      estado: true,
      procesado: false,
    },
  });

  const payloadExterno = { vigiladoId: Number(contexto.nitVigilado), placa, tipoId };

  if (opts.diferido) {
    const job = await crearJob({
      tipo: "base",
      mantenimientoLocalId: base.id,
      vigiladoId: contexto.nitVigilado,
      usuarioDocumento: usuario,
      rolId: idRol,
      payload: payloadExterno,
    });
    return {
      mantenimientoLocalId: base.id,
      procesado: false,
      mantenimientoIdExterno: null,
      jobId: job.id,
      mensaje: "Mantenimiento programado para sincronización",
    };
  }

  // Envío inmediato con caída a cola (D-021). El mensaje del API (incluidos los errores de
  // negocio de la Super, §10.10) se devuelve tal cual; si falla, queda job pendiente.
  try {
    const resp = await getClienteSupertransporte().postMantenimiento(
      "/guardar-mantenimieto", // [sic — endpoint legacy]
      payloadExterno,
      usuario,
      idRol,
    );
    const idExterno = extraerIdMantenimientoExterno(resp);
    if (idExterno == null) {
      throw Object.assign(new Error("El servicio externo no devolvió el identificador"), {
        responseData: resp,
      });
    }
    await prisma.mantenimiento.update({
      where: { id: base.id },
      data: { procesado: true, mantenimientoIdExterno: idExterno, actualizado: new Date() },
    });
    return {
      mantenimientoLocalId: base.id,
      procesado: true,
      mantenimientoIdExterno: idExterno,
      jobId: null,
      mensaje: String((resp as Record<string, unknown>)["mensaje"] ?? "Mantenimiento registrado"),
    };
  } catch (err: unknown) {
    const job = await crearJob({
      tipo: "base",
      mantenimientoLocalId: base.id,
      vigiladoId: contexto.nitVigilado,
      usuarioDocumento: usuario,
      rolId: idRol,
      payload: payloadExterno,
    });
    return {
      mantenimientoLocalId: base.id,
      procesado: false,
      mantenimientoIdExterno: null,
      jobId: job.id,
      mensaje: `Encolado para reintento: ${extraerMensajeError(err)}`,
    };
  }
}

function validarDetalle(datos: Partial<RegistroDetalle> & { mantenimientoId?: unknown }): void {
  const id = Number(datos.mantenimientoId);
  if (!datos.mantenimientoId || !Number.isInteger(id)) {
    throw new AppError(
      "El mantenimientoId es requerido y debe ser un número entero",
      ERROR_CODES.VALIDATION_ERROR,
      400,
    );
  }
  if (datos.hora !== undefined && datos.hora !== null && !REGEX_HORA.test(String(datos.hora))) {
    throw new AppError(
      "La hora debe tener formato HH:mm (00:00–23:59)",
      ERROR_CODES.VALIDATION_ERROR,
      400,
    );
  }
  if (
    datos.tipoIdentificacion !== undefined &&
    datos.tipoIdentificacion !== null &&
    !esTipoIdentificacionValido(datos.tipoIdentificacion)
  ) {
    throw new AppError(
      "tipoIdentificacion debe estar entre 1 y 12 (catálogo del manual)",
      ERROR_CODES.VALIDATION_ERROR,
      400,
    );
  }
}

/// Paso 2 — detalle preventivo (tipo 1) o correctivo (tipo 2).
export async function guardarDetalle(
  tipo: TipoOperable,
  datos: Partial<RegistroDetalle> & { mantenimientoId?: unknown },
  usuario: string,
  idRol: number,
  opts: { diferido?: boolean } = {},
): Promise<ResultadoDetalle> {
  validarDetalle(datos);
  const mantenimientoLocalId = Number(datos.mantenimientoId);
  const contexto = await resolverContextoEfectivo(usuario, idRol);

  const base = await prisma.mantenimiento.findUnique({ where: { id: mantenimientoLocalId } });
  if (!base) {
    throw new AppError("Mantenimiento local no encontrado", ERROR_CODES.NOT_FOUND, 404);
  }

  const delegado = tipo === 1 ? prisma.preventivo : prisma.correctivo;
  const registro = {
    placa: base.placa,
    fecha: datos.fecha ? new Date(`${datos.fecha}T00:00:00Z`) : null,
    hora: datos.hora ? String(datos.hora) : null,
    nit: datos.nit != null && String(datos.nit) !== "" ? BigInt(String(datos.nit)) : null,
    razonSocial: datos.razonSocial ?? null,
    tipoIdentificacion: datos.tipoIdentificacion != null ? Number(datos.tipoIdentificacion) : null,
    numeroIdentificacion: datos.numeroIdentificacion ?? null,
    nombresResponsable: datos.nombresResponsable ?? null,
    mantenimientoId: mantenimientoLocalId, // enlace LOCAL — nunca se sobrescribe (gate B1)
    detalleActividades: datos.detalleActividades ?? null,
    estado: true,
    procesado: false,
  };
  // Los delegados de Prisma comparten forma de columnas; el cast mantiene un solo camino.
  const detalle = await (delegado as typeof prisma.preventivo).create({ data: registro });

  const payloadExterno = {
    placa: base.placa,
    fecha: datos.fecha ?? null,
    hora: datos.hora ?? null,
    nit: datos.nit != null ? Number(datos.nit) : null,
    razonSocial: datos.razonSocial ?? null,
    tipoIdentificacion: datos.tipoIdentificacion != null ? Number(datos.tipoIdentificacion) : null,
    numeroIdentificacion: datos.numeroIdentificacion ?? null,
    nombresResponsable: datos.nombresResponsable ?? null,
    detalleActividades: datos.detalleActividades ?? null,
  };

  const encolar = async (mensaje: string): Promise<ResultadoDetalle> => {
    const job = await crearJob({
      tipo: NOMBRE_TIPO[tipo] as "preventivo" | "correctivo",
      mantenimientoLocalId,
      detalleId: detalle.id,
      vigiladoId: contexto.nitVigilado,
      usuarioDocumento: usuario,
      rolId: idRol,
      payload: payloadExterno,
    });
    return {
      detalleId: detalle.id,
      mantenimientoLocalId,
      procesado: false,
      mantenimientoIdExterno: null,
      jobId: job.id,
      mensaje,
    };
  };

  if (opts.diferido) {
    return encolar(`${NOMBRE_TIPO[tipo]} programado para sincronización`);
  }

  // Inmediato: exige que el base ya tenga id externo (dependencia base→detalle); si no, cae a cola.
  if (base.mantenimientoIdExterno == null) {
    return encolar("El mantenimiento base aún no ha sido sincronizado; encolado");
  }
  try {
    const resp = await getClienteSupertransporte().postMantenimiento(
      `/guardar-${NOMBRE_TIPO[tipo]}`,
      { ...payloadExterno, mantenimientoId: base.mantenimientoIdExterno },
      usuario,
      idRol,
      { conVigiladoId: true },
    );
    const idExterno = extraerIdMantenimientoExterno(resp) ?? base.mantenimientoIdExterno;
    await (delegado as typeof prisma.preventivo).update({
      where: { id: detalle.id },
      data: { procesado: true, mantenimientoIdExterno: idExterno, actualizado: new Date() },
    });
    return {
      detalleId: detalle.id,
      mantenimientoLocalId,
      procesado: true,
      mantenimientoIdExterno: idExterno,
      jobId: null,
      mensaje: String((resp as Record<string, unknown>)["mensaje"] ?? "Detalle registrado"),
    };
  } catch (err: unknown) {
    return encolar(`Encolado para reintento: ${extraerMensajeError(err)}`);
  }
}

/// Carga masiva DIFERIDA y TRANSACCIONAL (US2, manual §10.10 — TODO-O-NADA).
/// Precondición: las filas YA pasaron la validación completa (lector + validarTiposDeDato);
/// aquí solo se encola. Si el encolado falla a mitad, la transacción revierte TODO: nunca un
/// lote parcial. El vigilado es SIEMPRE el NIT efectivo server-side (D-015): la columna
/// vigiladoId del archivo se ignora para roles 2/3.
export async function guardarMasivo(
  tipo: TipoOperable,
  filas: Array<Record<string, string>>,
  usuario: string,
  idRol: number,
): Promise<{ total: number; exitosos: number; errores: string[] }> {
  const contexto = await resolverContextoEfectivo(usuario, idRol);
  const nit = BigInt(contexto.nitVigilado);

  await prisma.$transaction(async (tx) => {
    for (const fila of filas) {
      const placa = fila["placa"];
      await tx.mantenimiento.updateMany({
        where: { usuarioId: nit, placa, tipoId: tipo },
        data: { estado: false, actualizado: new Date() },
      });
      const base = await tx.mantenimiento.create({
        data: {
          placa,
          tipoId: tipo,
          usuarioId: nit,
          fechaDiligenciamiento: new Date(),
          estado: true,
          procesado: false,
        },
      });
      await tx.mantenimientoJob.create({
        data: {
          tipo: "base",
          mantenimientoLocalId: base.id,
          vigiladoId: contexto.nitVigilado.slice(0, 30),
          usuarioDocumento: usuario.slice(0, 30),
          rolId: idRol,
          estado: "pendiente",
          reintentos: 0,
          siguienteIntento: new Date(),
          payload: { vigiladoId: Number(contexto.nitVigilado), placa, tipoId: tipo },
        },
      });

      const datosDetalle = {
        placa,
        fecha: new Date(`${fila["fecha"]}T00:00:00Z`),
        hora: fila["hora"],
        nit: BigInt(fila["nit"]),
        razonSocial: fila["razonSocial"],
        tipoIdentificacion: Number(fila["tipoIdentificacion"]),
        numeroIdentificacion: fila["numeroIdentificacion"],
        nombresResponsable: fila["nombresResponsable"],
        mantenimientoId: base.id, // enlace LOCAL (gate B1)
        detalleActividades: fila["detalleActividades"],
        estado: true,
        procesado: false,
      };
      const detalle =
        tipo === 1
          ? await tx.preventivo.create({ data: datosDetalle })
          : await tx.correctivo.create({ data: datosDetalle });

      await tx.mantenimientoJob.create({
        data: {
          tipo: NOMBRE_TIPO[tipo],
          mantenimientoLocalId: base.id,
          detalleId: detalle.id,
          vigiladoId: contexto.nitVigilado.slice(0, 30),
          usuarioDocumento: usuario.slice(0, 30),
          rolId: idRol,
          estado: "pendiente",
          reintentos: 0,
          siguienteIntento: new Date(),
          payload: {
            placa,
            fecha: fila["fecha"],
            hora: fila["hora"],
            nit: Number(fila["nit"]),
            razonSocial: fila["razonSocial"],
            tipoIdentificacion: Number(fila["tipoIdentificacion"]),
            numeroIdentificacion: fila["numeroIdentificacion"],
            nombresResponsable: fila["nombresResponsable"],
            detalleActividades: fila["detalleActividades"],
          },
        },
      });
    }
  });

  return { total: filas.length, exitosos: filas.length, errores: [] };
}

/// Consultas externas (proxy vía cliente stub/real). El vigilado SIEMPRE es el efectivo
/// server-side (D-015): se ignora cualquier nit del cliente.
export async function listarPlacas(tipoId: unknown, usuario: string, idRol: number) {
  const tipo = validarTipoOperable(tipoId);
  const contexto = await resolverContextoEfectivo(usuario, idRol);
  return getClienteSupertransporte().getMantenimiento(
    "/listar-placas",
    { vigiladoId: contexto.nitVigilado, tipoId: String(tipo) },
    usuario,
    idRol,
  );
}

export async function listarHistorial(
  tipoId: unknown,
  placa: unknown,
  usuario: string,
  idRol: number,
) {
  const tipo = validarTipoOperable(tipoId);
  const p = limpiarPlaca(placa);
  const contexto = await resolverContextoEfectivo(usuario, idRol);
  return getClienteSupertransporte().getMantenimiento(
    "/listar-historial",
    { tipoId: String(tipo), vigiladoId: contexto.nitVigilado, placa: p },
    usuario,
    idRol,
  );
}
