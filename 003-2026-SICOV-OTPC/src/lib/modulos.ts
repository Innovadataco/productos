import { prisma } from "@/lib/prisma";

export interface ModuloDto {
  id: number;
  nombre: string | null;
  nombreMostrar: string | null;
  ruta: string | null;
  icono: string | null;
  orden: number | null;
}

/// Módulos habilitados del usuario para el menú data-driven.
/// Prioriza los personalizados (tbl_usuarios_modulos); si no tiene, cae a los del rol.
export async function cargarModulos(usuarioId: number, rolId: number | null): Promise<ModuloDto[]> {
  const propios = await prisma.usuarioModulo.findMany({
    where: { usuarioId, estado: true },
    include: { modulo: true },
  });

  let modulos = propios.map((p) => p.modulo).filter((m): m is NonNullable<typeof m> => m !== null);

  if (modulos.length === 0 && rolId != null) {
    const delRol = await prisma.rolModulo.findMany({
      where: { rolId },
      include: { modulo: true },
    });
    modulos = delRol.map((r) => r.modulo).filter((m): m is NonNullable<typeof m> => m !== null);
  }

  return modulos
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      nombreMostrar: m.nombreMostrar,
      ruta: m.ruta,
      icono: m.icono,
      orden: m.orden,
    }))
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

export interface SubmoduloDto {
  id: number;
  nombre: string | null;
  nombreMostrar: string | null;
  moduloNombre: string | null;
}

/// Submódulos PUNTUALES asignados al usuario (filas de `UsuarioModulo` con `submoduloId` no nulo).
/// Una lista vacía para un módulo significa "módulo completo" (fila NULL) — lo interpreta el guard.
/// Usada por `requiereModulo(modulo, submodulo?)` y por el menú/UI de permisos.
export async function cargarSubmodulos(usuarioId: number): Promise<SubmoduloDto[]> {
  const filas = await prisma.usuarioModulo.findMany({
    where: { usuarioId, estado: true, submoduloId: { not: null } },
    include: { submodulo: { include: { modulo: true } } },
  });

  return filas
    .map((f) => f.submodulo)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      nombreMostrar: s.nombreMostrar,
      moduloNombre: s.modulo?.nombre ?? null,
    }));
}
