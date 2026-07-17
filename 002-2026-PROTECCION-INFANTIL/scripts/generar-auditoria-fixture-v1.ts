import { prisma } from "../src/lib/prisma";
import { writeFileSync } from "fs";
import { resolve } from "path";

const OUT = resolve(__dirname, "auditoria-fixture-v1.md");

const RUN_ALIASES: Record<string, string> = {
    "Prueba ornith:35b": "ornith:35b",
    "ornith:9b - 3 votos": "ornith:9b-3v",
    "Línea de base ornith:9b": "ornith:9b-base",
    "qwen2.5:32b . prueba 1": "qwen2.5:32b",
};

function trunc(text: string, n = 90) {
    const t = text.replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function majority<T>(items: T[]): T | null {
    const freq = new Map<T, number>();
    for (const x of items) freq.set(x, (freq.get(x) || 0) + 1);
    let best: T | null = null;
    let bestN = 0;
    for (const [k, v] of freq.entries()) {
        if (v > bestN) {
            best = k;
            bestN = v;
        }
    }
    return best;
}

// IDs que se curarán por evidencia fuerte (todas las corridas fallaron y la etiqueta correcta es clara).
const STRONG_CHANGE_IDS = new Set([
    "cmrobzjvw009x1148xqb4oovn", // SOLICITUD_MATERIAL -> EXTORSION
    "cmrobzjvw00a311482euqnl0q", // SOLICITUD_MATERIAL -> EXTORSION
    "cmrobzjvw00b91148130faty3", // OTRO -> EXTORSION
    "cmrobzjvw00ba114800zbwh31", // OTRO -> DOXING
    "cmrobzjvw00bf1148m22z3f4q", // OTRO -> DOXING
]);

function detectaInconsistencia(c: { id: string; texto: string; categoriaEsperada: string; allFailed: boolean; predCounts: { p: string; n: number }[] }) {
    const txt = c.texto.toLowerCase();
    const notes: string[] = [];
    // OTRO vs DOXING por dirección / publicar datos
    if ((txt.includes("direccion") || txt.includes("dirección") || txt.includes("donde vivo") || txt.includes("publicar")) && c.categoriaEsperada === "OTRO") {
        notes.push("Inconsistencia: texto similar a casos DOXING (publicar dirección/datos personales).");
    }
    // SOLICITUD_MATERIAL vs EXTORSION por amenaza/coerción
    if (c.categoriaEsperada === "SOLICITUD_MATERIAL" && (txt.includes("amenaza") || txt.includes("chantajea") || (txt.includes("si no") && (txt.includes("difundir") || txt.includes("contar secretos") || txt.includes("mando"))))) {
        notes.push("Inconsistencia: incluye coerción/amenaza; casos análogos etiquetados EXTORSION.");
    }
    // OTRO vs EXTORSION por amenaza
    if (c.categoriaEsperada === "OTRO" && (txt.includes("amenaza") || txt.includes("chantajea"))) {
        notes.push("Inconsistencia: contiene amenaza; casos análogos etiquetados EXTORSION.");
    }
    return notes;
}

async function main() {
    const runs = await prisma.evalRun.findMany({
        where: { estado: "COMPLETADA", fixtureVersion: 1 },
        select: { id: true, nombre: true },
        orderBy: { finalizadoEn: "asc" },
    });

    const casos = await prisma.casoEval.findMany({
        where: { activo: true, fixtureVersion: 1 },
        include: { resultados: true },
        orderBy: { creadoEn: "asc" },
    });

    const rows = casos.map((c) => {
        const perRun = runs.map((r) => {
            const results = c.resultados.filter((res) => res.experimentoId === r.id);
            const correct = results.some((res) => res.correcto);
            const pred = majority(results.map((res) => res.predicho));
            return { runId: r.id, runName: r.nombre, alias: RUN_ALIASES[r.nombre ?? ""] || r.nombre || "sin-nombre", pred: pred || "-", correct };
        });

        const failedRuns = perRun.filter((p) => !p.correct).map((p) => p.alias);
        const allFailed = failedRuns.length === runs.length;
        const runPreds = perRun.map((p) => p.pred).filter((p): p is string => p !== "-");
        const predCounts = Array.from(
            runPreds.reduce((m, p) => m.set(p, (m.get(p) || 0) + 1), new Map<string, number>())
        )
            .map(([p, n]) => ({ p, n }))
            .sort((a, b) => b.n - a.n);

        let justificacion = "";
        if (allFailed) {
            justificacion = `Las 4 corridas fallaron; mayoría predijo ${predCounts[0]?.p || "-"} (${predCounts[0]?.n || 0}/${runs.length}).`;
        } else if (failedRuns.length > 0) {
            justificacion = `Discrepan ${failedRuns.join(", ")}.`;
        }

        const inconsistency = detectaInconsistencia({ id: c.id, texto: c.texto, categoriaEsperada: c.categoriaEsperada, allFailed, predCounts }).join(" ");

        // Propuesta solo para cambios de evidencia fuerte decididos manualmente.
        const propuestaFuerte = allFailed && STRONG_CHANGE_IDS.has(c.id) && predCounts[0] && predCounts[0].p !== c.categoriaEsperada ? predCounts[0].p : "";

        return {
            id: c.id,
            texto: trunc(c.texto),
            actual: c.categoriaEsperada,
            propuesta: propuestaFuerte,
            justificacion,
            discrepan: failedRuns.join(", ") || "-",
            todosFallaron: allFailed ? "SÍ" : "NO",
            inconsistencia: inconsistency || "-",
        };
    });

    const allFailedRows = rows.filter((r) => r.todosFallaron === "SÍ");
    const cambiosSugeridos = rows.filter((r) => r.propuesta);

    let md = `# Auditoría del fixture v1 — CasoEval\n\n`;
    md += `> Generado automáticamente el ${new Date().toISOString()}\n\n`;
    md += `## Resumen\n\n`;
    md += `- Casos activos auditados: **${rows.length}**\n`;
    md += `- Corridas consideradas: **${runs.length}** (${runs.map((r) => RUN_ALIASES[r.nombre ?? ""] || r.nombre || "sin-nombre").join(", ")})\n`;
    md += `- Casos fallados por TODAS las corridas: **${allFailedRows.length}**\n`;
    md += `- Cambios de evidencia fuerte sugeridos: **${cambiosSugeridos.length}**\n\n`;

    md += `## Criterio de curación aplicado\n\n`;
    md += `Se aplica cambio únicamente cuando:\n`;
    md += `1. El caso fue fallado por las 4 corridas.\n`;
    md += `2. La etiqueta propuesta es clara y está respaldada por la mayoría de predicciones y/o inconsistencias internas del fixture.\n\n`;
    md += `Los casos dudosos quedan en la tabla para decisión del owner.\n\n`;

    md += `## Tabla de auditoría\n\n`;
    md += "| id | texto (truncado) | etiqueta actual | propuesta | justificación | modelos que discrepan | ¿fallaron todos? | inconsistencia |\n";
    md += "|---|---|---|---|---|---|---|---|\n";

    for (const r of rows) {
        md += `| ${r.id} | ${r.texto} | ${r.actual} | ${r.propuesta || "-"} | ${r.justificacion} | ${r.discrepan} | ${r.todosFallaron} | ${r.inconsistencia} |\n`;
    }

    md += `\n## Casos con cambio sugerido (evidencia fuerte)\n\n`;
    if (cambiosSugeridos.length === 0) {
        md += "_Ninguno._\n";
    } else {
        md += "| id | texto (truncado) | actual | propuesta | motivo |\n";
        md += "|---|---|---|---|---|\n";
        for (const r of cambiosSugeridos) {
            md += `| ${r.id} | ${r.texto} | ${r.actual} | ${r.propuesta} | ${r.inconsistencia || r.justificacion} |\n`;
        }
    }

    md += `\n## Casos dudosos / para decisión del owner\n\n`;
    const dudosos = allFailedRows.filter((r) => !r.propuesta);
    if (dudosos.length === 0) {
        md += "_Ninguno._\n";
    } else {
        md += "| id | texto (truncado) | actual | predicciones | nota |\n";
        md += "|---|---|---|---|---|\n";
        for (const r of dudosos) {
            md += `| ${r.id} | ${r.texto} | ${r.actual} | ${r.discrepan} | ${r.inconsistencia || "Revisar semántica"} |\n`;
        }
    }

    writeFileSync(OUT, md, "utf8");
    console.log(`Escrito ${OUT}`);
    console.log(`Casos auditados: ${rows.length}`);
    console.log(`Cambios sugeridos: ${cambiosSugeridos.length}`);
    console.log(`Dudosos: ${dudosos.length}`);

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
