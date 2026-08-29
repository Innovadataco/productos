/**
 * Aplica la D-28 en una BD ya operada: fija ia.rubrica.enabled=true (idempotente).
 * El seed es upsert no destructivo y no toca parámetros existentes: este script es la
 * aplicación de verdad en producción (I-27: nunca más "recomendado y sin aplicar").
 * Uso local:   node --env-file=.env --import tsx scripts/aplicar-rubrica-default-111.ts
 * Uso en prod: docker compose --env-file .env.production -f docker-compose.prod.yml \
 *                exec -T app npx tsx scripts/aplicar-rubrica-default-111.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
    const actual = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.enabled" } });
    if (!actual) {
        // Base sin el parámetro (no debería ocurrir si corrió el seed): lo crea en true.
        await prisma.parametroSistema.create({
            data: {
                clave: "ia.rubrica.enabled",
                valor: "true",
                tipo: "BOOLEAN",
                categoria: "SYSTEM",
                esPublico: false,
                descripcion: "Motor rúbrica multi-etiqueta/multi-modelo (D-28: rúbrica por defecto; legacy desactivable por parámetro para reversión en caliente)",
            },
        });
        console.log("[111] ia.rubrica.enabled no existía: creado en true.");
    } else if (actual.valor === "true") {
        console.log("[111] ia.rubrica.enabled ya estaba en true. Nada que hacer (idempotente).");
    } else {
        await prisma.parametroSistema.update({
            where: { clave: "ia.rubrica.enabled" },
            data: { valor: "true" },
        });
        console.log(`[111] ia.rubrica.enabled: ${actual.valor} -> true (D-28 aplicada).`);
    }
    const verificacion = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.enabled" } });
    console.log(`[111] verificación: ia.rubrica.enabled = ${verificacion?.valor}`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
