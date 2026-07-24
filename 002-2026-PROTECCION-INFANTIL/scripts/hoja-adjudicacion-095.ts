/**
 * Hoja de adjudicación de los 42 casos en disputa (spec 095-US3b, D-20).
 * Re-corre la rúbrica sobre los casos donde los 3 modelos (3/3) contradicen la
 * etiqueta del banco, captura el voto de CADA modelo y genera una hoja de trabajo
 * para ZEUS+CEO+experto. NO decide etiquetas: las columnas de adjudicación van vacías.
 * Uso: npx tsx scripts/hoja-adjudicacion-095.ts
 */
import fs from "fs";
import { clasificarConRubrica } from "../src/lib/ai/rubrica";
import { prisma } from "../src/lib/prisma";

interface DetalleCaso {
    indice: number;
    esperada: string;
    secundaria: string | null;
    asignada: string;
    confianza: number;
}

interface Caso {
    texto: string;
    categoriaEsperada?: string;
    secundariaEsperada?: string;
}

async function main() {
    const resultados = JSON.parse(fs.readFileSync("scripts/simulacion/resultados-rubrica-090.json", "utf-8"));
    const disputados: DetalleCaso[] = resultados.detalle.filter((c: DetalleCaso & { acierto: boolean }) => !c.acierto && c.confianza >= 1.0);
    const banco = JSON.parse(fs.readFileSync("scripts/simulacion/simulacion-50-casos-eval.json", "utf-8"));

    const lineas: string[] = [];
    lineas.push("# Hoja de adjudicación — 42 casos en disputa (spec 095-US3b)");
    lineas.push("");
    lineas.push("> Casos donde los 3 modelos (3/3) contradicen la etiqueta actual del banco.");
    lineas.push("> Trabajo de ZEUS + CEO + experto: adjudicar la etiqueta correcta y la razón.");
    lineas.push("> **No decidir aquí** — las columnas finales quedan vacías a propósito.");
    lineas.push(`> Generada: ${new Date().toISOString().slice(0, 10)} · casos: ${disputados.length}`);
    lineas.push("");

    for (const c of disputados) {
        const caso: Caso = banco.casos[c.indice - 1];
        const r = await clasificarConRubrica(caso.texto);
        lineas.push(`## Caso #${c.indice}`);
        lineas.push("");
        lineas.push(`- **Texto**: "${caso.texto}"`);
        lineas.push(`- **Etiqueta actual**: ${c.esperada}${c.secundaria ? ` (secundaria: ${c.secundaria})` : ""}`);
        lineas.push(`- **Motor dice (3/3)**: ${c.asignada}`);
        lineas.push(`- **Voto por modelo**:`);
        for (const vm of r.votosModelos) {
            const marcas = Object.entries(vm.categorias)
                .filter(([, v]) => v.cumple)
                .map(([cat]) => cat)
                .join(", ") || "(ninguna)";
            lineas.push(`  - ${vm.modelo}: ${marcas}`);
        }
        lineas.push(`- **Etiqueta adjudicada**: _(vacío)_`);
        lineas.push(`- **Razón**: _(vacío)_`);
        lineas.push("");
    }

    fs.writeFileSync("docs/adjudicacion-095-casos-disputa.md", lineas.join("\n"));
    console.log(`Hoja generada: docs/adjudicacion-095-casos-disputa.md (${disputados.length} casos)`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
