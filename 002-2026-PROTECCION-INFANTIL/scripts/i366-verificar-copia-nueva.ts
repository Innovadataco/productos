/**
 * I-366 · PRE-FLIGHT OBLIGATORIO (la compuerta) — correr ANTES de la migración de purga.
 *
 * Para CADA fila que aún conserva la copia vieja (`Reporte.texto`/`textoOriginal`), descifra la
 * copia NUEVA (`ContenidoReporte`, DEK por fila) y confirma que sale texto legible y no vacío.
 * Si UNA falla → exit 1 y NO se purga: borrar la copia vieja sin la nueva verificada es PÉRDIDA
 * DE DATOS, no limpieza. Solo LEE (+ descifra); no escribe nada.
 *
 * Uso (contra la base objetivo): `node --env-file=.env.<entorno> --import tsx scripts/i366-verificar-copia-nueva.ts`
 * Debe imprimir cada fila × {texto, textoOriginal} en OK y terminar en 0. Si sale ≠0, PARAR.
 */
import { prisma } from "../src/lib/prisma";
import { descifrarCampo } from "../src/lib/reporte-texto-contenido";

async function main(): Promise<void> {
    // Prisma ya no mapea texto/textoOriginal → SQL crudo para saber CUÁLES filas verificar.
    const filas = await prisma.$queryRaw<Array<{ id: string; contenidoId: string }>>`
        SELECT "id", "contenidoId" FROM "Reporte"
         WHERE "texto" IS NOT NULL OR "textoOriginal" IS NOT NULL
         ORDER BY "id"`;

    if (filas.length === 0) {
        console.log("[I-366] 0 filas con texto viejo — nada que verificar (¿ya purgado?). OK.");
        return;
    }

    let fallos = 0;
    for (const fila of filas) {
        await prisma.$transaction(async (tx) => {
            for (const campo of ["texto", "textoOriginal"] as const) {
                try {
                    const plano = await descifrarCampo(tx, fila.contenidoId, campo);
                    if (!plano || plano.length === 0) {
                        console.error(`[I-366] FALLO ${fila.id} / ${campo}: copia nueva vacía en ContenidoReporte`);
                        fallos++;
                    } else {
                        console.log(`[I-366] OK    ${fila.id} / ${campo}: ${plano.length} chars descifrados`);
                    }
                } catch (err) {
                    console.error(`[I-366] FALLO ${fila.id} / ${campo}: no descifra —`, err);
                    fallos++;
                }
            }
        });
    }

    if (fallos > 0) {
        console.error(`\n[I-366] ${fallos} fallo(s) sobre ${filas.length} fila(s) — NO PURGAR. Abortar.`);
        process.exitCode = 1;
        return;
    }
    console.log(`\n[I-366] ${filas.length} fila(s) verificadas: copia nueva íntegra. Seguro purgar.`);
}

main()
    .catch((err) => {
        console.error("[I-366] error inesperado —", err);
        process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
