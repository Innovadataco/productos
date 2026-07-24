/**
 * Medición del embudo (spec 092-US2): sobre los 200 casos del banco, ¿en cuántos
 * el embudo descarta la categoría correcta (esperada o secundaria)?
 * Uso: npx tsx scripts/medir-embudo-092.ts
 */
import fs from "fs";
import { evaluarEmbudo } from "../src/lib/ai/rubrica";
import { prisma } from "../src/lib/prisma";

interface Caso {
    texto: string;
    categoriaEsperada?: string;
    secundariaEsperada?: string;
}

function canonizar(v?: string): string {
    return (v ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

async function main() {
    const banco = JSON.parse(fs.readFileSync("scripts/simulacion/simulacion-50-casos-eval.json", "utf-8"));
    const casos: Caso[] = banco.casos;

    let descartesErroneos = 0;
    const detalle: Array<{ indice: number; esperada: string; secundaria: string | null; plausibles: string[] }> = [];

    for (let i = 0; i < casos.length; i++) {
        const caso = casos[i];
        const esperada = canonizar(caso.categoriaEsperada);
        const secundaria = caso.secundariaEsperada ? canonizar(caso.secundariaEsperada) : null;
        const { plausibles } = await evaluarEmbudo(caso.texto);

        const aciertaEsperada = plausibles.includes(esperada);
        const aciertaSecundaria = secundaria !== null && plausibles.includes(secundaria);
        if (!aciertaEsperada && !aciertaSecundaria) {
            descartesErroneos++;
            detalle.push({ indice: i + 1, esperada, secundaria, plausibles });
        }
        if ((i + 1) % 25 === 0) console.log(`[EMBUDO] ${i + 1}/${casos.length} — descartes erróneos: ${descartesErroneos}`);
    }

    const resultado = {
        casos: casos.length,
        descartesErroneos,
        porcentaje: descartesErroneos / casos.length,
        detalle,
    };
    fs.writeFileSync("scripts/simulacion/medicion-embudo-092.json", JSON.stringify(resultado, null, 1));
    console.log(JSON.stringify({ ...resultado, detalle: undefined }, null, 1));
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
