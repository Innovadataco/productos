import type { MantenimientoJob, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClienteSupertransporte } from "@/lib/integracion/cliente";
import { resolverContextoEfectivo } from "@/lib/integracion/contexto-usuario";
import { extraerIdMantenimientoExterno, extraerMensajeError } from "@/lib/normalizar";
import { colaMaxReintentos, colaBackoffMs } from "@/lib/cola-config";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { TIPOS_JOB_PROCESABLES, type TipoJob } from "@/lib/mantenimientos/tipos";

/// Cola de sincronización de mantenimientos (tbl_mantenimiento_jobs — paridad
/// MantenimientoQueueService + RepositorioMantenimientoDB.procesarJob*). Tercera pasada del
/// worker ÚNICO (scripts/worker.mjs, mismo advisory lock). Estados:
/// pendiente → procesando → procesado | fallido. Reintentos/backoff por env (D-019b).
/// Ids: el enlace local NUNCA se sobrescribe; el id de la Super va en *_mantenimiento_id_externo
/// (gate B1). Dependencia base→detalle: MantenimientoPendienteError reprograma SIN consumir
/// reintento (paridad). Reintento manual = corregir-y-reenviar (§10.6, pág. 25).

export class MantenimientoPendienteError extends Error {}

export interface DatosJob {
  tipo: TipoJob;
  mantenimientoLocalId?: number | null;
  detalleId?: number | null;
  vigiladoId: string;
  usuarioDocumento: string;
  rolId: number;
  payload?: Record<string, unknown> | null;
}

/// Crea un job `pendiente` con intento inmediato (paridad crearJob del legacy).
export async function crearJob(datos: DatosJob): Promise<MantenimientoJob> {
  return prisma.mantenimientoJob.create({
    data: {
      tipo: datos.tipo,
      mantenimientoLocalId: datos.mantenimientoLocalId ?? null,
      detalleId: datos.detalleId ?? null,
      vigiladoId: datos.vigiladoId.slice(0, 30),
      usuarioDocumento: datos.usuarioDocumento.slice(0, 30),
      rolId: datos.rolId,
      estado: "pendiente",
      reintentos: 0,
      siguienteIntento: new Date(),
      payload: (datos.payload ?? undefined) as object | undefined,
    },
  });
}

type PayloadJob = Record<string, unknown>;

function payloadDe(job: MantenimientoJob): PayloadJob {
  return (job.payload ?? {}) as PayloadJob;
}

async function procesarJobBase(job: MantenimientoJob): Promise<void> {
  if (!job.mantenimientoLocalId) {
    throw new Error("El trabajo no referencia un mantenimiento local válido");
  }
  const base = await prisma.mantenimiento.findUnique({ where: { id: job.mantenimientoLocalId } });
  if (!base) throw new Error("Mantenimiento local no encontrado");

  const p = payloadDe(job);
  const cuerpo = {
    vigiladoId: Number(p["vigiladoId"] ?? job.vigiladoId),
    placa: String(p["placa"] ?? base.placa ?? ""),
    tipoId: Number(p["tipoId"] ?? base.tipoId ?? 0),
  };
  const resp = await getClienteSupertransporte().postMantenimiento(
    "/guardar-mantenimieto", // [sic]
    cuerpo,
    job.usuarioDocumento,
    job.rolId,
  );
  const idExterno = extraerIdMantenimientoExterno(resp);
  if (idExterno == null) {
    throw Object.assign(new Error("El servicio externo no devolvió el identificador del mantenimiento"), {
      responseData: resp,
    });
  }
  await prisma.mantenimiento.update({
    where: { id: base.id },
    data: { procesado: true, mantenimientoIdExterno: idExterno, actualizado: new Date() },
  });
}

