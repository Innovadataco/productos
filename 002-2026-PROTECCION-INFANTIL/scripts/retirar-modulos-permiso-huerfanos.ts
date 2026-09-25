/**
 * SPEC-725 (I-430) · Corrector de PROD (dry-run → --confirm, idempotente): retira los módulos
 * de permisos HUÉRFANOS que el catálogo del código (`CATALOGO_MODULOS`) YA NO declara, junto con
 * sus grants. Hoy son cinco claves, retiradas por distintos SPECs (verificadas huérfanas contra el
 * barrido en prod + confirmadas sin lector de permiso — ni catálogo ni assertModulo/nav):
 *   - `profesional_verificacion` (SPEC-706): «Mi estado» dejó de ser pantalla; vive en `profesional_ficha`.
 *   - `profesional_citaciones` (SPEC-732 / #684): «Citaciones» se unificó en `profesional_calendario`.
 *   - `padre` (SPEC-194): renombrado a `padres` (vista unificada de usuarios); la clave singular no gatea nada.
 *   - `ia_eval`: superseded por `centro_control_ia` + `ia_*`; 0 referencias en src/.
 *   - `apelaciones`: la feature vive pero la gatea `comite_bandeja` (SPEC-110); esta clave suelta no gatea nada.
 *
 * Contexto: `prisma/seed-modulos-grants.ts` es ADITIVO y NUNCA borra (deriva de `CATALOGO_MODULOS`,
 * así que un retiro deja de sembrar la clave, pero NO borra la fila ya existente). En una BD de
 * larga vida la fila de `ModuloPermisible` sigue viva con permisos ADMIN/PROFESIONAL ACTIVOS que ya
 * no gatean NINGUNA pantalla. Un admin que alterna ese toggle cree que cierra un acceso y no cierra
 * nada: el texto miente sobre la conducta. El barrido (`barrer-claves-modulo-desconocidas.ts`) hace
 * visible la divergencia; este corrector la retira.
 *
 * A diferencia de `scripts/revocar-grants-modulos-muertos.ts` (que DESACTIVA y CONSERVA la fila,
 * restaurable por ADMIN), acá se BORRA la fila: el módulo ya no existe en el código, no es un
 * permiso que un admin deba poder reactivar.
 *
 * Seguridad (D-121), por cada clave:
 *   - Interlock con el catálogo: si la clave VOLVIERA a `CATALOGO_MODULOS` (alguien la re-declara),
 *     ABORTA esa clave — nunca borra un módulo que el código todavía conoce.
 *   - Solo opera sobre la clave nombrada (delete por `clave` @unique / `id` de esa fila).
 *   - Aborta esa clave si la fila tuviera submódulos (JerarquiaModulos es onDelete: Restrict; no
 *     borramos hijos en cascada ni chocamos con la FK cruda). Ambas claves son hoja.
 *   - Borra los grants EXPLÍCITAMENTE (no confía solo en el ON DELETE CASCADE), luego la fila, todo
 *     en una transacción; deja AuditLog.
 *   - Idempotente: si la fila ya no está, no hace nada.
 *   - Aislado por clave: la falla de una NO frena a las otras; sale con código ≠ 0 si alguna falló.
 *   - Aborta ante cualquier flag que no sea --confirm.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/retirar-modulos-permiso-huerfanos.ts            (DRY-RUN)
 *   node --env-file=.env --import tsx scripts/retirar-modulos-permiso-huerfanos.ts --confirm  (APLICA)
 *
 * PRODUCCIÓN: lo corre el responsable del despliegue (el CEO), no un worker.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { CATALOGO_MODULOS } from "../src/lib/permisos-catalogo";

/**
 * Claves huérfanas que retira este corrector (lista DELIBERADA, no «todo lo desconocido»: una clave
 * desconocida podría ser un módulo NUEVO que DEBE agregarse al catálogo, no borrarse). Cada entrada
 * = un módulo retirado del catálogo por un SPEC.
 */
export const CLAVES_A_RETIRAR = [
    "profesional_verificacion", // SPEC-706: «Mi estado» dejó de ser pantalla (vive en profesional_ficha).
    "profesional_citaciones", // SPEC-732 (#684): «Citaciones» se unificó en profesional_calendario.
    "padre", // SPEC-194: renombrado a `padres` (vista unificada de usuarios); 0 usos como llave de permiso.
    "ia_eval", // Superseded por `centro_control_ia` + `ia_*`; 0 referencias en src/.
    "apelaciones", // Feature viva pero gateada por `comite_bandeja` (SPEC-110); la clave suelta no gatea nada.
] as const;

export interface ResultadoRetiroModulo {
    /** La fila existía en esta BD al momento de correr. */
    encontrado: boolean;
    /** Grants (PermisoModulo) eliminados. En dry-run: los que se eliminarían. */
    permisosEliminados: number;
    /** Roles de esos grants, con marca de inactivo, ordenados (para el reporte). */
    rolesAfectados: string[];
}

/**
 * Retira una fila de `ModuloPermisible` que el catálogo del código YA NO declara, junto con sus
 * grants. Genérico y acotado a UNA clave. Con `confirm:false` no escribe nada (dry-run).
 */
