/**
 * SPEC-248 / 002-PI-151 · Validación obligatoria (FR-016, brief §7).
 *
 * Corre la clasificación por rúbrica sobre el dataset de 198 casos
 * (12 categorías previas + 3 nuevas de Ley 2564) con las 14 categorías activas,
 * calcula precision/recall/confusion matrix, y persiste el resultado en un
 * `SimulacionRun` (uno por modelo) + `AuditLog` con el resumen.
 *
 * Diseñado para correr en el worktree AISLADO (DB `proteccion_infantil_151`),
 * sin colisión con el clon principal ni con producción. Ollama es compartido.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/simulacion/spec-248-validacion.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { clasificarConRubrica } from "../../src/lib/ai/rubrica.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = resolve(__dirname, "simulacion-198-casos-spec248.json");
const MODELOS = ["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"];

const prisma = new PrismaClient();

async function main() {
    const dataset = JSON.parse(readFileSync(DATASET_PATH, "utf-8"));
    const casos = dataset.casos;
    console.log(`[SPEC-248] Dataset: ${casos.length} casos.`);

    // Un usuario dummy para SimulacionRun.creadoPor (FK obligatoria).
    // En BD aislada _151 sin seed de admin, se crea uno de test.
    const usuario = await prisma.usuario.upsert({
        where: { email: "spec248-validacion@test.local" },
        update: {},
        create: {
            email: "spec248-validacion@test.local",
            nombre: "SPEC-248 Validación",
            passwordHash: "no-login-dummy",
            rol: "ADMIN",
            estado: "activo",
        },
    });

    for (const modelo of MODELOS) {
        console.log(`\n[SPEC-248] === Modelo: ${modelo} ===`);
        const run = await prisma.simulacionRun.create({
            data: {
                modelo,
                totalCasos: casos.length,
                estado: "EN_PROGRESO",
                casosJson: dataset,
                creadoPorId: usuario.id,
            },
        });
        console.log(`[SPEC-248] SimulacionRun id: ${run.id} (${modelo})`);

        const resultados = [];
        let ok = 0;

        for (let i = 0; i < casos.length; i++) {
            const c = casos[i];
            const inicio = Date.now();
            try {
                const r = await clasificarConRubrica(c.texto, { modelos: [modelo] });
                const acierto = r.categoriasPresentes.includes(c.categoriaEsperada) ||
                    (c.categoriaEsperada === "OTRO" && r.categoriasPresentes.length === 0);
                if (acierto) ok++;
                resultados.push({
                    idx: i + 1,
                    esperada: c.categoriaEsperada,
                    presentes: r.categoriasPresentes,
                    principal: r.categoria,
                    confianza: r.confianza,
                    ok: acierto,
                    latenciaMs: Date.now() - inicio,
                });
            } catch (err) {
                console.error(`[SPEC-248] Caso ${i + 1} FAIL:`, err?.message ?? err);
                resultados.push({ idx: i + 1, esperada: c.categoriaEsperada, error: err?.message ?? String(err), ok: false });
            }

            if ((i + 1) % 10 === 0) {
                await prisma.simulacionRun.update({
                    where: { id: run.id },
                    data: { progreso: i + 1 },
                });
                console.log(`[SPEC-248] ${modelo}: ${i + 1}/${casos.length} (aciertos: ${ok})`);
            }
        }

        // Confusion matrix (categoria esperada -> categoria principal predicha)
        const matriz = {};
        const porCategoriaEsperada = {};
        for (const r of resultados) {
            const esp = r.esperada;
            const pred = r.error ? "ERROR" : (r.principal ?? "OTRO");
            matriz[esp] ??= {};
            matriz[esp][pred] = (matriz[esp][pred] || 0) + 1;
            porCategoriaEsperada[esp] ??= { total: 0, ok: 0 };
            porCategoriaEsperada[esp].total++;
            if (r.ok) porCategoriaEsperada[esp].ok++;
        }
        // Precision/Recall por categoría (aproximada: se usa categoría "principal" como predicha).
        const categorias = new Set([...Object.keys(porCategoriaEsperada), ...Object.values(matriz).flatMap((row) => Object.keys(row))]);
        const metricas = {};
        for (const cat of categorias) {
            if (cat === "ERROR") continue;
            let tp = 0, fp = 0, fn = 0;
            for (const [esp, row] of Object.entries(matriz)) {
                for (const [pred, n] of Object.entries(row)) {
                    if (esp === cat && pred === cat) tp += n;
                    else if (pred === cat && esp !== cat) fp += n;
                    else if (esp === cat && pred !== cat) fn += n;
                }
            }
            const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
            const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
            const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
            metricas[cat] = { tp, fp, fn, precision, recall, f1 };
        }

        const accuracy = ok / casos.length;
        const nuevasCategorias = ["CIBERACOSO", "HAPPY_SLAPPING", "STALKING"];
        const recallNuevas = Object.fromEntries(nuevasCategorias.map((c) => [c, metricas[c]?.recall ?? 0]));

        await prisma.simulacionRun.update({
            where: { id: run.id },
            data: {
                estado: "COMPLETADA",
                progreso: casos.length,
                fechaFin: new Date(),
                metricasJson: { accuracy, ok, total: casos.length, porCategoriaEsperada, matriz, metricas, recallNuevas, resultados },
            },
        });

        await prisma.auditLog.create({
            data: {
                accion: "EVAL_RUN_CREATE",
                tipoRecurso: "SimulacionRun",
                recursoId: run.id,
                usuarioId: usuario.id,
                ipAddress: "spec-248-validacion",
                userAgent: "spec-248-validacion",
                metadatos: {
                    contexto: "SPEC-248 · Validación FR-016 · Ley 2564",
                    modelo,
                    accuracy,
                    aciertos: ok,
                    total: casos.length,
                    recallNuevas,
                },
            },
        });

        console.log(`[SPEC-248] ${modelo} COMPLETADA · accuracy ${accuracy.toFixed(3)} · aciertos ${ok}/${casos.length}`);
        console.log("[SPEC-248] Recall nuevas categorías:", recallNuevas);
    }

    await prisma.$disconnect();
    console.log("\n[SPEC-248] Validación FR-016 completa.");
}

main().catch(async (err) => {
    console.error("[SPEC-248] FATAL:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
});