async function procesarJobDetalle(job: MantenimientoJob, tipo: "preventivo" | "correctivo"): Promise<void> {
  if (!job.detalleId) throw new Error(`El trabajo de ${tipo} no contiene detalle asociado`);
  const delegado = tipo === "preventivo" ? prisma.preventivo : prisma.correctivo;
  const detalle = await (delegado as typeof prisma.preventivo).findUnique({ where: { id: job.detalleId } });
  if (!detalle) throw new Error(`Registro ${tipo} no encontrado`);

  const baseId = job.mantenimientoLocalId ?? detalle.mantenimientoId;
  const base = baseId ? await prisma.mantenimiento.findUnique({ where: { id: baseId } }) : null;
  if (!base) throw new Error("Mantenimiento local asociado no encontrado");
  if (base.mantenimientoIdExterno == null) {
    // Dependencia base→detalle (paridad): reprograma SIN consumir reintento.
    throw new MantenimientoPendienteError("El mantenimiento base aún no ha sido sincronizado");
  }

  const p = payloadDe(job);
  const cuerpo = {
    placa: p["placa"] ?? detalle.placa,
    fecha: p["fecha"] ?? (detalle.fecha ? detalle.fecha.toISOString().slice(0, 10) : null),
    hora: p["hora"] ?? detalle.hora,
    nit: p["nit"] ?? (detalle.nit != null ? Number(detalle.nit) : null),
    razonSocial: p["razonSocial"] ?? detalle.razonSocial,
    tipoIdentificacion: p["tipoIdentificacion"] ?? detalle.tipoIdentificacion,
    numeroIdentificacion: p["numeroIdentificacion"] ?? detalle.numeroIdentificacion,
    nombresResponsable: p["nombresResponsable"] ?? detalle.nombresResponsable,
    detalleActividades: p["detalleActividades"] ?? detalle.detalleActividades,
    mantenimientoId: base.mantenimientoIdExterno, // a la Super viaja el id EXTERNO
  };
  const resp = await getClienteSupertransporte().postMantenimiento(
    `/guardar-${tipo}`,
    cuerpo,
    job.usuarioDocumento,
    job.rolId,
    { conVigiladoId: true },
  );
  const idExterno = extraerIdMantenimientoExterno(resp) ?? base.mantenimientoIdExterno;
  await (delegado as typeof prisma.preventivo).update({
    where: { id: detalle.id },
    // El enlace local (mantenimientoId) NO se toca — gate B1.
    data: { procesado: true, mantenimientoIdExterno: idExterno, actualizado: new Date() },
  });
}

async function procesarJob(job: MantenimientoJob): Promise<void> {
  if (!TIPOS_JOB_PROCESABLES.includes(job.tipo as TipoJob)) {
    throw new Error(`Tipo de trabajo no soportado en 005: ${job.tipo}`);
  }
  if (job.tipo === "base") return procesarJobBase(job);
  return procesarJobDetalle(job, job.tipo as "preventivo" | "correctivo");
}

export interface ResultadoLote {
  procesados: number;
  reprogramados: number;
  fallidos: number;
}

/// Procesa un lote (paridad procesarLote del legacy: 20, orden por id, +backoff, máx por env).
export async function procesarLoteMantenimientos(
  opts: { limite?: number; maxReintentos?: number } = {},
): Promise<ResultadoLote> {
  const limite = opts.limite ?? 20;
  const maxReintentos = opts.maxReintentos ?? colaMaxReintentos();
  const jobs = await prisma.mantenimientoJob.findMany({
    where: { estado: "pendiente", siguienteIntento: { lte: new Date() } },
    orderBy: { id: "asc" },
    take: limite,
  });

  let procesados = 0;
  let reprogramados = 0;
  let fallidos = 0;

  for (const job of jobs) {
    await prisma.mantenimientoJob.update({
      where: { id: job.id },
      data: { estado: "procesando", actualizado: new Date() },
    });
    try {
      await procesarJob(job);
      await prisma.mantenimientoJob.update({
        where: { id: job.id },
        data: { estado: "procesado", ultimoError: null, siguienteIntento: new Date(), actualizado: new Date() },
      });
      procesados += 1;
    } catch (error: unknown) {
      const mensaje = extraerMensajeError(error);
      if (error instanceof MantenimientoPendienteError) {
        // SIN consumir reintento (paridad MantenimientoQueueService).
        await prisma.mantenimientoJob.update({
          where: { id: job.id },
          data: {
            estado: "pendiente",
            ultimoError: mensaje,
            siguienteIntento: new Date(Date.now() + colaBackoffMs()),
            actualizado: new Date(),
          },
        });
        reprogramados += 1;
        continue;
      }
      const reintentos = (job.reintentos ?? 0) + 1;
      if (reintentos >= maxReintentos) {
        await prisma.mantenimientoJob.update({
          where: { id: job.id },
          data: { estado: "fallido", reintentos, ultimoError: mensaje, siguienteIntento: new Date(), actualizado: new Date() },
        });
        fallidos += 1;
      } else {
        await prisma.mantenimientoJob.update({
          where: { id: job.id },
          data: {
            estado: "pendiente",
            reintentos,
            ultimoError: mensaje,
            siguienteIntento: new Date(Date.now() + colaBackoffMs()),
            actualizado: new Date(),
          },
        });
        reprogramados += 1;
      }
    }
  }

  return { procesados, reprogramados, fallidos };
}

// ── Alcance server-side (D-015) ───────────────────────────────────────────────────────────────

