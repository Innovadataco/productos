/// Servicio de USUARIOS en cascada (spec 009, US2). Rol 2 crea su equipo (rol 2/3) y reparte
/// módulos/submódulos SUBCONJUNTO de los suyos, validado SERVER-SIDE (D-015/D-017). Reglas ZEUS:
///  - B2: por (usuario, módulo) hay O una fila NULL (módulo completo) O N filas de submódulo,
///    NUNCA ambas. Al materializar permisos se borra lo anterior de ese módulo y se inserta la
///    representación elegida — en la MISMA transacción.
///  - Correo SIEMPRE fuera de la transacción de alta.
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getCorreo } from "@/lib/correo/correo";
import { resolverPagina, construirPaginado, type Paginado } from "@/lib/paginacion";
import { generarClaveTemporal, esCorreoValido } from "./credenciales";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface UsuarioGuardCtx {
  id: number;
  rolId: number | null;
  identificacion: string | null;
}

/// Asignación de permisos por módulo. `submoduloIds` vacío/omitido = MÓDULO COMPLETO (fila NULL).
export interface AsignacionModulo {
  moduloId: number;
  submoduloIds?: number[];
}

export interface CrearUsuarioInput {
  nombre: string;
  identificacion: string;
  correo: string;
  rolId: 2 | 3;
  /// Solo rol 1 puede fijar la empresa destino; rol 2 siempre crea bajo su propio NIT.
  empresaNit?: string;
  permisos?: AsignacionModulo[];
}

interface PermisosOtorgante {
  esRoot: boolean;
  /// moduloId → set de submoduloIds; un módulo COMPLETO se marca con `completos`.
  submodulosPorModulo: Map<number, Set<number>>;
  completos: Set<number>;
  modulos: Set<number>;
}

/// Resuelve qué puede OTORGAR el otorgante (contra sus propias filas). Rol 1 = root: otorga todo.
/// Espeja `cargarModulos`: si NO tiene personalización (`UsuarioModulo`), hereda los módulos de su
/// ROL, todos como COMPLETOS. Así el admin de empresa que opera por rol también puede repartir.
async function permisosDelOtorgante(otorgante: UsuarioGuardCtx): Promise<PermisosOtorgante> {
  if (otorgante.rolId === 1) {
    return { esRoot: true, submodulosPorModulo: new Map(), completos: new Set(), modulos: new Set() };
  }
  const filas = await prisma.usuarioModulo.findMany({
    where: { usuarioId: otorgante.id, estado: true },
    select: { moduloId: true, submoduloId: true },
  });

  const submodulosPorModulo = new Map<number, Set<number>>();
  const completos = new Set<number>();
  const modulos = new Set<number>();

  if (filas.length === 0 && otorgante.rolId != null) {
    // Sin personalización → módulos del ROL, todos completos (mismo criterio que cargarModulos).
    const delRol = await prisma.rolModulo.findMany({ where: { rolId: otorgante.rolId }, select: { moduloId: true } });
    for (const r of delRol) {
      if (r.moduloId == null) continue;
      modulos.add(r.moduloId);
      completos.add(r.moduloId);
    }
    return { esRoot: false, submodulosPorModulo, completos, modulos };
  }

  for (const f of filas) {
    if (f.moduloId == null) continue;
    modulos.add(f.moduloId);
    if (f.submoduloId == null) completos.add(f.moduloId);
    else {
      const s = submodulosPorModulo.get(f.moduloId) ?? new Set<number>();
      s.add(f.submoduloId);
      submodulosPorModulo.set(f.moduloId, s);
    }
  }
  return { esRoot: false, submodulosPorModulo, completos, modulos };
}

