import { NextRequest, NextResponse } from "next/server";
import { detalleDeError, noAutenticado } from "@/lib/apiError";
import type { PgBoss } from "pg-boss";
import { Prisma } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/documentProcessor";
import { auditLog } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { leerPaginacion, respuestaPaginada } from "@/lib/paginacion";
import { nombreDeArchivo, validaArchivo } from "@/lib/subidaArchivos";
import { conReintento } from "@/lib/reintento";
import { evaluarIndexabilidad } from "@/lib/indexabilidad";

const TIPO_JERARQUIA: Record<string, number> = {
  constitucion: 1,
  ley: 2,
  decreto: 3,
  resolucion: 4,
  circular: 5,
  otro: 9,
};

// Singleton de pg-boss usando promesa para evitar condición de carrera
let bossPromise: Promise<PgBoss> | null = null;

async function getBoss() {
  if (!bossPromise) {
    bossPromise = (async () => {
      const { PgBoss } = await import("pg-boss");
      const instance = new PgBoss({
        connectionString: process.env.DATABASE_URL,
      });
      await instance.start();
      return instance;
    })();
  }
  return bossPromise;
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const tipo = (form.get("tipo") as string) || "otro";
    const sector = (form.get("sector") as string) || "";
    const entidad = (form.get("entidad") as string) || "";
    const titulo = (form.get("titulo") as string) || "";
    // OJO (hallazgo de la auditoría de deuda, spec 009): el formulario también
    // envía `numero` y `fechaExpedicion`, y esta ruta los leía sin persistirlos
    // nunca — se perdían en silencio. Se retira la lectura muerta para no
    // fingir que se usan; **persistirlos es un cambio de comportamiento** sobre
    // Base Oficial (¿pisa el worker lo que escribe el usuario?) y queda
    // reportado para que lo decida ZEUS, no resuelto a ciegas de madrugada.
    const padreId = (form.get("padreId") as string) || null;

    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

    // Validación de tipo y tamaño (§2.6). La constitución nombra ESTE archivo
    // como el sitio donde hacerla y no se hacía: se aceptaba cualquier fichero,
    // de cualquier tamaño. La UI ya solo ofrece .pdf, así que esto no cierra
    // ninguna puerta que estuviera en uso.
    const problema = validaArchivo(file, [".pdf"], "Solo se admiten archivos PDF");
    if (problema) {
      return NextResponse.json({ error: problema.error }, { status: problema.status });
    }

    // Extraer texto del PDF
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let texto = "";
    let extractionError: string | null = null;
    const fallosDeExtraccion: string[] = [];
    try {
      // Se reintenta (spec 013, FR-001). Esta extracción ocurre DENTRO de la
      // petición y, si falla, el documento nunca se encola: los reintentos de la
      // cola no llegan a aplicarse jamás y un Timeout pasajero condenaba el
      // documento para siempre. Intentos cortos: hay un usuario esperando.
      texto = await conReintento(() => extractPdfText(buffer), {
        intentos: 3,
        esperaMs: 500,
        alFallar: (intento, err) => {
          const detalle = detalleDeError(err);
          fallosDeExtraccion.push(`intento ${intento}: ${detalle}`);
          console.warn(`[Documentos] Extracción de PDF: intento ${intento} falló — ${detalle}`);
        },
      });
    } catch (err: unknown) {
      extractionError = detalleDeError(err);
      console.warn("[Documentos] Extracción de PDF: agotados los reintentos —", extractionError);
    }

    // Guardar archivo
    const uploadDir = join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });
    // Nombre saneado (§5.3): antes se concatenaba `file.name` crudo y se escribía
    // con join(), así que un nombre con "../" habría escrito fuera de uploads/.
    const fileName = nombreDeArchivo(file.name, Date.now());
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Determinar estado inicial
    const initialStatus = extractionError ? "needs_review" : "queued";

    // Crear documento en BD con estado "queued"
    const doc = await prisma.documentoOficial.create({
      data: {
        titulo: titulo || file.name.replace(/\.pdf$/i, ""),
        tipo,
        entidad: entidad || "Pendiente",
        sector: sector || "Otro",
        archivoUrl: `/uploads/${fileName}`,
        contenidoTexto: texto,
        status: initialStatus,
        processingError: extractionError,
        jerarquiaNivel: TIPO_JERARQUIA[tipo] ?? 9,
        padreId,
        aiModelId: null,
      },
    });

    await auditLog({
      action: "upload_pdf",
      entityType: "DocumentoOficial",
      entityId: doc.id,
      status: extractionError ? "error" : "info",
      message: extractionError || "PDF subido, encolado para procesamiento",
      // Cuántos reintentos hubo y con qué se falló (spec 013, FR-005). Si la
      // extracción salió a la segunda, aquí queda el rastro de que costó.
      metadata: fallosDeExtraccion.length > 0 ? { reintentos: fallosDeExtraccion } : undefined,
    });

    // Si hubo error de extracción, no encolar - ya está en needs_review
    if (!extractionError) {
      try {
        const bossInstance = await getBoss();
        await bossInstance.send("process-document", { documentId: doc.id });
        console.log(`[API] Documento ${doc.id} encolado para procesamiento`);
      } catch (queueError) {
        console.error("[API] Error encolando documento:", queueError);
        // Actualizar a needs_review si no se pudo encolar
        await prisma.documentoOficial.update({
          where: { id: doc.id },
          data: { status: "needs_review", processingError: "Error encolando para procesamiento" },
        });
      }
    }

    // Responder INMEDIATAMENTE con el documento creado
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error(err);
    await auditLog({ action: "upload_pdf", entityType: "DocumentoOficial", status: "error", message: "Error procesando documento" });
    return NextResponse.json({ error: "Error procesando documento" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return noAutenticado();

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const status = searchParams.get("status");

    const where: Prisma.DocumentoOficialWhereInput = includeInactive ? {} : { activo: true };
    if (status) {
      where.status = status;
    }

    // Paginación estándar (§3.3, spec 009): Base Oficial crece con cada carga
    // documental y esta lista las devolvía todas.
    const { page, pageSize, skip } = leerPaginacion(searchParams);

    const [docs, total] = await Promise.all([
      prisma.documentoOficial.findMany({
        where,
        orderBy: [{ jerarquiaNivel: "asc" }, { fechaExpedicion: "desc" }],
        include: {
          padre: { select: { id: true, titulo: true, tipo: true } },
          // El número de fragmentos es el hecho del que se deriva si el
          // documento se puede encontrar (spec 013, FR-002).
          _count: { select: { chunks: true } },
        },
        skip,
        take: pageSize,
      }),
      prisma.documentoOficial.count({ where }),
    ]);

    // Se calcula al leer y no se guarda (RZ-2): un campo persistido se
    // desincronizaría el día que se borrara un fragmento.
    const conIndexabilidad = docs.map((doc) => ({
      ...doc,
      indexabilidad: evaluarIndexabilidad({
        status: doc.status,
        contenidoTexto: doc.contenidoTexto,
        processingError: doc.processingError,
        chunks: doc._count?.chunks ?? 0,
      }),
    }));

    return NextResponse.json(respuestaPaginada(conIndexabilidad, total, page, pageSize));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error listando documentos" }, { status: 500 });
  }
}

// Campos editables permitidos en PATCH
const EDITABLE_FIELDS = [
  "titulo",
  "tipo",
  "entidad",
  "sector",
  "numero",
  "fechaExpedicion",
  "resumen",
  "proposito",
  "actores",
  "motivacion",
  "resuelve",
  "status",
];

function parseDateSafe(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  try {
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await verifyAuth();
    if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    // Whitelist: solo permitir campos editables
    const data: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        if (key === "fechaExpedicion") {
          data[key] = parseDateSafe(body[key]);
        } else {
          data[key] = body[key];
        }
      }
    }

    const updated = await prisma.documentoOficial.update({ where: { id }, data });
    await auditLog({ action: "update_document", entityType: "DocumentoOficial", entityId: id, status: "success", message: "Documento actualizado", metadata: data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error actualizando documento" }, { status: 500 });
  }
}
