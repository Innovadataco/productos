#!/usr/bin/env node
/**
 * SPEC-280 (002-PI-180): resumen legible del CI para GITHUB_STEP_SUMMARY.
 *
 * Entradas (todas por env o CLI):
 *   --jobs-json <path>       JSON de `gh api /repos/.../actions/runs/<id>/jobs`
 *   --vitest-json <path>     JSON de `vitest --reporter=json --outputFile=...`  (opcional)
 *   --coverage-json <path>   JSON de `--coverage.reporter=json-summary` en coverage-summary.json  (opcional)
 *   --piso-lineas <n>        Piso vigente de cobertura líneas (default: 36)
 *
 * Salida: bloque Markdown por stdout, listo para redirigir a $GITHUB_STEP_SUMMARY.
 *
 * Comportamiento ante datos faltantes: NO crashea. Degrada a "resumen parcial".
 */
import { readFileSync, existsSync } from "node:fs";

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
            const key = a.slice(2);
            const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
            args[key] = val;
        }
    }
    return args;
}

function leerJsonSeguro(path) {
    if (!path || !existsSync(path)) return null;
    try {
        return JSON.parse(readFileSync(path, "utf-8"));
    } catch (err) {
        console.error(`[resumen] no pude leer ${path}: ${err.message}`);
        return null;
    }
}

function segundosEntre(started, completed) {
    if (!started || !completed) return 0;
    return Math.max(0, Math.round((new Date(completed).getTime() - new Date(started).getTime()) / 1000));
}

function formatearDuracion(segundos) {
    if (segundos <= 0) return "—";
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    if (min === 0) return `${seg} s`;
    return `${min} m ${String(seg).padStart(2, "0")} s`;
}

function iconoDeEstado(conclusion) {
    switch (conclusion) {
        case "success":
            return "✅";
        case "failure":
            return "❌";
        case "cancelled":
            return "⏸️";
        case "skipped":
            return null; // omitir la fila
        case "neutral":
        case null:
        case undefined:
            return "⚠️";
        default:
            return "⚠️";
    }
}

const INSPECTORES_ORDEN = [
    "verificaciones",
    "test-unit",
    "test-integration (1)",
    "test-integration (2)",
    "test-integration (3)",
    "test-integration (4)",
    "test-integration-coverage",
    "journeys",
    "build",
];

function ordenarInspectores(jobs) {
    const nombresAConsiderar = new Set(INSPECTORES_ORDEN);
    const filtrados = jobs.filter((j) => nombresAConsiderar.has(j.name));
    filtrados.sort((a, b) => INSPECTORES_ORDEN.indexOf(a.name) - INSPECTORES_ORDEN.indexOf(b.name));
    return filtrados;
}

function extraerPrimerTestFallido(vitest) {
    if (!vitest || !Array.isArray(vitest.testResults)) return null;
    for (const file of vitest.testResults) {
        if (!Array.isArray(file.assertionResults)) continue;
        for (const ar of file.assertionResults) {
            if (ar.status === "failed") {
                const nombre = Array.isArray(ar.ancestorTitles) && ar.ancestorTitles.length > 0
                    ? `${ar.ancestorTitles.join(" > ")} > ${ar.title}`
                    : ar.title;
                return { archivo: file.name, nombre };
            }
        }
    }
    return null;
}

function extraerCoberturaLineas(coverage) {
    if (!coverage || !coverage.total || !coverage.total.lines) return null;
    const pct = coverage.total.lines.pct;
    if (typeof pct !== "number") return null;
    return Math.round(pct * 10) / 10;
}

export function construirResumen({ jobs, vitest, coverage, pisoLineas }) {
    const inspectores = ordenarInspectores(jobs || []);
    const totalSeg = inspectores.reduce((max, j) => Math.max(max, segundosEntre(j.started_at, j.completed_at)), 0);
    const hayFallo = inspectores.some((j) => j.conclusion === "failure");
    const hayCancelado = inspectores.some((j) => j.conclusion === "cancelled");
    const numPruebas = vitest?.numTotalTests ?? null;
    const cobertura = extraerCoberturaLineas(coverage);
    const primerFallo = hayFallo ? extraerPrimerTestFallido(vitest) : null;

    const partes = [];
    const icono = hayFallo ? "❌" : hayCancelado ? "⏸️" : "✅";
    const cabeceraExtra = [];
    if (numPruebas !== null) cabeceraExtra.push(`${numPruebas} pruebas`);
    if (cobertura !== null) cabeceraExtra.push(`cobertura ${cobertura} % (piso ${pisoLineas} %)`);
    else cabeceraExtra.push(`cobertura n/d (piso ${pisoLineas} %)`);

    const cabecera = `### ${icono} CI ${hayFallo ? "rojo" : hayCancelado ? "cancelado" : "verde"} · ${formatearDuracion(totalSeg)} · ${cabeceraExtra.join(" · ")}`;
    partes.push(cabecera);
    partes.push("");
    partes.push("| Inspector | Estado | Duración |");
    partes.push("|---|---|---|");
    for (const j of inspectores) {
        const ico = iconoDeEstado(j.conclusion);
        if (ico === null) continue;
        partes.push(`| ${j.name} | ${ico} | ${formatearDuracion(segundosEntre(j.started_at, j.completed_at))} |`);
    }
    if (primerFallo) {
        partes.push("");
        partes.push(`**❌ Falló:** \`${primerFallo.archivo}\` → ${primerFallo.nombre}`);
    }
    if (!vitest) {
        partes.push("");
        partes.push("_⚠️ resumen parcial: no se pudo leer el JSON de pruebas._");
    }
    return partes.join("\n") + "\n";
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = parseArgs(process.argv.slice(2));
    const rawJobs = leerJsonSeguro(args["jobs-json"]);
    const jobs = Array.isArray(rawJobs?.jobs) ? rawJobs.jobs : Array.isArray(rawJobs) ? rawJobs : [];
    const vitest = leerJsonSeguro(args["vitest-json"]);
    const coverage = leerJsonSeguro(args["coverage-json"]);
    const pisoLineas = Number(args["piso-lineas"] ?? 36);
    const md = construirResumen({ jobs, vitest, coverage, pisoLineas });
    process.stdout.write(md);
}
