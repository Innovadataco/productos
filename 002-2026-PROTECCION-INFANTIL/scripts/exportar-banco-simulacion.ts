/**
 * Exporta el banco GOBERNADO (CasoEval, fixtureVersion 2) al JSON de simulación
 * (spec 095-US3a: CasoEval es la fuente única; el JSON es un export reproducible).
 * Uso: npx tsx scripts/exportar-banco-simulacion.ts
 */
import fs from "fs";
import { prisma } from "../src/lib/prisma";

async function main() {
    const casos = await prisma.casoEval.findMany({
        where: { fuente: "SEMILLA", fixtureVersion: 2, activo: true },
        orderBy: { creadoEn: "asc" },
    });
    const salida = {
        fixtureVersion: 2,
        casos: casos.map((c) => ({
            texto: c.texto,
            categoriaEsperada: c.categoriaEsperada,
            ...(c.secundariaEsperada ? { secundariaEsperada: c.secundariaEsperada } : {}),
        })),
    };
    fs.writeFileSync("scripts/simulacion/simulacion-50-casos-eval.json", JSON.stringify(salida, null, 1));
    console.log(`Exportados ${casos.length} casos (fixtureVersion 2) del banco gobernado`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