/// Valida que las asignaciones sean SUBCONJUNTO de lo que el otorgante tiene. Lanza 400/403.
function validarSubconjunto(permisos: AsignacionModulo[], otorg: PermisosOtorgante, moduloUsuariosId: number, rolDestino: number) {
  for (const a of permisos) {
    // rol 3 NUNCA recibe el módulo `usuarios` (§10.8).
    if (rolDestino === 3 && a.moduloId === moduloUsuariosId) {
      throw new AppError("Un operador no puede recibir el módulo Usuarios", ERROR_CODES.FORBIDDEN, 403);
    }
    if (otorg.esRoot) continue; // root otorga cualquier cosa
    if (!otorg.modulos.has(a.moduloId)) {
      throw new AppError(`No puede otorgar un módulo que no tiene (${a.moduloId})`, ERROR_CODES.FORBIDDEN, 403);
    }
    const pideCompleto = !a.submoduloIds || a.submoduloIds.length === 0;
    if (pideCompleto) {
      // Solo puede ceder "completo" si él tiene el módulo completo.
      if (!otorg.completos.has(a.moduloId)) {
        throw new AppError(`No tiene el módulo completo para otorgarlo (${a.moduloId})`, ERROR_CODES.FORBIDDEN, 403);
      }
    } else if (!otorg.completos.has(a.moduloId)) {
      // Cada submódulo pedido debe estar en el set del otorgante.
      const suyos = otorg.submodulosPorModulo.get(a.moduloId) ?? new Set<number>();
      for (const sid of a.submoduloIds!) {
        if (!suyos.has(sid)) {
          throw new AppError(`No puede otorgar el submódulo ${sid}`, ERROR_CODES.FORBIDDEN, 403);
        }
      }
    }
  }
}

/// Materializa permisos aplicando B2: por cada módulo borra TODAS las filas previas y reinserta la
/// representación elegida (una fila NULL = completo, o N filas de submódulo). Nunca coexisten.
async function materializarPermisos(tx: Tx, usuarioId: number, permisos: AsignacionModulo[]) {
  for (const a of permisos) {
    await tx.usuarioModulo.deleteMany({ where: { usuarioId, moduloId: a.moduloId } });
    const submods = Array.from(new Set(a.submoduloIds ?? [])).filter((n) => Number.isInteger(n));
    if (submods.length === 0) {
      // Módulo COMPLETO: única fila con submoduloId NULL.
      await tx.usuarioModulo.create({ data: { usuarioId, moduloId: a.moduloId, submoduloId: null, estado: true } });
    } else {
      for (const sid of submods) {
        await tx.usuarioModulo.create({ data: { usuarioId, moduloId: a.moduloId, submoduloId: sid, estado: true } });
      }
    }
  }
}

async function moduloUsuarios(): Promise<number> {
  const m = await prisma.modulo.findFirst({ where: { nombre: "usuarios" }, select: { id: true } });
  return m?.id ?? -1;
}

