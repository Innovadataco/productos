/**
 * SPEC-685 (seguimiento) · Corrector PUNTUAL de PROD: rellena profesión/áreas/edades (y las
 * etiquetas legado por doble escritura) de DOS cuentas de PRUEBA de Jelkin que quedaron sin
 * catálogo (no son cohorte de siembra ni tienen marca demo). Una está ACTIVO → visible en el
 * directorio con las columnas nuevas en blanco.
 *
 * Selección POR CORREO (no por id suelto): un allowlist de aliases distintivos. GUARDA dura:
 * si no resuelve EXACTAMENTE 1 perfil por alias (2 en total), ABORTA sin escribir — no adivina
 * ni toca ningún otro perfil. El UPDATE queda acotado a esos 2 ids resueltos.
 *
 * Valores: combinaciones DETERMINISTAS y DISTINTAS del catálogo vivo (la misma maquinaria y
 * derivación que las siembras), así las dos no quedan idénticas. Idempotente. DRY-RUN por
 * defecto (solo lee e imprime el diff); `--confirm` aplica en una transacción.
 *
 * Uso: node --import tsx scripts/corregir-catalogo-cuentas-prueba.ts [--confirm]
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseArgs } from "./limpieza/_common";
import {
    derivarPerfilCatalogoSeed,
    leerListasCatalogo,
    combosRedApoyo,
    clavesRedApoyoParaIndice,
    type PerfilCatalogoSeed,
} from "./lib/perfil-catalogo-seed";

/** Aliases distintivos (local-part). Se matchea `startsWith(alias + "@")` → robusto al dominio. */
const ALIASES_OBJETIVO = ["jelkin.carrillo+e2eprofesional", "jelkin.carrillo+profesional1"] as const;

export interface FilaCorreccion {
    email: string;
    perfilId: string;
    antes: { profesion: string | null; areas: number; rango: number };
    objetivo: PerfilCatalogoSeed;
    cambia: boolean;
}

export interface ResultadoCorreccion {
    resueltos: number;
    filas: FilaCorreccion[];
    escrito: boolean;
}

function mismaLista(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * PURA sobre `tx`. Resuelve los aliases, deriva el objetivo por índice (distinto por cuenta) y
 * —salvo dry-run— actualiza SOLO esos perfiles. ABORTA si algún alias no resuelve a exactamente
 * un perfil (no toca a nadie más).
 */
export async function corregirCatalogoCuentasPrueba(
    tx: Prisma.TransactionClient,
    opts: { dryRun: boolean; aliases?: readonly string[] },
): Promise<ResultadoCorreccion> {
    const aliases = opts.aliases ?? ALIASES_OBJETIVO;

    // Resolver cada alias a EXACTAMENTE un perfil (orden estable por email para asignar distinto).
    const resueltos: { email: string; perfilId: string; antes: FilaCorreccion["antes"] }[] = [];
    for (const alias of aliases) {
        const usuarios = await tx.usuario.findMany({
            where: { email: { startsWith: `${alias}@` }, perfilProfesional: { isNot: null } },
            select: {
                email: true,
                perfilProfesional: { select: { id: true, profesion: true, areasAtencion: true, rangoEtario: true } },
            },
        });
        if (usuarios.length !== 1 || !usuarios[0]!.perfilProfesional) {
            throw new Error(
                `[corregir-catalogo] el alias «${alias}» resolvió ${usuarios.length} perfiles (se esperaba 1). ` +
                    "ABORTA sin escribir — no adivino ni toco otros perfiles.",
            );
        }
        const p = usuarios[0]!.perfilProfesional;
        resueltos.push({
            email: usuarios[0]!.email,
            perfilId: p.id,
            antes: { profesion: p.profesion, areas: p.areasAtencion.length, rango: p.rangoEtario.length },
        });
    }
    resueltos.sort((a, b) => a.email.localeCompare(b.email)); // asignación estable por índice

    const combos = combosRedApoyo(await leerListasCatalogo());
    const filas: FilaCorreccion[] = [];
    for (let i = 0; i < resueltos.length; i++) {
        const r = resueltos[i]!;
        const objetivo = await derivarPerfilCatalogoSeed(clavesRedApoyoParaIndice(i, combos));
        const cambia =
            r.antes.profesion !== objetivo.profesion ||
            r.antes.areas !== objetivo.areasAtencion.length ||
            r.antes.rango !== objetivo.rangoEtario.length;
        filas.push({ email: r.email, perfilId: r.perfilId, antes: r.antes, objetivo, cambia });
    }

    if (opts.dryRun) return { resueltos: resueltos.length, filas, escrito: false };

    for (const f of filas) {
        // Acotado a ESTE id resuelto — estructuralmente no puede tocar otro perfil.
        await tx.perfilProfesional.update({
            where: { id: f.perfilId },
            data: {
                profesion: f.objetivo.profesion,
                areasAtencion: f.objetivo.areasAtencion,
                rangoEtario: f.objetivo.rangoEtario,
                tituloProfesional: f.objetivo.tituloProfesional,
                especialidades: f.objetivo.especialidades,
            },
        });
    }
    return { resueltos: resueltos.length, filas, escrito: true };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(
        `[corregir-catalogo] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`,
    );
    const r = await prisma.$transaction((tx) => corregirCatalogoCuentasPrueba(tx, { dryRun: !confirm }));
    console.log(`[corregir-catalogo] resueltos: ${r.resueltos}/2 · escrito: ${r.escrito}`);
    for (const f of r.filas) {
        console.log(
            `  ${f.email}  [${f.cambia ? "CAMBIA" : "ya al día"}]  antes: prof=${f.antes.profesion} areas=${f.antes.areas} rango=${f.antes.rango}` +
                `  →  prof=${f.objetivo.profesion} areas=[${f.objetivo.areasAtencion.join(",")}] rango=[${f.objetivo.rangoEtario.join(",")}] titulo="${f.objetivo.tituloProfesional}"`,
        );
    }
    if (!confirm) console.log("[corregir-catalogo] DRY-RUN: no se escribió nada. Corré con --confirm para aplicar.");
    else console.log("[corregir-catalogo] Listo.");
}

if (process.argv[1]?.endsWith("corregir-catalogo-cuentas-prueba.ts") || process.argv[1]?.endsWith("corregir-catalogo-cuentas-prueba.js")) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
