import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";

export interface ContextoEfectivo {
  tokenAutorizado: string; // cabecera `token`
  nitVigilado: string; // cabecera `documento`
  usuarioId: number;
}

/// Resuelve el contexto efectivo del vigilado (paridad obtenerDatosAutenticacionUsuario).
/// Si idRol === 3, hereda tokenAutorizado + identificación (NIT) del administrador,
/// buscándolo por `usn_identificacion == usuario.usn_administrador` (join lógico por identificación).
export async function resolverContextoEfectivo(
  identificacion: string,
  idRol: number,
): Promise<ContextoEfectivo> {
  const usuario = await prisma.usuario.findFirst({ where: { identificacion } });
  if (!usuario) throw new AppError("Usuario no encontrado", ERROR_CODES.NOT_FOUND, 404);

  let tokenAutorizado: string;
  let nitVigilado: string;
  let usuarioId: number;

  if (idRol === 3) {
    if (usuario.administradorId == null) {
      throw new AppError("Usuario administrador no encontrado", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const admin = await prisma.usuario.findFirst({
      where: { identificacion: String(usuario.administradorId) },
    });
    if (!admin) {
      throw new AppError("Usuario administrador no encontrado", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    tokenAutorizado = admin.tokenAutorizado ?? "";
    nitVigilado = String(admin.identificacion ?? usuario.administradorId);
    usuarioId = admin.id;
  } else {
    tokenAutorizado = usuario.tokenAutorizado ?? "";
    nitVigilado = String(usuario.identificacion ?? "");
    usuarioId = usuario.id;
  }

  if (!tokenAutorizado.trim()) {
    throw new AppError(
      "Token de autorización no encontrado. Contacte al administrador.",
      ERROR_CODES.VALIDATION_ERROR,
      400,
    );
  }
  if (!nitVigilado.trim()) {
    throw new AppError(
      "No se pudo determinar el vigilado asociado al usuario",
      ERROR_CODES.VALIDATION_ERROR,
      400,
    );
  }
  return { tokenAutorizado, nitVigilado, usuarioId };
}
