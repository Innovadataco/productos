/**
 * Runner DUAL de motores sobre el banco gobernado (spec 095-US3c, D-20).
 * Corre el motor LEGACY (clasificarConVotos) y la RÚBRICA sobre el MISMO banco,
 * para comparaciones limpias cuando lleguen las etiquetas adjudicadas.
 * Uso: npx tsx scripts/eval-dual-banco.ts [limite]
 */
import fs from "fs";
import { clasificarConVotos } from "../src/lib/ai/classifier";
import { clasificarConRubrica } from "../src/lib/ai/rubrica";
import { prisma } from "../src/lib/prisma";

interface Caso {
    texto: string;
    categoriaEsperada?: string;
    secundariaEsperada?: string;
}

const LIMITE = parseInt(process.argv[2] ?? "200", 10);

function canonizar(v?: string): string {
    return (v ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

async function main() {
    const banco = JSON.parse(fs.readFileSync("scripts/simulacion/simulacion-50-casos-eval.json", "utf-8"));
    const casos: Caso[] = banco.casos.slice(0, LIMITE);

    const detalle: unknown[] = [];
    let legacyAciertos = 0;
    let rubricaAciertos = 0;

    for (let i = 0; i < casos.length; i++) {
        const caso = casos[i];
        const esperada = canonizar(caso.categoriaEsperada);
        const secundaria = caso.secundariaEsperada ? canonizar(caso.secundariaEsperada) : null;
        const acierto = (asignada: string) => asignada === esperada || (secundaria !== null && asignada === secundaria);

        let legacy: { categoria: string; estado: string } = { categoria: "OTRO", estado: "REVISION_MANUAL" };
        try {
            const r = await clasificarConVotos("gemma2:27b", caso.texto, { umbralRevision: 1.0 });
            legacy = { categoria: r.categoria, estado: r.estado };
        } catch (err) {
            console.error(`[DUAL] legacy caso ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }

        let rubrica: { categoria: string; estado: string; presentes: string[] } = { categoria: "OTRO", estado: "REVISION_MANUAL", presentes: [] };
        try {
            const r = await clasificarConRubrica(caso.texto);
            rubrica = { categoria: r.categoria, estado: r.estado, presentes: r.categoriasPresentes };
        } catch (err) {
            console.error(`[DUAL] rúbrica caso ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }

        const legacyOk = acierto(legacy.categoria) && legacy.estado !== "REVISION_MANUAL";
        const rubricaOk = (acierto(rubrica.categoria) || rubrica.presentes.some(acierto)) && rubrica.estado !== "REVISION_MANUAL";
        if (legacyOk) legacyAciertos++;
        if (rubricaOk) rubricaAciertos++;

        detalle.push({ indice: i + 1, esperada, secundaria, legacy, rubrica, legacyOk, rubricaOk });
        if ((i + 1) % 10 === 0) console.log(`[DUAL] ${i + 1}/${casos.length} — legacy ${legacyAciertos}, rúbrica ${rubricaAciertos}`);
    }

    const resultado = {
        banco: "gobernado fixtureVersion=2",
        casos: casos.length,
        legacy: { aciertos: legacyAciertos, accuracy: casos.length > 0 ? legacyAciertos / casos.length : 0 },
        rubrica: { aciertos: rubricaAciertos, accuracy: casos.length > 0 ? rubricaAciertos / casos.length : 0 },
        detalle,
    };
    fs.writeFileSync("scripts/simulacion/resultados-dual-095.json", JSON.stringify(resultado, null, 1));
    console.log(JSON.stringify({ ...resultado, detalle: undefined }, null, 1));
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
