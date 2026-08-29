/**
 * Reprocesa la INGESTA de un documento ya subido (spec 013, B0.2 del radicado 015).
 *
 * El reintento de la spec 013 actúa en la subida; esto actúa sobre lo que ya
 * quedó roto en la BD. Vuelve a leer el PDF con reintento y:
 *   - si extrae texto: lo guarda y lo encola para vectorización (queda indexable);
 *   - si NO extrae: deja el documento en `needs_review` con su motivo — que es
 *     justo lo que la indexabilidad derivada muestra como "No buscable" (FR-002).
 *
 * En ambos casos deja rastro en auditoría (FR-005). NO borra ni pisa datos: solo
 * toca el documento indicado.
 *
 * Uso:  npx tsx scripts/reprocesar-documento.mjs <documentId>
 */
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env.local") });
config({ path: join(__dirname, "../.env") });

const { extractPdfText } = await import("../src/lib/documentProcessor.ts");
const { conReintento } = await import("../src/lib/reintento.ts");

const documentId = process.argv[2];
if (!documentId) {
  console.error("Uso: npx tsx scripts/reprocesar-documento.mjs <documentId>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function auditar(datos) {
  try {
    await prisma.auditLog.create({
      data: {
        action: datos.action,
        entityType: "DocumentoOficial",
        entityId: documentId,
        status: datos.status,
        message: datos.message,
        metadata: JSON.stringify(datos.metadata || {}),
      },
    });
  } catch (e) {
    console.error("[Reproceso] Audit error:", e.message);
  }
}

try {
  const doc = await prisma.documentoOficial.findUnique({ where: { id: documentId } });
  if (!doc) {
    console.error(`[Reproceso] Documento ${documentId} no encontrado`);
    process.exit(1);
  }
  console.log(`[Reproceso] ${doc.titulo}`);
  console.log(`[Reproceso] Estado actual: ${doc.status}, ${doc.contenidoTexto?.length || 0} chars`);

  // El archivoUrl es "/uploads/....pdf"; el fichero vive en uploads/.
  const rutaFichero = join(__dirname, "..", doc.archivoUrl.replace(/^\//, ""));
  const buffer = await readFile(rutaFichero);
  console.log(`[Reproceso] Fichero leído: ${buffer.length} bytes`);

  const fallos = [];
  let texto = "";
  let errorFinal = null;
  try {
    texto = await conReintento(() => extractPdfText(buffer), {
      intentos: 3,
      esperaMs: 500,
      alFallar: (intento, err) => {
        const detalle = err instanceof Error ? err.message : String(err);
        fallos.push(`intento ${intento}: ${detalle}`);
        console.log(`[Reproceso] intento ${intento} falló — ${detalle}`);
      },
    });
  } catch (err) {
    errorFinal = err instanceof Error ? err.message : String(err);
  }

  if (texto && texto.trim() !== "") {
    // Extracción recuperada: guardar texto y encolar para vectorización.
    await prisma.documentoOficial.update({
      where: { id: documentId },
      data: { contenidoTexto: texto, status: "queued", processingError: null },
    });
    const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
    await boss.start();
    await boss.send("process-document", { documentId });
    await boss.stop();
    await auditar({
      action: "reproceso_ingesta",
      status: "success",
      message: `Reproceso: texto recuperado (${texto.length} chars), encolado para indexar`,
      metadata: { reintentos: fallos },
    });
    console.log(`[Reproceso] RECUPERADO: ${texto.length} chars. Encolado.`);
  } else {
    // Genuinamente no legible: se mantiene marcado como no buscable.
    await prisma.documentoOficial.update({
      where: { id: documentId },
      data: { status: "needs_review", processingError: errorFinal || "Sin texto extraíble" },
    });
    await auditar({
      action: "reproceso_ingesta",
      status: "error",
      message: `Reproceso: el PDF sigue sin poder leerse — ${errorFinal}. Queda marcado como no buscable.`,
      metadata: { reintentos: fallos },
    });
    console.log(`[Reproceso] NO LEGIBLE: ${errorFinal}. Queda marcado "No buscable" con motivo.`);
  }
} finally {
  await prisma.$disconnect();
}
