/**
 * SPEC-717 (I-428) · Corrector de FILAS INDULTADAS por el CHECK de modalidad.
 *
 * El CHECK `PerfilProfesional_modalidad_estado_check` (`estado = 'BORRADOR' OR atiendeVirtual OR
 * atiendePresencial`) entró NOT VALID: nunca se evaluó sobre lo que ya existía. Puede haber filas
 * no-BORRADOR sin ninguna modalidad —creadas antes de la compuerta de SPEC-673— que hoy NO admiten
 * ningún UPDATE (Postgres evalúa el CHECK sobre la fila nueva → 23514) y que, al aprobarse, revientan.
 *
 * Este corrector las devuelve a **BORRADOR**: es su estado VERDADERO (el perfil está incompleto,
 * le falta elegir cómo atiende) y es la ÚNICA transición que el CHECK permite sobre una fila sin
 * modalidad (`estado = 'BORRADOR'` satisface el primer disyunto). Desde ahí el dueño la completa
 * por el producto —elegir modalidad—, que es el camino previsto. Nadie escribe la BD a mano.
 *
 * DRY-RUN por defecto (solo lee e imprime); `--confirm` aplica FILA POR FILA (una que reviente no
 * aborta a las demás). Idempotente: la 2ª corrida no encuentra nada. ABORTA ante un flag desconocido
 * (`parseArgs`). Tras dejarlo en cero filas, el CHECK puede pasar a VALIDATE (decisión aparte, CEO).
 *
 * Uso: node --import tsx scripts/corregir-perfiles-sin-modalidad.ts [--confirm]
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseArgs } from "./limpieza/_common";

export interface FilaSinModalidad {
    perfilId: string;
    email: string;
    estado: string;
}

export interface FilaFallidaModalidad {
    perfilId: string;
    email: string;
    error: string;
}

export interface ResultadoModalidad {
    /** Filas no-BORRADOR sin ninguna modalidad (las indultadas). */
    encontrados: number;
    filas: FilaSinModalidad[];
    corregidos: number;
    fallidas: FilaFallidaModalidad[];
    escrito: boolean;
}

/**
 * Devuelve a BORRADOR toda fila no-BORRADOR sin modalidad. Recibe el `PrismaClient` (no una
 * transacción compartida) y aplica cada fila en su propia escritura, con su error atrapado.
 */
export async function corregirPerfilesSinModalidad(
    db: PrismaClient,
    opts: { dryRun: boolean },
): Promise<ResultadoModalidad> {
    const perfiles = await db.perfilProfesional.findMany({
        where: { estado: { not: "BORRADOR" }, atiendeVirtual: false, atiendePresencial: false },
        select: { id: true, estado: true, usuario: { select: { email: true } } },
        orderBy: { id: "asc" },
    });
    const filas: FilaSinModalidad[] = perfiles.map((p) => ({
        perfilId: p.id,
        email: p.usuario.email,
        estado: p.estado,
    }));

    if (opts.dryRun) return { encontrados: filas.length, filas, corregidos: 0, fallidas: [], escrito: false };

    const fallidas: FilaFallidaModalidad[] = [];
    let corregidos = 0;
    for (const f of filas) {
        try {
            // BORRADOR es el estado verdadero (incompleto) y la única transición que el CHECK
            // permite sobre una fila sin modalidad. NO se inventa una modalidad: el dueño la elige.
            await db.perfilProfesional.update({ where: { id: f.perfilId }, data: { estado: "BORRADOR" } });
            corregidos++;
        } catch (e) {
            fallidas.push({ perfilId: f.perfilId, email: f.email, error: e instanceof Error ? e.message : String(e) });
        }
    }
    return { encontrados: filas.length, filas, corregidos, fallidas, escrito: corregidos > 0 };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(
        `[corregir-modalidad] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`,
    );
    const r = await corregirPerfilesSinModalidad(prisma, { dryRun: !confirm });
    console.log(`[corregir-modalidad] filas no-BORRADOR sin modalidad: ${r.encontrados}`);
    for (const f of r.filas) {
        console.log(`  ${f.email} (${f.perfilId}) estado=${f.estado}  →  BORRADOR`);
    }
    if (confirm) {
        console.log(`[corregir-modalidad] corregidos: ${r.corregidos}/${r.encontrados}`);
        if (r.fallidas.length > 0) {
            console.error(`[corregir-modalidad] ${r.fallidas.length} fila(s) NO se pudieron corregir:`);
            for (const f of r.fallidas) console.error(`  ✗ ${f.email} (${f.perfilId}): ${f.error}`);
            process.exitCode = 1;
        } else {
            console.log("[corregir-modalidad] Listo. El CHECK puede pasar a VALIDATE (decisión del CEO, con respaldo).");
        }
    } else {
        console.log("[corregir-modalidad] DRY-RUN: no se escribió nada. Corré con --confirm para aplicar.");
    }
}

if (
    process.argv[1]?.endsWith("corregir-perfiles-sin-modalidad.ts") ||
    process.argv[1]?.endsWith("corregir-perfiles-sin-modalidad.js")
) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