/// NIT efectivo del usuario para filtrar jobs. Rol 3 = NIT heredado del administrador (sin este
/// fix el rol 3 no vería NINGÚN job: los jobs llevan el NIT del admin). Roles 2/3 IGNORAN
/// cualquier nit del cliente; solo rol 1 (desviación deliberada aprobada por el CEO) filtra libre.
async function nitAlcance(usuario: string, idRol: number, nitCliente?: string | null): Promise<string | null> {
  if (idRol === 1) return nitCliente?.trim() ? nitCliente.trim() : null; // null = todas las empresas
  const contexto = await resolverContextoEfectivo(usuario, idRol);
  return contexto.nitVigilado;
}

export interface FiltrosJobs {
  estado?: string | null;
  tipo?: string | null;
  placa?: string | null;
  nit?: string | null;
  fecha?: string | null; // AAAA-MM-DD (día sobre tmj_creado)
  termino?: string | null; // busca en tipo y placa (paridad termino → terminoTipo|terminoPlaca)
  pagina?: number;
  limite?: number;
  ordenCampo?: string | null;
  ordenDireccion?: "asc" | "desc";
}

const CAMPOS_ORDEN = new Set(["id", "creado", "estado", "tipo", "reintentos"]);
const TOPE_FILTRADO_MEMORIA = 2000;

function placaDe(job: MantenimientoJob): string {
  return String((payloadDe(job)["placa"] as string | undefined) ?? "").toUpperCase();
}

