/**
 * SPEC-126 · `npm run arch:check` — la compuerta de la línea base. Cinco verificaciones:
 * ...
 * (e) ANTI-MOCKS PRISMA (SPEC-174, I-55): ningún test de integration espía o
 *     mockea el singleton de Prisma fuera de `prisma-mocks-allowlist.json`.
 *
 * (a) DRIFT: regenera los 5 artefactos (convención: cada `generar-*.ts` exporta una
 *     función `generar*()`) y los compara byte a byte con `docs/architecture/`.
 * (b) HUÉRFANOS: un modelo sin relaciones fuera de `excepciones.json` es ROJO.
 * (c) ASERCIÓN A (puerta ≡ predicado) con la sesión canónica: ROJO solo por
 *     desalineo real; las divergencias del eje anónimo son nota documentada.
 * (d) ASERCIÓN B (el menú no miente): ROJO por href muerto o no resoluble,
 *     listándolo. Regla de pintado D-41: módulo de BD ∧ predicado del proxy.
 *
 * Exit 0 solo si las cuatro están en VERDE. Uso: `npx tsx scripts/arch/arch-check.ts`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ARTEFACTOS } from "./artefactos";
import { ejecutarAsercionA } from "./asercion-puerta-predicado";
import { ejecutarAsercionB } from "./asercion-menu-no-miente";
import { buscarInfractores } from "./no-prisma-mocks";
import { RUTA_DOCS_ARCH, RUTA_EXCEPCIONES, RUTA_SCHEMA } from "./lib/paths";
import { modelosHuerfanos, parsearSchemaPrisma } from "./lib/schema-prisma";

type Generador = () => string | Promise<string>;

/** Convención: el módulo generador exporta UNA función cuyo nombre empieza por `generar`. */
async function cargarGenerador(rutaGenerador: string): Promise<Generador> {
    const relativo = "./" + path.basename(rutaGenerador);
    const modulo = (await import(relativo)) as Record<string, unknown>;
    const nombre = Object.keys(modulo).find((k) => k.startsWith("generar") && typeof modulo[k] === "function");
    if (!nombre) {
        throw new Error(`[Arch:check] ${rutaGenerador} no exporta ninguna función generar*() (convención rota).`);
    }
    return modulo[nombre] as Generador;
}

async function verificarDrift(): Promise<string[]> {
    const fallos: string[] = [];
    for (const artefacto of ARTEFACTOS) {
        const generar = await cargarGenerador(artefacto.generador);
        const regenerado = await generar();
        const destino = path.join(RUTA_DOCS_ARCH, artefacto.archivo);
        const commiteado = fs.existsSync(destino) ? fs.readFileSync(destino, "utf-8") : null;
        if (commiteado !== regenerado) {
            fallos.push(
                commiteado === null
                    ? `${artefacto.archivo} no existe en docs/architecture/ (falta generarlo y commitearlo)`
                    : `${artefacto.archivo} difiere de la regeneración (drift: regenerar con \`npx tsx ${artefacto.generador}\` y commitear)`
            );
        }
    }
    return fallos;
}

function verificarHuerfanos(): string[] {
    const excepciones = JSON.parse(fs.readFileSync(RUTA_EXCEPCIONES, "utf-8")) as { huerfanosPermitidos: string[] };
    const permitidos = new Set(excepciones.huerfanosPermitidos);
    const huerfanos = modelosHuerfanos(parsearSchemaPrisma(RUTA_SCHEMA));
    return huerfanos
        .filter((h) => !permitidos.has(h))
        .map((h) => `modelo huérfano NO declarado: ${h} (declararlo en scripts/arch/excepciones.json solo por decisión explícita de ZEUS)`);
}

async function main() {
    let rojo = false;

    console.log("[Arch:check] (a) Drift de artefactos…");
    const drift = await verificarDrift();
    if (drift.length === 0) {
        console.log(`[Arch:check] (a) VERDE: los ${ARTEFACTOS.length} artefactos regenerados son idénticos a lo commiteado.`);
    } else {
        rojo = true;
        console.error(`[Arch:check] (a) ROJO: ${drift.length} artefactos con drift:`);
        for (const f of drift) console.error(`  - ${f}`);
    }

    console.log("[Arch:check] (b) Huérfanos del modelo de datos…");
    const huerfanos = verificarHuerfanos();
    if (huerfanos.length === 0) {
        console.log("[Arch:check] (b) VERDE: huérfanos solo los declarados en excepciones.json.");
    } else {
        rojo = true;
        console.error(`[Arch:check] (b) ROJO: ${huerfanos.length} huérfanos no declarados:`);
        for (const f of huerfanos) console.error(`  - ${f}`);
    }

    console.log("[Arch:check] (c) Aserción A (puerta ≡ predicado, sesión canónica)…");
    const a = await ejecutarAsercionA();
    if (a.desalineos.length === 0) {
        console.log(`[Arch:check] (c) VERDE: ${a.filas.length} combinaciones alineadas (${a.rutasEvaluadas} rutas × 6 roles).`);
        if (a.notasAnonimo.length > 0) {
            console.log(`[Arch:check] (c) Nota (NO es rojo): ${a.notasAnonimo.length} divergencias del eje anónimo, documentadas en 02-roles-capacidades.md.`);
        }
    } else {
        rojo = true;
        console.error(`[Arch:check] (c) ROJO: ${a.desalineos.length} desalineos reales puerta ≠ predicado:`);
        for (const d of a.desalineos) console.error(`  - ${d.rol} · ${d.ruta} · proxy=${d.proxy} · predicado=${d.predicadoPermite}`);
    }

    console.log("[Arch:check] (d) Aserción B (el menú no miente)…");
    const b = await ejecutarAsercionB();
    if (b.muertos.length === 0) {
        console.log(`[Arch:check] (d) VERDE: ${b.evaluados} hrefs pintados evaluados, todos alcanzables.`);
    } else {
        rojo = true;
        console.error(`[Arch:check] (d) ROJO: ${b.muertos.length} hrefs muertos (pintados pero bloqueados por la puerta):`);
        for (const m of b.muertos) console.error(`  - ${m.rol} · ${m.href} · ${m.origen} · proxy=${m.veredicto}`);
    }

    console.log("[Arch:check] (e) Anti-mocks del singleton de Prisma en tests de integration (SPEC-174, I-55)…");
    const infractores = buscarInfractores();
    if (infractores.length === 0) {
        console.log("[Arch:check] (e) VERDE: cero mocks/spies de Prisma en integration (allowlist: solo las declaradas con razón).");
    } else {
        rojo = true;
        console.error(`[Arch:check] (e) ROJO: ${infractores.length} mocks/spies del singleton de Prisma fuera de la allowlist:`);
        for (const f of infractores) console.error(`  - ${f.archivo}:${f.linea} [${f.patron}] ${f.texto}`);
    }

    if (rojo) {
        console.error("[Arch:check] ROJO: la línea base no está al día o hay un desalineo real. Ver entradas arriba.");
        process.exitCode = 1;
    } else {
        console.log("[Arch:check] VERDE: línea base al día, huérfanos declarados, puerta ≡ predicado, menú honesto.");
    }
}

void main();
