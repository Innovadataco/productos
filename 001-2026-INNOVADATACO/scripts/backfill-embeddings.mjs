/**
 * Backfill de embeddings (spec 003, US5 / TP-3).
 *
 * ⛔ TRABAJO PESADO (ADR_002): ejecuta inferencia real sobre TODO el histórico.
 * NO correr sin turno aprobado por Jelkin. Un solo modelo grande a la vez en la
 * MacStudio.
 *
 * La lógica vive en src/lib/backfill.ts y src/lib/ingestChunks.ts, probada con
 * mocks. Este script solo cablea el cliente real de Prisma y de embeddings.
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

const { vectorizarDocumento } = await import('../src/lib/ingestChunks.ts');
const { resolverModeloEmbeddings } = await import('../src/lib/ragConfig.ts');
const { embedText } = await import('../src/lib/modelClients.ts');
const { contarPendientes, ejecutarBackfill } = await import('../src/lib/backfill.ts');

async function main() {
  console.log('[Backfill] Resolviendo modelo de embeddings configurado...');
  const modelo = await resolverModeloEmbeddings(prisma);
  console.log(`[Backfill] Modelo: ${modelo.modelPath} · enriquecimiento: ${modelo.enrichConfigHuella}`);

  const pendientes = await contarPendientes(prisma, modelo);
  console.log(`[Backfill] Documentos pendientes de re-vectorizar: ${pendientes}`);
  if (pendientes === 0) {
    console.log('[Backfill] Nada que hacer. El histórico ya está vectorizado con el modelo vigente.');
    return;
  }

  const embed = (t) =>
    embedText({ provider: 'ollama', modelPath: modelo.modelPath, baseUrl: modelo.baseUrl, config: '{}' }, t);

  const resumen = await ejecutarBackfill(
    prisma,
    modelo,
    (doc) => vectorizarDocumento(prisma, doc, modelo, embed),
    (p) => process.stdout.write(`\r[Backfill] procesados=${p.procesados} omitidos=${p.omitidos} fallidos=${p.fallidos} fragmentos=${p.fragmentos}   `),
  );

  console.log('\n[Backfill] Resumen final:', JSON.stringify(resumen));
  const restantes = await contarPendientes(prisma, modelo);
  console.log(`[Backfill] Pendientes tras la pasada: ${restantes}`);
}

main()
  .catch((err) => {
    console.error('\n[Backfill] Error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