/// Crea un usuario rol 2/3 en el alcance del otorgante. Correo fuera de la transacción.
export async function crearUsuario(otorgante: UsuarioGuardCtx, input: CrearUsuarioInput): Promise<{ usuarioId: number; correoEnviado: boolean }> {
  const nombre = input.nombre?.trim();
  const identificacion = input.identificacion?.trim();
  const correo = input.correo?.trim();
  if (!nombre || !identificacion || !correo) {
    throw new AppError("Nombre, identificación y correo son requeridos", ERROR_CODES.VALIDATION_ERROR, 400);
  }
  if (!esCorreoValido(correo)) throw new AppError("Correo inválido", ERROR_CODES.VALIDATION_ERROR, 400);
  if (input.rolId !== 2 && input.rolId !== 3) {
    throw new AppError("Rol destino inválido (solo 2 o 3)", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  // Alcance (D-015): rol 2 crea SIEMPRE bajo su propio NIT; rol 1 puede indicar empresaNit.
  const nitEmpresa = otorgante.rolId === 1 ? (input.empresaNit?.trim() || null) : otorgante.identificacion;
  if (!nitEmpresa) throw new AppError("Empresa (NIT) requerida", ERROR_CODES.VALIDATION_ERROR, 400);

  const ya = await prisma.usuario.findFirst({ where: { OR: [{ identificacion }, { usuario: identificacion }] } });
  if (ya) throw new AppError("Ya existe un usuario con esa identificación", ERROR_CODES.CONFLICT, 409);

  const permisos = input.permisos ?? [];
  const otorg = await permisosDelOtorgante(otorgante);
  validarSubconjunto(permisos, otorg, await moduloUsuarios(), input.rolId);

  const temporal = generarClaveTemporal();
  const clave = await hashPassword(temporal);

  const usuarioId = await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.create({
      data: {
        nombre,
        usuario: identificacion,
        identificacion,
        clave,
        claveTemporal: true,
        correo,
        rolId: input.rolId,
        administradorId: Number(nitEmpresa),
        estado: true,
        creacion: new Date(),
      },
    });
    await materializarPermisos(tx as unknown as Tx, u.id, permisos);
    return u.id;
  });

  const r = await getCorreo().enviarCorreo({
    para: correo,
    asunto: "Credencial de acceso — SICOV-OTPC",
    texto: `Usuario: ${identificacion}\nClave temporal: ${temporal}\nDeberá cambiarla al iniciar sesión.`,
  });
  return { usuarioId, correoEnviado: r.ok };
}

export interface ActualizarUsuarioInput {
  nombre?: string;
  correo?: string;
  estado?: boolean;
  /// Si se envía, REEMPLAZA los permisos (aplicando B2). Identificación y rol NO editables.
  permisos?: AsignacionModulo[];
}

/// Edita un usuario dentro del alcance del otorgante. Rol 2 solo toca los de su NIT (404 ajeno).
export async function actualizarUsuario(otorgante: UsuarioGuardCtx, id: number, patch: ActualizarUsuarioInput): Promise<void> {
  const objetivo = await prisma.usuario.findUnique({ where: { id } });
  if (!objetivo) throw new AppError("Usuario no encontrado", ERROR_CODES.NOT_FOUND, 404);
  // Alcance D-015: rol 2 no ve/edita usuarios de otro NIT → 404 (sin fuga de existencia).
  if (otorgante.rolId !== 1) {
    const miNit = otorgante.identificacion ? Number(otorgante.identificacion) : null;
    if (objetivo.administradorId !== miNit) throw new AppError("Usuario no encontrado", ERROR_CODES.NOT_FOUND, 404);
  }
  if (patch.correo !== undefined && patch.correo && !esCorreoValido(patch.correo)) {
    throw new AppError("Correo inválido", ERROR_CODES.VALIDATION_ERROR, 400);
  }

  let permisosValidados: AsignacionModulo[] | null = null;
  if (patch.permisos !== undefined) {
    const otorg = await permisosDelOtorgante(otorgante);
    validarSubconjunto(patch.permisos, otorg, await moduloUsuarios(), objetivo.rolId ?? 3);
    permisosValidados = patch.permisos;
  }

  await prisma.$transaction(async (tx) => {
    const data: Prisma.UsuarioUpdateInput = { actualizacion: new Date() };
    if (patch.nombre !== undefined) data.nombre = patch.nombre.trim();
    if (patch.correo !== undefined) data.correo = patch.correo.trim();
    if (patch.estado !== undefined) data.estado = patch.estado;
    await tx.usuario.update({ where: { id }, data });
    if (permisosValidados) await materializarPermisos(tx as unknown as Tx, id, permisosValidados);
  });
}

export interface UsuarioListado {
  id: number;
  nombre: string;
  identificacion: string | null;
  correo: string | null;
  rolId: number | null;
  estado: boolean | null;
}

