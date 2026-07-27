/**
 * Runner DUAL de motores sobre el banco gobernado CURADO (spec 095, cierre de curaduría).
 * Corre el motor LEGACY (clasificarConVotos) y la RÚBRICA sobre los MISMOS 200 casos y
 * puntúa cada salida contra DOS juegos de etiquetas:
 *   - "despues": banco curado (scripts/simulacion/simulacion-50-casos-eval.json, 42/42 adjudicados)
 *   - "antes":   banco antes de la adjudicación (simulacion-200-antes-curaduria.json, match por texto)
 * Por motor y versión reporta: aciertos, accuracy, silenciosos (fallo con confianza >=
 * umbral_revisión), subestimaciones (Δseveridad<0) y ESPS (ADR_006: Σ|Δsev|, sub ×3).
 * Ambos motores reportan confianza en escala 0-1 (verificado: rúbrica usa fracciones, no porcentajes).
 * Uso: npx tsx scripts/eval-dual-banco.ts [limite]
 */
import fs from "fs";
import { clasificarConVotos } from "../src/lib/ai/classifier";
import { clasificarConRubrica } from "../src/lib/ai/rubrica";
import { prisma } from "../src/lib/prisma";
import { obtenerSeveridades } from "../src/lib/scoring";
import { calcularEsps } from "../src/lib/simulacion/metricas";
import { getParametroSistema } from "../src/lib/parametros";
import type { CategoriaConducta } from "@prisma/client";

interface Caso {
    texto: string;
    categoriaEsperada?: string;
    secundariaEsperada?: string;
}

interface SalidaMotor {
    categoria: string;
    estado: string;
    confianza: number; // normalizada 0-1
    presentes: string[];
}

interface Silencioso {
    indice: number;
    esperado: string;
    asignado: string;
    confianza: number;
    deltaSeveridad: number;
}

interface MetricasMotor {
    aciertos: number;
    fallos: number;
    accuracy: number;
    silenciosos: { count: number; casos: Silencioso[] };
    subestimaciones: { count: number; severidadPerdida: number };
    esps: number;
}

const LIMITE = parseInt(process.argv[2] ?? "200", 10);
// Spec 098: con --rubrica-only se reusan las salidas del legacy de la corrida anterior
// (resultados-dual-095.json) y SOLO se re-clasifica con la rúbrica (una variable a la vez).
const RUBRICA_ONLY = process.argv.includes("--rubrica-only");

