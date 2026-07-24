import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiError, noAutenticado } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { validarPartidas, construirDatosPartidas } from "@/lib/oportunidad";
import { leerPaginacion, respuestaPaginada } from "@/lib/paginacion";

// GET /api/licitaciones - Listar oportunidades
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado");
    const entidad = searchParams.get("entidad");
    const tipo = searchParams.get("tipo");
    const busqueda = searchParams.get("q");

    const where: Prisma.LicitacionWhereInput = {};

    if (estado) where.estado = { key: estado };
    if (entidad) where.entidadId = parseInt(entidad);
    if (tipo) where.tipo = { key: tipo };

    if (busqueda) {
      where.OR = [
        { numero: { contains: busqueda, mode: "insensitive" } },
        { titulo: { contains: busqueda, mode: "insensitive" } },
        { descripcion: { contains: busqueda, mode: "insensitive" } },
      ];
    }

    // Paginación estándar (§3.3, spec 009): la lista de oportunidades puede
    // crecer sin techo y hasta ahora devolvía todo en cada carga.
    const { page, pageSize, skip } = leerPaginacion(searchParams);

    const [oportunidades, total] = await Promise.all([
      prisma.licitacion.findMany({
        where,
        include: {
          estado: true,
          entidad: true,
          tipo: true,
          partidas: true,
          documentos: {
            select: { id: true, nombre: true, tipo: true, fechaInicio: true, fechaFin: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.licitacion.count({ where }),
    ]);

    // El total del presupuesto se calcula al leer (FR-008): suma de las partidas.
    const conTotal = oportunidades.map((op) => ({
      ...op,
      totalPresupuesto: op.partidas.reduce((acc, p) => acc + Number(p.monto), 0),
    }));

    return NextResponse.json(respuestaPaginada(conTotal, total, page, pageSize));
  } catch (error: unknown) {
    return apiError("Oportunidades", "GET lista", "Error al obtener oportunidades", 500, error);
  }
}

// POST /api/licitaciones - Crear una oportunidad
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const data = await req.json();
    const {
      numero,
      titulo,
      descripcion,
      estadoId,
      entidadId,
      tipoId,
      areaIdSala,
      fechaApertura,
      fechaPliegosDefinitivos,
      fechaEntregaPropuesta,
      fechaAdjudicacion,
      fechaCierre,
      ciudadEjecucion,
      documentoUrl,
      partidas,
    } = data;

    // Requisitos comunes: título, tipo y estado.
    if (!titulo || !tipoId || !estadoId) {
      return NextResponse.json(
        { error: "Título, tipo y estado son requeridos" },
        { status: 400 }
      );
    }

    // La obligatoriedad de numero/fechaApertura la fija el TIPO (banderas
    // configurables), no un if por nombre (§0.7, FR-003).
    const tipo = await prisma.tipoOportunidad.findUnique({ where: { id: parseInt(tipoId) } });
    if (!tipo) {
      return NextResponse.json({ error: "Tipo de oportunidad no encontrado" }, { status: 400 });
    }
    if (tipo.exigeNumero && !numero) {
      return NextResponse.json(
        { error: `El tipo "${tipo.nombreOficial}" requiere número` },
        { status: 400 }
      );
    }
    if (tipo.exigeFechaApertura && !fechaApertura) {
      return NextResponse.json(
        { error: `El tipo "${tipo.nombreOficial}" requiere fecha de apertura` },
        { status: 400 }
      );
    }

    const errorPartidas = validarPartidas(partidas);
    if (errorPartidas) return NextResponse.json({ error: errorPartidas }, { status: 400 });

    const oportunidad = await prisma.licitacion.create({
      data: {
        numero: numero || null,
        titulo,
        descripcion: descripcion || "",
        estadoId: parseInt(estadoId),
        tipoId: parseInt(tipoId),
        entidadId: entidadId ? parseInt(entidadId) : null,
        areaIdSala: areaIdSala ? parseInt(areaIdSala) : null,
        fechaApertura: fechaApertura ? new Date(fechaApertura) : null,
        fechaPliegosDefinitivos: fechaPliegosDefinitivos ? new Date(fechaPliegosDefinitivos) : null,
        fechaEntregaPropuesta: fechaEntregaPropuesta ? new Date(fechaEntregaPropuesta) : null,
        fechaAdjudicacion: fechaAdjudicacion ? new Date(fechaAdjudicacion) : null,
        fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
        ciudadEjecucion: ciudadEjecucion || null,
        documentoUrl: documentoUrl || null,
        partidas: construirDatosPartidas(partidas),
      },
      include: { estado: true, entidad: true, tipo: true, partidas: true },
    });

    return NextResponse.json(oportunidad, { status: 201 });
  } catch (error: unknown) {
    return apiError("Oportunidades", "POST crear", "Error al crear oportunidad", 500, error);
  }
}
