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
import {
    derivarPerfilCatalogoSeed,
    leerListasCatalogo,
    combosRedApoyo,
    clavesRedApoyoParaIndice,
} from "../lib/perfil-catalogo-seed";

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

    // Combinaciones VARIADAS del catálogo vivo; cada perfil toma UNA por POSICIÓN estable
    // (orden por email + id → el MISMO perfil recibe la MISMA combinación entre corridas →
    // idempotente y determinista). No se clona el directorio.
    const combos = combosRedApoyo(await leerListasCatalogo());

    const perfiles = await tx.perfilProfesional.findMany({
        where: { id: { in: ids } },
        orderBy: [{ usuario: { email: "asc" } }, { id: "asc" }],
        select: {
            id: true,
            profesion: true,
            areasAtencion: true,
            rangoEtario: true,
            tituloProfesional: true,
            especialidades: true,
        },
    });

    type Objetivo = {
        id: string;
        data: { profesion: string; areasAtencion: string[]; rangoEtario: string[]; tituloProfesional: string; especialidades: string[] };
    };
    const objetivos: Objetivo[] = [];
    for (let i = 0; i < perfiles.length; i++) {
        const p = perfiles[i]!;
        // Misma derivación que la siembra/API; ABORTA si el catálogo vivo no valida (nunca "" ni []).
        const der = await derivarPerfilCatalogoSeed(clavesRedApoyoParaIndice(i, combos));
        const alDia =
            p.profesion === der.profesion &&
            mismaLista(p.areasAtencion, der.areasAtencion) &&
            mismaLista(p.rangoEtario, der.rangoEtario) &&
            p.tituloProfesional === der.tituloProfesional &&
            mismaLista(p.especialidades, der.especialidades);
        if (!alDia) {
            objetivos.push({
                id: p.id,
                data: {
                    profesion: der.profesion,
                    areasAtencion: der.areasAtencion,
                    rangoEtario: der.rangoEtario,
                    tituloProfesional: der.tituloProfesional,
                    especialidades: der.especialidades,
                },
            });
        }
    }
    const base = { marcados: perfiles.length, porConverger: objetivos.length, yaAlDia: perfiles.length - objetivos.length };

    if (opts.dryRun) return { ...base, escrito: false };

    // Cada perfil recibe SUS valores (no updateMany: la asignación es distinta por perfil).
    for (const o of objetivos) {
        await tx.perfilProfesional.update({ where: { id: o.id }, data: o.data });
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
