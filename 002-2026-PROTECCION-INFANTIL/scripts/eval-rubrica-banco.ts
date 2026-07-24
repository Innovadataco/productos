/**
 * Evaluación del motor rúbrica (spec 090-US4) contra el banco de la spec 085.
 * Uso: npx tsx scripts/eval-rubrica-banco.ts [limite]
 * Escribe scripts/simulacion/resultados-rubrica-090.json con métricas por caso y globales.
 */
import fs from "fs";
import { clasificarConRubrica } from "../src/lib/ai/rubrica";
import { obtenerSeveridades } from "../src/lib/scoring";
import { getParametroSistema } from "../src/lib/parametros";
import { prisma } from "../src/lib/prisma";
import type { CategoriaConducta } from "@prisma/client";

interface Caso {
    texto: string;
    categoriaEsperada?: string;
    secundariaEsperada?: string;
    fuente?: string;
}

const LIMITE = parseInt(process.argv[2] ?? "200", 10);
const UMBRAL_REVISION = 1.0; // mismo criterio de "silencioso" que la spec 085

function canonizar(v?: string): string {
    return (v ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

async function main() {
    const banco = JSON.parse(fs.readFileSync("scripts/simulacion/simulacion-50-casos-eval.json", "utf-8"));
    const casos: Caso[] = banco.casos.slice(0, LIMITE);
    const severidades = await obtenerSeveridades();
    const sev = (c: string) => severidades[c as CategoriaConducta] ?? 0;

    let aciertos = 0;
    let fallos = 0;
    let revisionManual = 0;
    let silenciosos = 0;
    let subestimaciones = 0;
    let severidadPerdida = 0;
    let esps = 0;
    const detalle: unknown[] = [];

    for (let i = 0; i < casos.length; i++) {
        const caso = casos[i];
        const esperada = canonizar(caso.categoriaEsperada);
        const secundaria = caso.secundariaEsperada ? canonizar(caso.secundariaEsperada) : null;
        let asignada = "OTRO";
        let estado = "REVISION_MANUAL";
        let confianza = 0;

        try {
            const r = await clasificarConRubrica(caso.texto);
            asignada = r.categoria;
            estado = r.estado;
            confianza = r.confianza;
        } catch (err) {
            console.error(`[EVAL] caso ${i + 1} error: ${err instanceof Error ? err.message : String(err)}`);
        }

        const acierto = asignada === esperada || (secundaria !== null && asignada === secundaria);
        if (estado === "REVISION_MANUAL") revisionManual++;

        if (acierto) {
            aciertos++;
        } else {
            fallos++;
            const delta = sev(asignada) - sev(esperada);
            if (delta < 0) {
                subestimaciones++;
                severidadPerdida += Math.abs(delta);
            }
            if (confianza >= UMBRAL_REVISION) {
                silenciosos++;
                esps += delta < 0 ? Math.abs(delta) * 3 : Math.abs(delta);
            }
        }

        detalle.push({ indice: i + 1, esperada, secundaria, asignada, estado, confianza, acierto });
        if ((i + 1) % 10 === 0) console.log(`[EVAL] ${i + 1}/${casos.length} — aciertos ${aciertos}, silenciosos ${silenciosos}`);
    }

    const total = casos.length;
    const resultado = {
        motor: "rubrica-090 (3 modelos diversos)",
        casos: total,
        aciertos,
        fallos,
        accuracy: total > 0 ? aciertos / total : 0,
        revisionManual,
        erroresSilenciosos: silenciosos,
        subestimaciones,
        severidadPerdida,
        esps,
        detalle,
    };
    fs.writeFileSync("scripts/simulacion/resultados-rubrica-090.json", JSON.stringify(resultado, null, 1));
    console.log(JSON.stringify({ ...resultado, detalle: undefined }, null, 1));
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
