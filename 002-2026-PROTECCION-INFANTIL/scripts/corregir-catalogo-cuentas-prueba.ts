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
import type { PrismaClient } from "@prisma/client";
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

/** SPEC-717 (I-428): una fila que no se pudo aplicar, con su motivo — para reportarla al final. */
export interface FilaFallida {
    email: string;
    perfilId: string;
    error: string;
}

export interface ResultadoCorreccion {
    resueltos: number;
    filas: FilaCorreccion[];
    escrito: boolean;
    /** SPEC-717 (I-428): filas que reventaron al aplicar (p. ej. 23514). Vacío si todo salió. */
    fallidas: FilaFallida[];
}

function mismaLista(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Resuelve los aliases, deriva el objetivo por índice (distinto por cuenta) y —salvo dry-run—
 * actualiza esos perfiles FILA POR FILA. ABORTA (pre-flight) si algún alias no resuelve a
 * exactamente un perfil (no toca a nadie más).
 *
 * SPEC-717 (I-428): recibe el `PrismaClient` (no una transacción compartida) y aplica cada
 * fila en su PROPIA escritura, atrapando su error. Antes todo iba en un solo `$transaction`:
 * una fila que reventaba (la cuenta E2E que el CHECK de modalidad indultó → 23514) abortaba a
 * las demás y dejaba el trabajo a medias, sin registro de qué faltó. [[dev-corrector-idempotente-no-es-no-destructivo]]
 */
export async function corregirCatalogoCuentasPrueba(
    db: PrismaClient,
    opts: { dryRun: boolean; aliases?: readonly string[] },
): Promise<ResultadoCorreccion> {
    const aliases = opts.aliases ?? ALIASES_OBJETIVO;

    // Resolver cada alias a EXACTAMENTE un perfil (orden estable por email para asignar distinto).
    const resueltos: { email: string; perfilId: string; antes: FilaCorreccion["antes"] }[] = [];
    for (const alias of aliases) {
        const usuarios = await db.usuario.findMany({
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

    if (opts.dryRun) return { resueltos: resueltos.length, filas, escrito: false, fallidas: [] };

    // SPEC-717 (I-428): FILA POR FILA, cada una en su propia escritura y con su error
    // atrapado. Una que reviente (23514 de una cuenta indultada por el CHECK) NO aborta
    // a las demás; al final se reporta cuáles no se pudieron y por qué.
    const fallidas: FilaFallida[] = [];
    for (const f of filas) {
        try {
            // Acotado a ESTE id resuelto — estructuralmente no puede tocar otro perfil.
            await db.perfilProfesional.update({
                where: { id: f.perfilId },
                data: {
                    profesion: f.objetivo.profesion,
                    areasAtencion: f.objetivo.areasAtencion,
                    rangoEtario: f.objetivo.rangoEtario,
                    tituloProfesional: f.objetivo.tituloProfesional,
                    especialidades: f.objetivo.especialidades,
                },
            });
        } catch (e) {
            fallidas.push({
                email: f.email,
                perfilId: f.perfilId,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }
    return { resueltos: resueltos.length, filas, escrito: fallidas.length < filas.length, fallidas };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(
        `[corregir-catalogo] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`,
    );
    // SPEC-717 (I-428): sin `$transaction` envolvente — el corrector aplica fila por fila
    // para que una que reviente no arrastre a las demás.
    const r = await corregirCatalogoCuentasPrueba(prisma, { dryRun: !confirm });
    console.log(`[corregir-catalogo] resueltos: ${r.resueltos}/2 · escrito: ${r.escrito}`);
    for (const f of r.filas) {
        console.log(
            `  ${f.email}  [${f.cambia ? "CAMBIA" : "ya al día"}]  antes: prof=${f.antes.profesion} areas=${f.antes.areas} rango=${f.antes.rango}` +
                `  →  prof=${f.objetivo.profesion} areas=[${f.objetivo.areasAtencion.join(",")}] rango=[${f.objetivo.rangoEtario.join(",")}] titulo="${f.objetivo.tituloProfesional}"`,
        );
    }
    if (r.fallidas.length > 0) {
        console.error(`[corregir-catalogo] ${r.fallidas.length} fila(s) NO se pudieron aplicar:`);
        for (const f of r.fallidas) console.error(`  ✗ ${f.email} (${f.perfilId}): ${f.error}`);
        process.exitCode = 1; // el trabajo quedó incompleto; el operador tiene que verlo.
    }
    if (!confirm) console.log("[corregir-catalogo] DRY-RUN: no se escribió nada. Corré con --confirm para aplicar.");
    else if (r.fallidas.length === 0) console.log("[corregir-catalogo] Listo.");
}

if (process.argv[1]?.endsWith("corregir-catalogo-cuentas-prueba.ts") || process.argv[1]?.endsWith("corregir-catalogo-cuentas-prueba.js")) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