export async function retirarModuloDivergente(
    client: PrismaClient,
    clave: string,
    opciones: { confirm: boolean },
): Promise<ResultadoRetiroModulo> {
    // Interlock: nunca borrar un módulo que el CÓDIGO todavía conoce. Este corrector solo retira
    // huérfanos (retirados del catálogo). Si alguien re-declaró la clave, borrarla sería quitar un
    // permiso vivo → aborta.
    if (CATALOGO_MODULOS.some((m) => m.clave === clave)) {
        throw new Error(
            `[retiro-modulos] '${clave}' está en CATALOGO_MODULOS: el código LO CONOCE. ` +
                "Este corrector solo retira un módulo HUÉRFANO (retirado del catálogo). Aborta.",
        );
    }

    const fila = await client.moduloPermisible.findUnique({
        where: { clave },
        select: {
            id: true,
            clave: true,
            permisos: { select: { rol: true, activo: true } },
            submodulos: { select: { clave: true } },
        },
    });

    if (!fila) {
        console.log(`[retiro-modulos] '${clave}' no existe en esta BD — nada que retirar (idempotente).`);
        return { encontrado: false, permisosEliminados: 0, rolesAfectados: [] };
    }

    // Guarda de topología: la relación padre/submódulos es onDelete: Restrict. Ambas claves son
    // hoja; si tuviera hijos, algo cambió — aborta.
    if (fila.submodulos.length > 0) {
        throw new Error(
            `[retiro-modulos] '${clave}' tiene ${fila.submodulos.length} submódulo(s) ` +
                `(${fila.submodulos.map((s) => s.clave).join(", ")}). No se esperaba: debería ser hoja. ` +
                "Aborta para no borrar hijos en cascada ni chocar con la FK Restrict. Revisar a mano.",
        );
    }

    const rolesAfectados = fila.permisos.map((p) => `${p.rol}${p.activo ? "" : "(inactivo)"}`).sort();
    console.log(
        `[retiro-modulos] Encontrado ModuloPermisible '${fila.clave}' (id=${fila.id}) con ` +
            `${fila.permisos.length} grant(s): [${rolesAfectados.join(", ")}].`,
    );
    console.log(`[retiro-modulos] Se eliminarán: la fila del módulo + sus ${fila.permisos.length} grant(s).`);

    if (!opciones.confirm) {
        console.log(`[retiro-modulos] DRY-RUN: no se escribió nada para '${clave}'.`);
        return { encontrado: true, permisosEliminados: fila.permisos.length, rolesAfectados };
    }

    const eliminados = await client.$transaction(async (tx) => {
        // Borrado EXPLÍCITO de grants (acotado por el moduloId de ESTA fila), luego la fila. No
        // dependemos solo del ON DELETE CASCADE: explícito y auditable.
        const delGrants = await tx.permisoModulo.deleteMany({ where: { moduloId: fila.id } });
        await tx.moduloPermisible.delete({ where: { id: fila.id } });
        await tx.auditLog.create({
            data: {
                accion: "LOGS_MANTENIMIENTO_PURGA",
                tipoRecurso: "ModuloPermisible",
                recursoId: fila.id,
                ipAddress: "script",
                userAgent: "scripts/retirar-modulos-permiso-huerfanos",
                metadatos: {
                    tipo: "retiro_modulo_huerfano",
                    incidencia: "SPEC-725",
                    clave,
                    grantsEliminados: delGrants.count,
                    roles: fila.permisos.map((p) => p.rol),
                },
            },
        });
        return delGrants.count;
    });

    // Post-condición: la fila ya no está (los grants cayeron con ella).
    const sigue = await client.moduloPermisible.findUnique({ where: { clave }, select: { id: true } });
    if (sigue) throw new Error(`[retiro-modulos] La fila '${clave}' sigue existiendo tras el borrado — aborta.`);

    console.log(`[retiro-modulos] APLICADO: fila '${clave}' retirada + ${eliminados} grant(s) eliminados.`);
    return { encontrado: true, permisosEliminados: eliminados, rolesAfectados };
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const confirm = args.includes("--confirm");
    // ceo-script-destructivo-aborta-ante-flag-desconocido: nada de flags mudos.
    const desconocidos = args.filter((a) => a !== "--confirm");
    if (desconocidos.length > 0) {
        console.error(`[retiro-modulos] Flag(s) no reconocido(s): ${desconocidos.join(", ")}. Uso: [--confirm]. Aborta.`);
        process.exitCode = 1;
        return;
    }
    console.log(`[retiro-modulos] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`);
    console.log(`[retiro-modulos] claves objetivo (retiradas del catálogo): ${CLAVES_A_RETIRAR.join(", ")}`);

    // Aislado por clave: la falla de una no frena a las demás; exit ≠ 0 si alguna falla.
    let fallidas = 0;
    for (const clave of CLAVES_A_RETIRAR) {
        try {
            await retirarModuloDivergente(prisma, clave, { confirm });
        } catch (err) {
            fallidas++;
            console.error(`[retiro-modulos] FALLÓ '${clave}':`, err instanceof Error ? err.message : err);
        }
    }
    if (fallidas > 0) {
        console.error(`[retiro-modulos] ${fallidas} de ${CLAVES_A_RETIRAR.length} clave(s) fallaron. Revisá arriba.`);
        process.exitCode = 1;
        return;
    }
    console.log(`[retiro-modulos] Listo (${confirm ? "aplicado" : "dry-run"}).`);
}

// Solo ejecuta al invocarse como script; importable (candado) sin disparar main().
if (process.argv[1]?.endsWith("retirar-modulos-permiso-huerfanos.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[retiro-modulos] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
