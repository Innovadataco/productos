import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { guardarArchivo, leerArchivo } from "@/lib/almacenamiento";
import { resolverContextoEfectivo } from "@/lib/integracion/contexto-usuario";
import { TIPOS_OPERABLES, type TipoOperable } from "@/lib/mantenimientos/tipos";

/// PDF del PROGRAMA de mantenimiento (US6 / §10.2 del manual): lo gestiona el CLIENTE (rol 2) —
/// el operador no. Solo PDF, máx 4 MB (413), y **el último cargado queda ACTIVO desactivando los
/// anteriores** del mismo vigilado+tipo. Binarios tras la interfaz de almacenamiento (D-022 #2).
/// El "dueño" del programa es el usuario EFECTIVO (rol 3 heredaría el del admin — D-015), aunque
/// la subida está restringida a roles 1-2 en la ruta.

export const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB (constitución §4.4)

function validarTipo(tipoId: unknown): TipoOperable {
  const n = Number(tipoId);
  if (!TIPOS_OPERABLES.includes(n as TipoOperable)) {
    throw new AppError("El tipoId no es valido (1=preventivo, 2=correctivo)", ERROR_CODES.VALIDATION_ERROR, 400);
  }
  return n as TipoOperable;
}

/// Resuelve el id de usuario dueño según el alcance D-015 (rol 1 puede indicar vigiladoId).
async function usuarioAlcance(
  usuario: { id: number; identificacion: string | null; rolId: number | null },
  vigiladoIdParam?: string | null,
): Promise<number | null> {
  if (usuario.rolId === 1) {
    if (!vigiladoIdParam?.trim()) return null; // rol 1 sin filtro: todas las empresas
    const dueno = await prisma.usuario.findFirst({ where: { identificacion: vigiladoIdParam.trim() } });
    if (!dueno) throw new AppError("Vigilado no encontrado", ERROR_CODES.NOT_FOUND, 404);
    return dueno.id;
  }
  const contexto = await resolverContextoEfectivo(usuario.identificacion ?? "", usuario.rolId ?? 0);
  return contexto.usuarioId;
}

export async function subirPrograma(
  datos: { tipoId: unknown; nombreOriginal: string; contentType: string; tamano: number; buffer: Buffer },
  usuario: { id: number; identificacion: string | null; rolId: number | null },
): Promise<{ id: number; nombreOriginal: string | null; tipoId: number | null; creado: Date | null }> {
  const tipoId = validarTipo(datos.tipoId);
  const nombre = datos.nombreOriginal.toLowerCase();
  const ct = datos.contentType.toLowerCase();
  const esPdf = nombre.endsWith(".pdf") && (ct === "" || ct.includes("pdf") || ct === "application/octet-stream");
  if (!esPdf) {
    throw new AppError("El archivo debe ser un PDF", ERROR_CODES.VALIDATION_ERROR, 400);
  }
  if (datos.tamano > MAX_PDF_BYTES) {
    throw new AppError("El PDF supera el tamaño máximo de 4 MB", ERROR_CODES.VALIDATION_ERROR, 413);
  }

  const duenoId = (await usuarioAlcance(usuario)) ?? usuario.id;
  const guardado = await guardarArchivo("programas", datos.nombreOriginal, datos.buffer);

  // §10.2: el último cargado queda ACTIVO — desactiva los anteriores del mismo vigilado+tipo.
  await prisma.archivoPrograma.updateMany({
    where: { usuarioId: duenoId, tipoId },
    data: { estado: false, actualizado: new Date() },
  });
  const creado = await prisma.archivoPrograma.create({
    data: {
      nombreOriginal: datos.nombreOriginal.slice(0, 200),
      documento: guardado.documento,
      ruta: guardado.ruta,
      tipoId,
      usuarioId: duenoId,
      estado: true,
    },
  });
  return { id: creado.id, nombreOriginal: creado.nombreOriginal, tipoId: creado.tipoId, creado: creado.creado };
}

export async function listarProgramas(
  tipoId: unknown,
  usuario: { id: number; identificacion: string | null; rolId: number | null },
  vigiladoIdParam?: string | null,
) {
  const tipo = validarTipo(tipoId);
  const duenoId = await usuarioAlcance(usuario, vigiladoIdParam);
  const archivos = await prisma.archivoPrograma.findMany({
    where: { tipoId: tipo, ...(duenoId != null ? { usuarioId: duenoId } : {}) },
    orderBy: [{ estado: "desc" }, { id: "desc" }], // el activo primero
  });
  return archivos.map((a) => ({
    id: a.id,
    nombreOriginal: a.nombreOriginal,
    documento: a.documento,
    ruta: a.ruta,
    fecha: a.creado,
    estado: a.estado,
  }));
}

export async function leerPrograma(
  id: number,
  usuario: { id: number; identificacion: string | null; rolId: number | null },
): Promise<{ nombreOriginal: string; buffer: Buffer }> {
  const archivo = await prisma.archivoPrograma.findUnique({ where: { id } });
  const duenoId = await usuarioAlcance(usuario, null);
  if (!archivo || !archivo.ruta || (duenoId != null && archivo.usuarioId !== duenoId)) {
    throw new AppError("Archivo no encontrado", ERROR_CODES.NOT_FOUND, 404);
  }
  const buffer = await leerArchivo(archivo.ruta);
  return { nombreOriginal: archivo.nombreOriginal ?? "programa.pdf", buffer };
}