/// Listado paginado server-side con filtros (paridad listarTrabajosProgramados). Los filtros de
/// payload (placa/término) se aplican en memoria sobre un tope acotado — la cola es transitoria.
export async function listarJobs(
  usuario: string,
  idRol: number,
  f: FiltrosJobs,
): Promise<{ items: MantenimientoJob[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const nit = await nitAlcance(usuario, idRol, f.nit);
  const where: Prisma.MantenimientoJobWhereInput = {};
  if (nit) where.vigiladoId = nit.slice(0, 30);
  if (f.estado) where.estado = f.estado;
  if (f.tipo) where.tipo = f.tipo;
  if (f.fecha) {
    const inicio = new Date(`${f.fecha}T00:00:00-05:00`); // día Bogotá
    const fin = new Date(inicio.getTime() + 86_400_000);
    where.creado = { gte: inicio, lt: fin };
  }

  const campo = f.ordenCampo && CAMPOS_ORDEN.has(f.ordenCampo) ? f.ordenCampo : "id";
  const direccion = f.ordenDireccion ?? "desc";

  let candidatos = await prisma.mantenimientoJob.findMany({
    where,
    orderBy: { [campo]: direccion },
    take: TOPE_FILTRADO_MEMORIA,
  });
  if (f.placa) {
    const p = f.placa.toUpperCase();
    candidatos = candidatos.filter((j) => placaDe(j).includes(p));
  }
  if (f.termino) {
    const t = f.termino.toLowerCase();
    candidatos = candidatos.filter(
      (j) => j.tipo.toLowerCase().includes(t) || placaDe(j).toLowerCase().includes(t),
    );
  }

  const page = Math.max(1, f.pagina ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.limite ?? 25));
  const total = candidatos.length;
  const items = candidatos.slice((page - 1) * pageSize, page * pageSize);
  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

/// Log de errores para revisión (§11.2): jobs fallidos del alcance.
export async function listarJobsFallidos(
  usuario: string,
  idRol: number,
  f: { tipo?: string | null; nit?: string | null } = {},
): Promise<MantenimientoJob[]> {
  const nit = await nitAlcance(usuario, idRol, f.nit);
  const where: Prisma.MantenimientoJobWhereInput = { estado: "fallido" };
  if (nit) where.vigiladoId = nit.slice(0, 30);
  if (f.tipo) where.tipo = f.tipo;
  return prisma.mantenimientoJob.findMany({ where, orderBy: { id: "desc" } });
}

export async function obtenerJob(id: number, usuario: string, idRol: number): Promise<MantenimientoJob> {
  const job = await prisma.mantenimientoJob.findUnique({ where: { id } });
  const nit = await nitAlcance(usuario, idRol, null);
  if (!job || (nit && job.vigiladoId !== nit)) {
    throw new AppError("Trabajo no encontrado", ERROR_CODES.NOT_FOUND, 404);
  }
  return job;
}

// ── Reintento manual (corregir-y-reenviar, §10.6) ────────────────────────────────────────────

export type AccionReintento = "reprogramar" | "actualizar" | "marcarProcesado";

async function actualizarDatosLocales(job: MantenimientoJob, payload: PayloadJob): Promise<void> {
  if (job.tipo === "base" && job.mantenimientoLocalId) {
    const data: Record<string, unknown> = { actualizado: new Date() };
    if (payload["placa"]) data["placa"] = String(payload["placa"]).toUpperCase();
    if (payload["tipoId"]) data["tipoId"] = Number(payload["tipoId"]);
    await prisma.mantenimiento.update({ where: { id: job.mantenimientoLocalId }, data });
    return;
  }
  if ((job.tipo === "preventivo" || job.tipo === "correctivo") && job.detalleId) {
    const delegado = job.tipo === "preventivo" ? prisma.preventivo : prisma.correctivo;
    const data: Record<string, unknown> = { actualizado: new Date() };
    if (payload["placa"]) data["placa"] = String(payload["placa"]).toUpperCase();
    if (payload["fecha"]) data["fecha"] = new Date(`${payload["fecha"]}T00:00:00Z`);
    if (payload["hora"]) data["hora"] = String(payload["hora"]);
    if (payload["nit"] != null) data["nit"] = BigInt(String(payload["nit"]));
    if (payload["razonSocial"] != null) data["razonSocial"] = payload["razonSocial"];
    if (payload["tipoIdentificacion"] != null) data["tipoIdentificacion"] = Number(payload["tipoIdentificacion"]);
    if (payload["numeroIdentificacion"] != null) data["numeroIdentificacion"] = payload["numeroIdentificacion"];
    if (payload["nombresResponsable"] != null) data["nombresResponsable"] = payload["nombresResponsable"];
    if (payload["detalleActividades"] != null) data["detalleActividades"] = payload["detalleActividades"];
    await (delegado as typeof prisma.preventivo).update({ where: { id: job.detalleId }, data });
  }
}

/// Reintento manual (paridad reintentarTrabajoFallido + §10.6): NO es solo reenviar — la acción
/// `actualizar` corrige el payload Y los datos locales, resetea reintentos=0 y dispara un ciclo
/// completo nuevo. `reprogramar` (default) responde 409 al máximo. Si el job es detalle y su base
/// está fallido, opera sobre el base.
export async function reintentarJob(
  jobId: number,
  usuario: string,
  idRol: number,
  opts: { accion?: AccionReintento; payload?: PayloadJob | null } = {},
): Promise<{ mensaje: string; estado: string; jobId: number; siguienteIntento: string | null }> {
  const job = await obtenerJob(jobId, usuario, idRol);

  let objetivo = job;
  if (job.tipo !== "base" && job.mantenimientoLocalId != null) {
    const cabecera = await prisma.mantenimientoJob.findFirst({
      where: { mantenimientoLocalId: job.mantenimientoLocalId, tipo: "base" },
      orderBy: { id: "desc" },
    });
    if (cabecera && cabecera.estado === "fallido") objetivo = cabecera;
  }

  if (job.estado !== "fallido" && objetivo.estado !== "fallido") {
    // Paridad legacy: retorno silencioso si no hay nada que reprogramar.
    return { mensaje: "Sin acción: el trabajo no está fallido", estado: job.estado, jobId: job.id, siguienteIntento: null };
  }

  const accion = opts.accion ?? "reprogramar";
  const payload = opts.payload ?? null;

  if (payload) {
    await prisma.mantenimientoJob.update({
      where: { id: objetivo.id },
      data: { payload: { ...payloadDe(objetivo), ...payload } as object, actualizado: new Date() },
    });
    await actualizarDatosLocales(objetivo, payload);
  }

  if (accion === "marcarProcesado") {
    await prisma.mantenimientoJob.update({
      where: { id: objetivo.id },
      data: { estado: "procesado", ultimoError: null, siguienteIntento: new Date(), actualizado: new Date() },
    });
    return { mensaje: "Trabajo marcado como procesado", estado: "procesado", jobId: objetivo.id, siguienteIntento: null };
  }

  if (accion === "reprogramar" && (objetivo.reintentos ?? 0) >= colaMaxReintentos()) {
    throw new AppError(
      "El trabajo alcanzó el número máximo de reintentos permitidos. Use la acción actualizar (corregir y reenviar).",
      ERROR_CODES.CONFLICT,
      409,
    );
  }

  const ahora = new Date();
  await prisma.mantenimientoJob.update({
    where: { id: objetivo.id },
    data: { estado: "pendiente", reintentos: 0, ultimoError: null, siguienteIntento: ahora, actualizado: ahora },
  });
  return {
    mensaje: accion === "actualizar"
      ? "Datos actualizados y trabajo reprogramado para sincronización"
      : "Trabajo reprogramado para sincronización",
    estado: "pendiente",
    jobId: objetivo.id,
    siguienteIntento: ahora.toISOString(),
  };
}
