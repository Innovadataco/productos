import * as fs from "node:fs";
import * as path from "node:path";
import { UNIT_TEST_INCLUDES } from "../../vitest.unit.includes";

/**
 * SPEC-174 (I-55) · sección (e) de arch:check — prohibido mockear/espiar el
 * singleton de Prisma en tests de INTEGRATION.
 *
 * Por qué: bajo el fork compartido (I-54), un `vi.mock("@/lib/prisma")` parcial o
 * un `vi.spyOn(prisma.*)` sobrevivía entre archivos y dejaba el singleton roto
 * (`client.parametroSistema.findUnique is not a function` en CI-Linux). SPEC-174
 * corre un fork por archivo, pero la regla evita reintroducir el patrón que hizo
 * el daño (y que además rompe la higiene intra-archivo).
 *
 * Alcance: archivos del project INTEGRATION (src/**`*.test.ts(x)` menos los del
 * project unit de `vitest.unit.includes.ts`). La migración de los mockers del
 * project unit (queue, ai/rubrica*, simulacion/*) queda como deuda I-56 — el
 * project unit no comparte fork ni BD y su riesgo es el que ZEUS autorizó aplazar
 * (fallback de la decisión de compuerta: "regla solo integration + unit como
 * DEUDA declarada, nunca en silencio").
 *
 * Excepciones: solo las de `prisma-mocks-allowlist.json` (cada una con razón
 * documentada y aprobada por ZEUS).
 */

interface EntradaAllowlist {
    archivo: string;
    razon: string;
}

const RUTA_ALLOWLIST = path.resolve(__dirname, "prisma-mocks-allowlist.json");
const RUTA_SRC = path.resolve(__dirname, "../../src");

// vi.spyOn(prisma ... / vi.spyOn(\n prisma ...
export const PATRON_SPY = /vi\.spyOn\(\s*prisma[,\.]/;
// vi.mock("./prisma" | "../prisma" | "../../lib/prisma" | "@/lib/prisma" | ...)
export const PATRON_MOCK = /vi\.mock\(\s*["'`](@\/lib\/prisma|\.{1,2}\/[\w/.-]*prisma)["'`]/;

function* caminarTests(dir: string): Generator<string> {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const completa = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            yield* caminarTests(completa);
        } else if (/\.test\.tsx?$/.test(entrada.name)) {
            yield completa;
        }
    }
}

export interface InfractorPrismaMock {
    archivo: string;
    linea: number;
    patron: "spyOn" | "mock";
    texto: string;
}

export function buscarInfractores(): InfractorPrismaMock[] {
    const allowlist = new Set(
        (JSON.parse(fs.readFileSync(RUTA_ALLOWLIST, "utf-8")) as EntradaAllowlist[]).map((e) => e.archivo)
    );
    const unit = new Set(UNIT_TEST_INCLUDES);
    const infractores: InfractorPrismaMock[] = [];

    for (const rutaAbsoluta of caminarTests(RUTA_SRC)) {
        const relativa = path.relative(path.resolve(__dirname, "../.."), rutaAbsoluta).split(path.sep).join("/");
        if (unit.has(relativa)) continue; // project unit: deuda I-56 declarada
        if (allowlist.has(relativa)) continue;

        const lineas = fs.readFileSync(rutaAbsoluta, "utf-8").split("\n");
        lineas.forEach((texto, i) => {
            if (PATRON_SPY.test(texto)) {
                infractores.push({ archivo: relativa, linea: i + 1, patron: "spyOn", texto: texto.trim() });
            } else if (PATRON_MOCK.test(texto)) {
                infractores.push({ archivo: relativa, linea: i + 1, patron: "mock", texto: texto.trim() });
            }
        });
    }
    return infractores;
}

// CLI: `npx tsx scripts/arch/no-prisma-mocks.ts` (también la usa arch-check.ts).
if (process.argv[1] && process.argv[1].endsWith("no-prisma-mocks.ts")) {
    const infractores = buscarInfractores();
    if (infractores.length === 0) {
        console.log("[no-prisma-mocks] VERDE: cero mocks/spies del singleton de Prisma en tests de integration.");
    } else {
        console.error(`[no-prisma-mocks] ROJO: ${infractores.length} infracciones:`);
        for (const f of infractores) console.error(`  - ${f.archivo}:${f.linea} [${f.patron}] ${f.texto}`);
        process.exitCode = 1;
    }
}
