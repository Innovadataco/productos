/// Servicio de EMPRESAS (spec 009, US1) — CRUD de `ProveedorVigilado` ⇄ `Usuario` rol 2 por join
/// lógico NIT. Cero tablas nuevas. Reglas ZEUS embebidas:
///  - G2: token de empresa único validado SERVER-SIDE (no índice: la columna es nullable) → 409.
///  - G3: unicidad de NIT por `usn_identificacion @unique` + verificación previa → 409.
///  - Correo SIEMPRE FUERA de la transacción: un fallo de Resend nunca revierte el alta.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getCorreo } from "@/lib/correo/correo";
import { resolverPagina, construirPaginado, type Paginado } from "@/lib/paginacion";
import { generarClaveTemporal, esCorreoValido, esUuid } from "./credenciales";

const ROL_ADMIN_EMPRESA = 2;

/// Normaliza el token de empresa: si viene, debe ser UUID válido (tpv_token @db.Uuid) → 400 si no;
/// si no viene, se genera uno (token "generado o digitado", spec US1).
function normalizarToken(tokenRaw?: string | null): string {
  const t = tokenRaw?.trim();
  if (!t) return randomUUID();
  if (!esUuid(t)) throw new AppError("El token debe ser un UUID válido", ERROR_CODES.VALIDATION_ERROR, 400);
  return t;
}

export interface EmpresaListado {
  nit: string | null;
  empresa: string | null;
  estado: boolean | null;
  fechaInicial: Date | null;
  fechaFinal: Date | null;
}

/// Listado paginado de empresas (solo rol 1). Paginación server-side estándar (P1, §4.3).
export async function listarEmpresas(page?: unknown, pageSize?: unknown): Promise<Paginado<EmpresaListado>> {
  const pagina = resolverPagina(page, pageSize);
  const [filas, total] = await Promise.all([
    prisma.proveedorVigilado.findMany({
      orderBy: { id: "desc" },
      skip: pagina.skip,
      take: pagina.take,
      select: { documento: true, empresa: true, estado: true, fechaInicial: true, fechaFinal: true },
    }),
    prisma.proveedorVigilado.count(),
  ]);
  const items = filas.map((f) => ({
    nit: f.documento,
    empresa: f.empresa,
    estado: f.estado,
    fechaInicial: f.fechaInicial,
    fechaFinal: f.fechaFinal,
  }));
  return construirPaginado(items, total, pagina);
}

export interface EmpresaDetalle extends EmpresaListado {
  /// Token visible SOLO para rol 1 (el endpoint lo omite para otros).
  token: string | null;
  correo: string | null;
  modulos: number[];
}

/// Detalle de una empresa por NIT (sin exponer la clave). El token lo entrega solo si `incluirToken`.
export async function detalleEmpresa(nit: string, incluirToken: boolean): Promise<EmpresaDetalle> {
  const prov = await prisma.proveedorVigilado.findFirst({ where: { documento: nit } });
  if (!prov) throw new AppError("Empresa no encontrada", ERROR_CODES.NOT_FOUND, 404);
  const admin = await prisma.usuario.findFirst({
    where: { identificacion: nit, rolId: ROL_ADMIN_EMPRESA },
    include: { usuariosModulos: true },
  });
  const modulos = (admin?.usuariosModulos ?? [])
    .filter((um) => um.submoduloId == null && um.moduloId != null)
    .map((um) => um.moduloId as number);
  return {
    nit: prov.documento,
    empresa: prov.empresa,
    estado: prov.estado,
    fechaInicial: prov.fechaInicial,
    fechaFinal: prov.fechaFinal,
    token: incluirToken ? prov.token : null,
    correo: admin?.correo ?? null,
    modulos,
  };
}

export interface CrearEmpresaInput {
  empresa: string;
  nit: string;
  correo: string;
  fechaInicial?: string | Date | null;
  fechaFinal?: string | Date | null;
  token?: string | null;
  /// ids de módulos que la empresa (su admin) podrá usar — techo de la cascada.
  modulos?: number[];
}

export interface ResultadoAltaEmpresa {
  proveedorId: number;
  usuarioId: number;
  correoEnviado: boolean;
}

