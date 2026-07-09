import { PgBoss } from 'pg-boss';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar variables de entorno
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Importar funciones de los módulos TypeScript
// tsx permite importar archivos .ts directamente
const { extractPdfText, analyzeDocument } = await import('../src/lib/documentProcessor.ts');
const { callModel } = await import('../src/lib/modelClients.ts');
const { buildDocumentAnalysisPrompt, sanitizeJsonText } = await import('../src/lib/prompts.ts');

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

// Función de audit log
async function auditLog(data) {
    try {
        await prisma.auditLog.create({
            data: {
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId,
                status: data.status,
                message: data.message,
                metadata: JSON.stringify(data.metadata || {}),
                latencyMs: data.latencyMs,
                aiModelId: data.aiModelId,
            },
        });
    } catch (e) {
        console.error('[Worker] Audit log error:', e);
    }
}

// Inicializar pg-boss
const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
});

boss.on('error', (error) => {
    console.error('[Worker] pg-boss error:', error);
});

async function processDocument(jobs) {
    // pg-boss v12 pasa jobs como array
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    const documentId = job.data?.documentId || job.documentId;

    if (!documentId) {
        console.error("[Worker] No se encontró documentId en el job:", job);
        throw new Error("documentId no encontrado en el job");
    }
    console.log(`[Worker] Procesando documento ${documentId}`);

    try {
        // Obtener el documento
        const doc = await prisma.documentoOficial.findUnique({
            where: { id: documentId },
        });

        if (!doc) {
            console.error(`[Worker] Documento ${documentId} no encontrado`);
            return;
        }

        console.log(`[Worker] Documento encontrado: ${doc.titulo}`);
        console.log(`[Worker] Texto extraído: ${doc.contenidoTexto?.slice(0, 100)}...`);

        // Actualizar estado a processing
        await prisma.documentoOficial.update({
            where: { id: documentId },
            data: { status: 'processing' },
        });

        await auditLog({
            action: 'process_start',
            entityType: 'DocumentoOficial',
            entityId: documentId,
            status: 'info',
            message: 'Iniciando procesamiento en worker',
        });

        const activeModel = await prisma.aiModel.findFirst({ where: { active: true } });
        let metadata = null;
        let processingError = null;
        let aiModelId = activeModel?.id || undefined;

        if (activeModel) {
            console.log(`[Worker] Usando modelo ${activeModel.name}`);
            const prompt = buildDocumentAnalysisPrompt(doc.contenidoTexto || '');

            console.log(`[Worker] Llamando a callModel con prompt de ${prompt.length} caracteres`);

            const startTime = Date.now();
            const result = await callModel(activeModel, prompt);
            const latencyMs = Date.now() - startTime;

            console.log(`[Worker] Resultado de callModel: ok=${result.ok}, latency=${latencyMs}ms`);

            if (result.ok) {
                try {
                    metadata = JSON.parse(sanitizeJsonText(result.text));
                    console.log(`[Worker] Metadata parseada:`, metadata);
                    await auditLog({
                        action: 'process_end',
                        entityType: 'DocumentoOficial',
                        entityId: documentId,
                        status: 'success',
                        message: 'Procesamiento IA completado',
                        metadata: { usage: result.usage },
                        latencyMs,
                        aiModelId,
                    });
                } catch (err) {
                    processingError = `JSON inválido: ${err.message}`;
                    console.error(`[Worker] Error parseando JSON:`, err);
                    await auditLog({
                        action: 'process_end',
                        entityType: 'DocumentoOficial',
                        entityId: documentId,
                        status: 'error',
                        message: processingError,
                        aiModelId,
                    });
                }
            } else {
                processingError = result.error || 'Modelo no respondió';
                console.error(`[Worker] Error del modelo:`, processingError);
                await auditLog({
                    action: 'process_end',
                    entityType: 'DocumentoOficial',
                    entityId: documentId,
                    status: 'error',
                    message: processingError,
                    latencyMs,
                    aiModelId,
                });
            }
        } else {
            processingError = 'Sin modelo IA activo. Usando extracción por reglas.';
            console.warn(`[Worker] ${processingError}`);
            await auditLog({
                action: 'process_end',
                entityType: 'DocumentoOficial',
                entityId: documentId,
                status: 'error',
                message: processingError,
            });
        }

        // Fallback analysis
        console.log(`[Worker] Ejecutando analyzeDocument...`);
        const fallback = analyzeDocument(doc.contenidoTexto || '');
        console.log(`[Worker] Fallback resultado:`, fallback);

        const final = {
            titulo: metadata?.titulo || fallback.titulo || doc.titulo || 'Sin título',
            sector: metadata?.sector || fallback.sector || doc.sector || 'Otro',
            entidad: metadata?.entidad || fallback.entidad || doc.entidad || 'Otra',
            numero: metadata?.numero || fallback.numero || doc.numero,
            fechaExpedicion: parseDate(metadata?.fecha) || parseDate(fallback.fecha) || doc.fechaExpedicion,
            resumen: metadata?.resumen || fallback.resumen || '',
            proposito: metadata?.proposito || fallback.proposito || '',
            actores: metadata?.actores || fallback.actores || '',
            motivacion: metadata?.motivacion || fallback.motivacion || '',
            resuelve: metadata?.resuelve || fallback.resuelve || '',
            status: processingError ? 'needs_review' : 'completed',
            processingError,
            aiModelId,
        };

        console.log(`[Worker] Actualizando documento con status: ${final.status}`);

        await prisma.documentoOficial.update({
            where: { id: documentId },
            data: final,
        });

        console.log(`[Worker] Documento ${documentId} procesado exitosamente. Status: ${final.status}`);

    } catch (error) {
        console.error(`[Worker] Error procesando documento ${documentId}:`, error);

        await prisma.documentoOficial.update({
            where: { id: documentId },
            data: {
                status: 'needs_review',
                processingError: error.message || 'Error desconocido en worker',
            },
        });

        await auditLog({
            action: 'process_end',
            entityType: 'DocumentoOficial',
            entityId: documentId,
            status: 'error',
            message: error.message || 'Error desconocido en worker',
        });

        // Re-lanzar el error para que pg-boss lo maneje
        throw error;
    }
}

async function start() {
    console.log('[Worker] Iniciando worker de documentos...');
    console.log('[Worker] DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'NO CONFIGURADA');

    await boss.start();
    console.log('[Worker] pg-boss iniciado');

    // Crear la cola si no existe
    await boss.createQueue('process-document');
    console.log('[Worker] Cola process-document lista');

    // Suscribirse a trabajos
    await boss.work('process-document', processDocument);
    console.log('[Worker] Worker suscrito a process-document');
    console.log('[Worker] Listo para procesar documentos!');
}

start().catch((err) => {
    console.error('[Worker] Error iniciando:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM recibido, cerrando...');
    await boss.stop();
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Worker] SIGINT recibido, cerrando...');
    await boss.stop();
    await prisma.$disconnect();
    process.exit(0);
});