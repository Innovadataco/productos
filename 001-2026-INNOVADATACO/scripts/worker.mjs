import pgBoss from 'pg-boss';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar variables de entorno
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Importar funciones necesarias (usando dynamic import para los módulos TS)
const { extractPdfText, analyzeDocument } = await import('../src/lib/documentProcessor.ts').catch(() => ({
    extractPdfText: async () => '',
    analyzeDocument: (text) => ({
        titulo: 'Sin título',
        entidad: 'Otra',
        sector: 'Otro',
        numero: '',
        fecha: null,
        resumen: text.slice(0, 500),
        proposito: '',
        actores: '',
        motivacion: '',
        resuelve: ''
    })
}));

const { callModel } = await import('../src/lib/modelClients.ts').catch(() => ({
    callModel: async () => ({ ok: false, error: 'Modelo no disponible' })
}));

const { buildDocumentAnalysisPrompt, sanitizeJsonText } = await import('../src/lib/prompts.ts').catch(() => ({
    buildDocumentAnalysisPrompt: (text) => `Analiza: ${text.slice(0, 1000)}`,
    sanitizeJsonText: (text) => text
}));

// Función de audit log simplificada
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
            }
        });
    } catch (e) {
        console.error('Audit log error:', e);
    }
}

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

const TIPO_JERARQUIA = {
    constitucion: 1,
    ley: 2,
    decreto: 3,
    resolucion: 4,
    circular: 5,
    otro: 9,
};

// Inicializar pg-boss
const boss = new pgBoss({
    connectionString: process.env.DATABASE_URL,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
});

boss.on('error', (error) => {
    console.error('pg-boss error:', error);
});

async function processDocument(job) {
    const { documentId } = job.data;
    console.log(`[Worker] Procesando documento ${documentId}`);

    try {
        // Obtener el documento
        const doc = await prisma.documentoOficial.findUnique({
            where: { id: documentId }
        });

        if (!doc) {
            console.error(`[Worker] Documento ${documentId} no encontrado`);
            return;
        }

        // Actualizar estado a processing
        await prisma.documentoOficial.update({
            where: { id: documentId },
            data: { status: 'processing' }
        });

        await auditLog({
            action: 'process_start',
            entityType: 'DocumentoOficial',
            entityId: documentId,
            status: 'info',
            message: 'Iniciando procesamiento en worker'
        });

        const activeModel = await prisma.aiModel.findFirst({ where: { active: true } });
        let metadata = null;
        let processingError = null;
        let aiModelId = activeModel?.id || undefined;

        if (activeModel) {
            console.log(`[Worker] Usando modelo ${activeModel.name}`);
            const prompt = buildDocumentAnalysisPrompt(doc.contenidoTexto || '');

            const startTime = Date.now();
            const result = await callModel(activeModel, prompt);
            const latencyMs = Date.now() - startTime;

            if (result.ok) {
                try {
                    metadata = JSON.parse(sanitizeJsonText(result.text));
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
                    await auditLog({
                        action: 'process_end',
                        entityType: 'DocumentoOficial',
                        entityId: documentId,
                        status: 'error',
                        message: processingError,
                        aiModelId
                    });
                }
            } else {
                processingError = result.error || 'Modelo no respondió';
                await auditLog({
                    action: 'process_end',
                    entityType: 'DocumentoOficial',
                    entityId: documentId,
                    status: 'error',
                    message: processingError,
                    latencyMs,
                    aiModelId
                });
            }
        } else {
            processingError = 'Sin modelo IA activo. Usando extracción por reglas.';
            await auditLog({
                action: 'process_end',
                entityType: 'DocumentoOficial',
                entityId: documentId,
                status: 'error',
                message: processingError
            });
        }

        // Fallback analysis
        const fallback = analyzeDocument(doc.contenidoTexto || '');

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

        await prisma.documentoOficial.update({
            where: { id: documentId },
            data: final
        });

        console.log(`[Worker] Documento ${documentId} procesado. Status: ${final.status}`);

    } catch (error) {
        console.error(`[Worker] Error procesando documento ${documentId}:`, error);

        await prisma.documentoOficial.update({
            where: { id: documentId },
            data: {
                status: 'needs_review',
                processingError: error.message || 'Error desconocido en worker'
            }
        });

        await auditLog({
            action: 'process_end',
            entityType: 'DocumentoOficial',
            entityId: documentId,
            status: 'error',
            message: error.message || 'Error desconocido en worker'
        });
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

start().catch(err => {
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