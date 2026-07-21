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