function canonizar(v?: string): string {
    return (v ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

function puntuar(
    salidas: SalidaMotor[],
    casos: Caso[],
    etiquetas: Map<string, { esperada: string; secundaria: string | null }>,
    sev: Record<string, number>,
    umbralRevision: number,
): MetricasMotor {
    let aciertos = 0;
    let subestimaciones = 0;
    let severidadPerdida = 0;
    const silenciosos: Silencioso[] = [];

    for (let i = 0; i < salidas.length; i++) {
        const etq = etiquetas.get(casos[i].texto);
        if (!etq) throw new Error(`Sin etiqueta para el caso ${i + 1}`);
        const s = salidas[i];
        const aciertoBase = (asignada: string) =>
            asignada === etq.esperada || (etq.secundaria !== null && asignada === etq.secundaria);
        const ok = (aciertoBase(s.categoria) || s.presentes.some(aciertoBase)) && s.estado !== "REVISION_MANUAL";

        if (ok) {
            aciertos++;
            continue;
        }
        const deltaSev = (sev[s.categoria] ?? 0) - (sev[etq.esperada] ?? 0);
        if (deltaSev < 0) {
            subestimaciones++;
            severidadPerdida += Math.abs(deltaSev);
        }
        // Spec 098: esperada === asignada = contenido CORRECTO que se abstuvo
        // (REVISION_MANUAL, Δ=0) — es abstención, no error silencioso.
        if (s.confianza >= umbralRevision && s.categoria !== etq.esperada) {
            silenciosos.push({
                indice: i + 1,
                esperado: etq.esperada,
                asignado: s.categoria,
                confianza: s.confianza,
                deltaSeveridad: deltaSev,
            });
        }
    }

    const fallos = salidas.length - aciertos;
    return {
        aciertos,
        fallos,
        accuracy: salidas.length > 0 ? aciertos / salidas.length : 0,
        silenciosos: { count: silenciosos.length, casos: silenciosos },
        subestimaciones: { count: subestimaciones, severidadPerdida },
        esps: calcularEsps(silenciosos),
    };
}

async function main() {
    const curado = JSON.parse(fs.readFileSync("scripts/simulacion/simulacion-50-casos-eval.json", "utf-8"));
    const antes = JSON.parse(fs.readFileSync("scripts/simulacion/simulacion-200-antes-curaduria.json", "utf-8"));
    const casos: Caso[] = curado.casos.slice(0, LIMITE);

    const aMap = new Map<string, { esperada: string; secundaria: string | null }>();
    for (const c of antes.casos as Caso[]) {
        aMap.set(c.texto, { esperada: canonizar(c.categoriaEsperada), secundaria: c.secundariaEsperada ? canonizar(c.secundariaEsperada) : null });
    }
    const dMap = new Map<string, { esperada: string; secundaria: string | null }>();
    for (const c of casos) {
        dMap.set(c.texto, { esperada: canonizar(c.categoriaEsperada), secundaria: c.secundariaEsperada ? canonizar(c.secundariaEsperada) : null });
    }

    const paramUmbral = await getParametroSistema("reportes.classification.umbral_revision", prisma);
    const umbralRevision = Number.isFinite(parseFloat(paramUmbral?.valor ?? "")) ? parseFloat(paramUmbral!.valor) : 1.0;
    const severidades = await obtenerSeveridades();
    const sev: Record<string, number> = { ...severidades } as Record<string, number>;

    const legacySalidas: SalidaMotor[] = [];
    const rubricaSalidas: SalidaMotor[] = [];
    const detalle: unknown[] = [];

    let legacyPrevio: SalidaMotor[] | null = null;
    if (RUBRICA_ONLY) {
        const corrida = JSON.parse(fs.readFileSync("scripts/simulacion/resultados-dual-095.json", "utf-8"));
        legacyPrevio = (corrida.detalle as { legacy: SalidaMotor }[]).map((d) => d.legacy);
        if (legacyPrevio.length < casos.length) throw new Error("resultados-dual-095.json no tiene detalle legacy suficiente para --rubrica-only");
        console.log(`[DUAL] --rubrica-only: reutilizando ${legacyPrevio.length} salidas legacy de la corrida anterior`);
    }

    for (let i = 0; i < casos.length; i++) {
        const caso = casos[i];

        let legacy: SalidaMotor = { categoria: "OTRO", estado: "REVISION_MANUAL", confianza: 0, presentes: [] };
        if (legacyPrevio) {
            legacy = legacyPrevio[i];
        } else {
            try {
                const r = await clasificarConVotos("gemma2:27b", caso.texto, { umbralRevision: 1.0 });
                legacy = { categoria: r.categoria, estado: r.estado, confianza: r.confianza, presentes: [] };
            } catch (err) {
                console.error(`[DUAL] legacy caso ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        let rubrica: SalidaMotor = { categoria: "OTRO", estado: "REVISION_MANUAL", confianza: 0, presentes: [] };
        try {
            const r = await clasificarConRubrica(caso.texto);
            rubrica = { categoria: r.categoria, estado: r.estado, confianza: r.confianza, presentes: r.categoriasPresentes };
        } catch (err) {
            console.error(`[DUAL] rúbrica caso ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
        }

        legacySalidas.push(legacy);
        rubricaSalidas.push(rubrica);
        detalle.push({ indice: i + 1, esperada: dMap.get(caso.texto), legacy, rubrica });
        if ((i + 1) % 10 === 0) console.log(`[DUAL] ${i + 1}/${casos.length} casos clasificados`);
    }

    const resultado = {
        banco: "gobernado fixtureVersion=2 (curado, 42/42 adjudicados)",
        casos: casos.length,
        umbralRevision,
        nota: "confianza 0-1 en ambos motores; acierto = principal o secundaria (rúbrica también por categoriasPresentes), estado != REVISION_MANUAL",
        antes: {
            legacy: puntuar(legacySalidas, casos, aMap, sev, umbralRevision),
            rubrica: puntuar(rubricaSalidas, casos, aMap, sev, umbralRevision),
        },
        despues: {
            legacy: puntuar(legacySalidas, casos, dMap, sev, umbralRevision),
            rubrica: puntuar(rubricaSalidas, casos, dMap, sev, umbralRevision),
        },
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
