/**
 * Actualiza el parámetro ia.rubrica.preguntas con la rúbrica afinada (spec 098:
 * decisivas de targeting en OFRECIMIENTO_REGALOS y CONTACTO_INSISTENTE).
 * Necesario porque el seed es upsert no destructivo (`update: {}`): las BD existentes
 * (dev de la Mac, prod del VPS) conservan la rúbrica vieja hasta aplicar esto.
 * Uso: npx tsx scripts/actualizar-rubrica-098.ts
 */
import { prisma } from "../src/lib/prisma";
import { RUBRICA_SEMILLA } from "../src/lib/ai/rubrica-semilla";

async function main() {
    const actual = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.preguntas" } });
    if (!actual) throw new Error("Parámetro ia.rubrica.preguntas no existe (correr seed primero)");

    const decisivasNuevas = [
        "¿El contacto es personal y dirigido específicamente a este menor?",
        "¿El ofrecimiento es personal, dirigido específicamente a este menor?",
    ];
    const sets = JSON.parse(actual.valor) as Record<string, { texto: string }[]>;
    const yaAplicado = decisivasNuevas.every((d) => Object.values(sets).some((qs) => qs.some((q) => q.texto === d)));
    if (yaAplicado) {
        console.log("[RUBRICA-098] El parámetro ya tiene las decisivas de targeting. Nada que hacer.");
        await prisma.$disconnect();
        return;
    }

    await prisma.parametroSistema.update({
        where: { clave: "ia.rubrica.preguntas" },
        data: { valor: JSON.stringify(RUBRICA_SEMILLA) },
    });
    console.log("[RUBRICA-098] ia.rubrica.preguntas actualizado con la rúbrica afinada (decisivas de targeting).");
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
