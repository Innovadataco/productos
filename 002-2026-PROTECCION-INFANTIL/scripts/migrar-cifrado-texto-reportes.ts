/**
 * SPEC-130 (BL-4, O-4) — Migración: cifra en reposo los textos históricos de Reporte.
 *
 * - `texto` en claro → cifrado GCM (idempotente: los ya cifrados y el marcador de
 *   purga se saltan; segunda corrida = 0 cambios).
 * - `textoOriginal` NULL (reportes pre-SPEC-110) → se puebla cifrando el texto plano
 *   original (la evidencia NUNCA se altera: mismo contenido al descifrar).
 * - Nunca reescribe un `textoOriginal` existente. Por lotes de 500. No borra nada.
 *
 * O-4: DEV primero (conteos verificables). PROD NO se corre hasta que el CEO
 * confirme BL-2 (llave respaldada): cifrar sin respaldo = pérdida total.
 *
 * Uso: node --env-file=.env --import tsx scripts/migrar-cifrado-texto-reportes.ts
 */
import { prisma } from "../src/lib/prisma";
import { isEncryptedValue } from "../src/lib/param-encryption";
import { cifrarTextoReporte, descifrarTextoReporte, MARCADOR_TEXTO_PURGADO } from "../src/lib/texto-reporte-cifrado";

const LOTE = 500;

async function main() {
    let cifrados = 0;
    let yaCifrados = 0;
    let originalPoblado = 0;
    let procesados = 0;

    for (;;) {
        const lote = await prisma.reporte.findMany({
            orderBy: { creadoEn: "asc" },
            skip: procesados,
            take: LOTE,
            select: { id: true, texto: true, textoOriginal: true },
        });
        if (lote.length === 0) break;

        for (const r of lote) {
            const data: { texto?: string; textoOriginal?: string } = {};

            if (r.texto !== MARCADOR_TEXTO_PURGADO && !isEncryptedValue(r.texto)) {
                data.texto = cifrarTextoReporte(r.texto);
                cifrados++;
            } else {
                yaCifrados++;
            }

            if (r.textoOriginal === null) {
                // Históricos pre-SPEC-110: la evidencia se puebla con el contenido
                // original (el plano del texto; idempotente en ambos sentidos, O-3).
                data.textoOriginal = cifrarTextoReporte(descifrarTextoReporte(r.texto));
                originalPoblado++;
            }

            if (Object.keys(data).length > 0) {
                await prisma.reporte.update({ where: { id: r.id }, data });
            }
        }

        procesados += lote.length;
        console.log(`[MigracionTexto] Lote procesado: ${procesados} reportes…`);
    }

    const restantes = await prisma.reporte.count({
        where: { NOT: { texto: MARCADOR_TEXTO_PURGADO } },
    });
    const planosRestantes = await prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*)::bigint AS total FROM "Reporte"
        WHERE texto <> ${MARCADOR_TEXTO_PURGADO}
          AND texto NOT LIKE 'enc:%'
    `;
    const originalesNulos = await prisma.reporte.count({ where: { textoOriginal: null } });

    console.log(
        `[MigracionTexto] RESUMEN: procesados=${procesados} cifrados=${cifrados} ` +
        `ya_cifrados=${yaCifrados} original_poblado=${originalPoblado} ` +
        `texto_plano_restante=${planosRestantes[0]?.total ?? 0} textoOriginal_nulos=${originalesNulos} (total reportes=${restantes})`
    );
    if (Number(planosRestantes[0]?.total ?? 0) > 0) {
        console.error("[MigracionTexto] ERROR: quedan textos en claro");
        process.exitCode = 1;
    }
}

main()
    .catch((err: unknown) => {
        console.error("[MigracionTexto] Error:", err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
