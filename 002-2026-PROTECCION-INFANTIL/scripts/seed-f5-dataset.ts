#!/usr/bin/env tsx
/**
 * Siembra manual de ejemplos para F5 (RAG) en las 3 fronteras críticas.
 * Textos originales, no copiados ni parafraseados del fixture de 110.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/seed-f5-dataset.ts
 */
import { prisma } from "@/lib/prisma";
import { generarEmbedding } from "@/lib/ai/embedder";

interface SeedExample {
    texto: string;
    categoria: string;
}

const SEED_EXAMPLES: SeedExample[] = [
    // Frontera 1: DIFUSION_NO_CONSENTIDA (vs COMPARTIMIENTO_SEXUAL)
    {
        texto: "un compañero del colegio pasó por el chat una foto íntima mía que yo solo le había enviado a él",
        categoria: "DIFUSION_NO_CONSENTIDA",
    },
    {
        texto: "alguien subió a un grupo de whatsapp una imagen sin ropa de una amiga sin que ella supiera",
        categoria: "DIFUSION_NO_CONSENTIDA",
    },
    {
        texto: "están reenviando un video privado mío por instagram y no dije que lo compartieran",
        categoria: "DIFUSION_NO_CONSENTIDA",
    },
    {
        texto: "un chico del curso le mostró a todos una foto mía en ropa interior que yo le mandé",
        categoria: "DIFUSION_NO_CONSENTIDA",
    },
    {
        texto: "publicaron en un foro una captura de pantalla de un chat privado con fotos desnudas",
        categoria: "DIFUSION_NO_CONSENTIDA",
    },

    // Frontera 2: SOLICITUD_MATERIAL (vs EXTORSION)
    {
        texto: "me escribió por snapchat pidiéndome fotos en ropa interior y no para de insistir",
        categoria: "SOLICITUD_MATERIAL",
    },
    {
        texto: "una persona en discord me pide videos míos desvestida a cambio de nada, solo para verlos",
        categoria: "SOLICITUD_MATERIAL",
    },
    {
        texto: "me dijo por privado que le mande fotos desnudas y que si no, no pasa nada, pero sigue pidiendo",
        categoria: "SOLICITUD_MATERIAL",
    },
    {
        texto: "en el chat de instagram me pide fotos íntimas una y otra vez",
        categoria: "SOLICITUD_MATERIAL",
    },
    {
        texto: "me envía mensajes todos los días pidiendo fotos mías sin ropa",
        categoria: "SOLICITUD_MATERIAL",
    },

    // Frontera 3: CONTACTO_INSISTENTE (vs OTRO)
    {
        texto: "una compañera me escribe a toda hora del día y se enoja si no le respondo enseguida",
        categoria: "CONTACTO_INSISTENTE",
    },
    {
        texto: "me manda mensajes cada cinco minutos por whatsapp y me llama obsesivamente",
        categoria: "CONTACTO_INSISTENTE",
    },
    {
        texto: "me escribe por la noche y madrugada aunque le dije que no quiero hablar",
        categoria: "CONTACTO_INSISTENTE",
    },
    {
        texto: "no para de enviarme solicitudes de amistad y mensajes en todas las redes",
        categoria: "CONTACTO_INSISTENTE",
    },
    {
        texto: "me sigue enviando mensajes desde números diferentes aunque lo bloqueo",
        categoria: "CONTACTO_INSISTENTE",
    },
];

const MODELO_EMBEDDING = "nomic-embed-text";
const VERBOSE = process.argv.includes("--verbose");

async function main() {
    let insertados = 0;
    let existentes = 0;

    for (const ex of SEED_EXAMPLES) {
        const existente = await prisma.datasetEntrenamiento.findFirst({
            where: { texto: ex.texto },
        });
        if (existente) {
            existentes++;
            if (VERBOSE) {
                console.log(`[seed-f5] Ya existe: ${ex.categoria}`);
            }
            continue;
        }

        const vector = await generarEmbedding(MODELO_EMBEDDING, ex.texto);
        const vectorStr = "[" + vector.join(",") + "]";

        const datasetRegistro = await prisma.datasetEntrenamiento.create({
            data: {
                texto: ex.texto,
                clasificacionCorrecta: ex.categoria as import("@prisma/client").CategoriaConducta,
                fuente: "siembra",
                textoAnonimizado: false,
            },
        });

        await prisma.$executeRaw`
            INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
            VALUES (${crypto.randomUUID()}, ${datasetRegistro.id}, ${vectorStr}::vector, ${MODELO_EMBEDDING}, NOW())
        `;

        insertados++;
        if (VERBOSE) {
            console.log(`[seed-f5] Insertado ${ex.categoria}: "${ex.texto.slice(0, 50)}..."`);
        }
    }

    console.log(`\n[seed-f5] Total: ${insertados} insertados, ${existentes} ya existentes.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