function aFecha(v: string | Date | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/// Verifica que el token no lo tenga OTRO proveedor (G2). `excluirId` omite el propio en updates.
async function exigirTokenUnico(token: string, excluirProveedorId?: number): Promise<void> {
  const otro = await prisma.proveedorVigilado.findFirst({
    where: { token, ...(excluirProveedorId ? { id: { not: excluirProveedorId } } : {}) },
  });
  if (otro) {
    throw new AppError("El token de empresa ya está en uso", ERROR_CODES.CONFLICT, 409);
  }
}

/// Crea empresa + usuario admin (rol 2) + sus módulos en UNA transacción; envía la credencial por
/// correo DESPUÉS del commit (fuera de la transacción).
export async function crearEmpresa(input: CrearEmpresaInput): Promise<ResultadoAltaEmpresa> {
  const empresa = input.empresa?.trim();
  const nit = input.nit?.trim();
  const correo = input.correo?.trim();
  if (!empresa || !nit || !correo) {
    throw new AppError("Razón social, NIT y correo son requeridos", ERROR_CODES.VALIDATION_ERROR, 400);
  }
  if (!esCorreoValido(correo)) {
    throw new AppError("Correo inválido", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  // 409 por NIT/usuario ya existente (G3): la unicidad la da usn_identificacion.
  const yaUsuario = await prisma.usuario.findFirst({
    where: { OR: [{ identificacion: nit }, { usuario: nit }] },
  });
  if (yaUsuario) {
    throw new AppError("Ya existe un usuario con ese NIT", ERROR_CODES.CONFLICT, 409);
  }

  const token = normalizarToken(input.token); // UUID válido o generado (400 si UUID inválido)
  await exigirTokenUnico(token); // G2, server-side

  const temporal = generarClaveTemporal();
  const clave = await hashPassword(temporal);
  const modulos = Array.from(new Set(input.modulos ?? [])).filter((n) => Number.isInteger(n));

  const { proveedorId, usuarioId } = await prisma.$transaction(async (tx) => {
    const prov = await tx.proveedorVigilado.create({
      data: {
        empresa,
        vigilado: nit,
        documento: nit,
        token,
        estado: true,
        fechaInicial: aFecha(input.fechaInicial),
        fechaFinal: aFecha(input.fechaFinal),
      },
    });
    const user = await tx.usuario.create({
      data: {
        nombre: empresa,
        usuario: nit,
        identificacion: nit,
        clave,
        claveTemporal: true,
        correo,
        tokenAutorizado: token,
        rolId: ROL_ADMIN_EMPRESA,
        estado: true,
        creacion: new Date(),
      },
    });
    for (const moduloId of modulos) {
      await tx.usuarioModulo.create({ data: { usuarioId: user.id, moduloId, estado: true } });
    }
    return { proveedorId: prov.id, usuarioId: user.id };
  });

  // ── Correo FUERA de la transacción (nunca revierte el alta) ──────────────────────────────────
  const r = await enviarCredencial(correo, nit, temporal, "Alta de empresa — SICOV-OTPC");
  return { proveedorId, usuarioId, correoEnviado: r };
}

export interface ActualizarEmpresaInput {
  empresa?: string;
  correo?: string;
  fechaInicial?: string | Date | null;
  fechaFinal?: string | Date | null;
  estado?: boolean;
}

/// Edita datos/vigencia/estado. El NIT y el rol NO son editables. Desactivar apaga también el
/// login del admin (usn_estado=false). Reversible (aditivo, sin borrado físico).
export async function actualizarEmpresa(nit: string, patch: ActualizarEmpresaInput): Promise<void> {
  const prov = await prisma.proveedorVigilado.findFirst({ where: { documento: nit } });
  if (!prov) throw new AppError("Empresa no encontrada", ERROR_CODES.NOT_FOUND, 404);
  if (patch.correo !== undefined && patch.correo && !esCorreoValido(patch.correo)) {
    throw new AppError("Correo inválido", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.proveedorVigilado.update({
      where: { id: prov.id },
      data: {
        ...(patch.empresa !== undefined ? { empresa: patch.empresa.trim() } : {}),
        ...(patch.fechaInicial !== undefined ? { fechaInicial: aFecha(patch.fechaInicial) } : {}),
        ...(patch.fechaFinal !== undefined ? { fechaFinal: aFecha(patch.fechaFinal) } : {}),
        ...(patch.estado !== undefined ? { estado: patch.estado } : {}),
        updatedAt: new Date(),
      },
    });
    // Admin de empresa (rol 2) por join NIT.
    const datosUser: { correo?: string; estado?: boolean; actualizacion: Date } = { actualizacion: new Date() };
    if (patch.correo !== undefined) datosUser.correo = patch.correo.trim();
    if (patch.estado !== undefined) datosUser.estado = patch.estado;
    await tx.usuario.updateMany({
      where: { identificacion: nit, rolId: ROL_ADMIN_EMPRESA },
      data: datosUser,
    });
  });
}

/// Modifica el token de la empresa sincronizando `tpv_token` ⇄ `usn_token_autorizado` del admin
/// en una transacción. Valida unicidad server-side (G2). Los operadores heredan por join.
export async function modificarToken(nit: string, nuevoToken: string): Promise<void> {
  const raw = nuevoToken?.trim();
  if (!raw) throw new AppError("Token requerido", ERROR_CODES.VALIDATION_ERROR, 400);
  if (!esUuid(raw)) throw new AppError("El token debe ser un UUID válido", ERROR_CODES.VALIDATION_ERROR, 400);
  const token = raw;
  const prov = await prisma.proveedorVigilado.findFirst({ where: { documento: nit } });
  if (!prov) throw new AppError("Empresa no encontrada", ERROR_CODES.NOT_FOUND, 404);
  await exigirTokenUnico(token, prov.id); // G2

  await prisma.$transaction(async (tx) => {
    await tx.proveedorVigilado.update({ where: { id: prov.id }, data: { token, updatedAt: new Date() } });
    await tx.usuario.updateMany({
      where: { identificacion: nit, rolId: ROL_ADMIN_EMPRESA },
      data: { tokenAutorizado: token, actualizacion: new Date() },
    });
  });
}

/// Regenera la clave temporal del admin de empresa y la reenvía (nunca reutiliza la anterior).
export async function reenviarCredencial(nit: string): Promise<boolean> {
  const user = await prisma.usuario.findFirst({
    where: { identificacion: nit, rolId: ROL_ADMIN_EMPRESA },
  });
  if (!user || !user.correo) throw new AppError("Empresa no encontrada", ERROR_CODES.NOT_FOUND, 404);
  const temporal = generarClaveTemporal();
  await prisma.usuario.update({
    where: { id: user.id },
    data: { clave: await hashPassword(temporal), claveTemporal: true, actualizacion: new Date() },
  });
  return enviarCredencial(user.correo, nit, temporal, "Reenvío de credencial — SICOV-OTPC");
}

async function enviarCredencial(para: string, usuario: string, temporal: string, asunto: string): Promise<boolean> {
  const r = await getCorreo().enviarCorreo({
    para,
    asunto,
    texto: `Usuario: ${usuario}\nClave temporal: ${temporal}\nDeberá cambiarla al iniciar sesión.`,
  });
  return r.ok;
}