/// Listado paginado en el alcance: rol 1 ve rol 2/3 de todas las empresas; rol 2 solo su NIT.
export async function listarUsuarios(otorgante: UsuarioGuardCtx, page?: unknown, pageSize?: unknown): Promise<Paginado<UsuarioListado>> {
  const pagina = resolverPagina(page, pageSize);
  const where: Prisma.UsuarioWhereInput =
    otorgante.rolId === 1
      ? { rolId: { in: [2, 3] } }
      : { administradorId: otorgante.identificacion ? Number(otorgante.identificacion) : -1 };
  const [filas, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      orderBy: { id: "desc" },
      skip: pagina.skip,
      take: pagina.take,
      select: { id: true, nombre: true, identificacion: true, correo: true, rolId: true, estado: true },
    }),
    prisma.usuario.count({ where }),
  ]);
  return construirPaginado(filas, total, pagina);
}

export interface SubmoduloAsignable { id: number; nombre: string | null; nombreMostrar: string | null }
export interface ModuloAsignable {
  id: number;
  nombre: string | null;
  nombreMostrar: string | null;
  /// El otorgante puede ceder el módulo COMPLETO (solo si él lo tiene completo o es root).
  puedeCompleto: boolean;
  submodulos: SubmoduloAsignable[];
}

/// Devuelve el árbol de módulos→submódulos que el OTORGANTE puede ceder (techo de la cascada).
/// Se sirve a la UI para pintar los checkboxes anidados — NUNCA se calcula en cliente (D-015).
export async function asignablesDelOtorgante(otorgante: UsuarioGuardCtx): Promise<ModuloAsignable[]> {
  const otorg = await permisosDelOtorgante(otorgante);
  const modulos = await prisma.modulo.findMany({
    where: { estado: true, nombre: { notIn: ["inicio", "configuracion"] } },
    orderBy: { orden: "asc" },
    include: { submodulos: { where: { estado: true }, orderBy: { nombre: "asc" } } },
  });

  const salida: ModuloAsignable[] = [];
  for (const m of modulos) {
    if (!otorg.esRoot && !otorg.modulos.has(m.id)) continue; // no lo tiene → no lo cede
    const completoDisponible = otorg.esRoot || otorg.completos.has(m.id);
    const submodulosPermitidos = m.submodulos.filter((s) => {
      if (completoDisponible) return true;
      return (otorg.submodulosPorModulo.get(m.id) ?? new Set<number>()).has(s.id);
    });
    salida.push({
      id: m.id,
      nombre: m.nombre,
      nombreMostrar: m.nombreMostrar,
      puedeCompleto: completoDisponible,
      submodulos: submodulosPermitidos.map((s) => ({ id: s.id, nombre: s.nombre, nombreMostrar: s.nombreMostrar })),
    });
  }
  return salida;
}

/// Regenera la clave temporal de un usuario del alcance y la reenvía (fuera de transacción).
export async function reenviarCredencialUsuario(otorgante: UsuarioGuardCtx, id: number): Promise<boolean> {
  const objetivo = await prisma.usuario.findUnique({ where: { id } });
  if (!objetivo || !objetivo.correo) throw new AppError("Usuario no encontrado", ERROR_CODES.NOT_FOUND, 404);
  if (otorgante.rolId !== 1) {
    const miNit = otorgante.identificacion ? Number(otorgante.identificacion) : null;
    if (objetivo.administradorId !== miNit) throw new AppError("Usuario no encontrado", ERROR_CODES.NOT_FOUND, 404);
  }
  const temporal = generarClaveTemporal();
  await prisma.usuario.update({
    where: { id },
    data: { clave: await hashPassword(temporal), claveTemporal: true, actualizacion: new Date() },
  });
  const r = await getCorreo().enviarCorreo({
    para: objetivo.correo,
    asunto: "Reenvío de credencial — SICOV-OTPC",
    texto: `Usuario: ${objetivo.identificacion}\nClave temporal: ${temporal}\nDeberá cambiarla al iniciar sesión.`,
  });
  return r.ok;
}
