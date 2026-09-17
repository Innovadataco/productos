/**
 * SPEC-685 · Convergedor de PROD: sobre la corrida red-apoyo-676 YA EXISTENTE, actualiza SOLO las
 * 5 columnas de catálogo/legado (profesion, areasAtencion, rangoEtario, tituloProfesional,
 * especialidades) de los PerfilProfesional MARCADOS de esa corrida. NO toca ids ni vínculos.
 *
 * Por qué converger y no purgar (veredicto CEO 17-09): purgar+resembrar cambia los ids y rompe
 * las verificaciones (firmante .invalid), las citas y las marcas. Este modo es SEPARADO de la
 * siembra completa (`poblar-red-apoyo.ts`), que conserva su I-405 (abortar si la corrida existe).
 *
 * Los VALORES salen de `derivarPerfilCatalogoSeed(CLAVES_SEED_RED_APOYO)` — la misma derivación
 * que la siembra y la doble escritura de la API. DRY-RUN por defecto (solo lee y cuenta; NO
 * escribe). `--confirm` aplica en una transacción. Idempotente (una 2ª corrida converge 0).
 *
 * Uso: node --import tsx scripts/demo-prod/converger-catalogo-red-apoyo.ts [--confirm]
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { parseArgs } from "../limpieza/_common";
import { CORRIDA_RED } from "./lib/red-apoyo-plan";
import { derivarPerfilCatalogoSeed, CLAVES_SEED_RED_APOYO } from "../lib/perfil-catalogo-seed";

export interface ResultadoConvergencia {
    /** Perfiles marcados de la corrida. */
    marcados: number;
    /** De esos, cuántos difieren del catálogo y (con --confirm) se actualizarían/actualizaron. */
    porConverger: number;
    /** Cuántos ya estaban al día. */
    yaAlDia: number;
    escrito: boolean;
}

function mismaLista(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * PURA sobre `tx`: converge las 5 columnas de catálogo/legado de los perfiles marcados de la
 * corrida. En dry-run NO escribe (solo lee y cuenta) — la base queda idéntica.
 */
export async function convergerCatalogoRedApoyo(
    tx: Prisma.TransactionClient,
    opts: { dryRun: boolean },
): Promise<ResultadoConvergencia> {
    const marcas = await tx.demoMarcado.findMany({
        where: { entidad: "PerfilProfesional", metadata: { path: ["corrida"], equals: CORRIDA_RED } },
        select: { entidadId: true },
    });
    const ids = marcas.map((m) => m.entidadId);
    if (ids.length === 0) return { marcados: 0, porConverger: 0, yaAlDia: 0, escrito: false };

    // Misma derivación que la siembra/API; ABORTA si el catálogo vivo no valida (nunca "" ni []).
    const catalogo = await derivarPerfilCatalogoSeed(CLAVES_SEED_RED_APOYO);

    const perfiles = await tx.perfilProfesional.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            profesion: true,
            areasAtencion: true,
            rangoEtario: true,
            tituloProfesional: true,
            especialidades: true,
        },
    });
    const alDia = (p: (typeof perfiles)[number]): boolean =>
        p.profesion === catalogo.profesion &&
        mismaLista(p.areasAtencion, catalogo.areasAtencion) &&
        mismaLista(p.rangoEtario, catalogo.rangoEtario) &&
        p.tituloProfesional === catalogo.tituloProfesional &&
        mismaLista(p.especialidades, catalogo.especialidades);

    const porConverger = perfiles.filter((p) => !alDia(p)).map((p) => p.id);
    const base = { marcados: perfiles.length, porConverger: porConverger.length, yaAlDia: perfiles.length - porConverger.length };

    if (opts.dryRun) return { ...base, escrito: false };

    if (porConverger.length > 0) {
        await tx.perfilProfesional.updateMany({
            where: { id: { in: porConverger } },
            data: {
                profesion: catalogo.profesion,
                areasAtencion: catalogo.areasAtencion,
                rangoEtario: catalogo.rangoEtario,
                tituloProfesional: catalogo.tituloProfesional,
                especialidades: catalogo.especialidades,
            },
        });
    }
    return { ...base, escrito: true };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(
        `[converger-catalogo-red-apoyo] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`,
    );
    const r = await prisma.$transaction((tx) => convergerCatalogoRedApoyo(tx, { dryRun: !confirm }));
    console.log(
        `[converger-catalogo-red-apoyo] corrida ${CORRIDA_RED}: marcados=${r.marcados} · al día=${r.yaAlDia} · ` +
            `por converger=${r.porConverger} · escrito=${r.escrito}`,
    );
    if (r.marcados === 0) {
        console.log("[converger-catalogo-red-apoyo] no hay perfiles marcados de esa corrida (¿purgada o sin sembrar?). Nada que hacer.");
    } else if (!confirm) {
        console.log("[converger-catalogo-red-apoyo] DRY-RUN: no se escribió nada. Corré con --confirm para converger.");
    } else {
        console.log("[converger-catalogo-red-apoyo] Listo.");
    }
}

if (process.argv[1]?.endsWith("converger-catalogo-red-apoyo.ts") || process.argv[1]?.endsWith("converger-catalogo-red-apoyo.js")) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
