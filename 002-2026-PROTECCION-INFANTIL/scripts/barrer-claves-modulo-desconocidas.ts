/**
 * I-430 · BARRIDO (solo lectura): FALLA (exit 1) si la BD tiene una `clave` de
 * `ModuloPermisible` que el catálogo del código (`CATALOGO_MODULOS`) NO conoce.
 *
 * Por qué existe: `prisma/seed-modulos-grants.ts` es ADITIVO y NUNCA borra
 * (candado §5.5). Cuando un SPEC retira un módulo del catálogo del código
 * (SPEC-706 quitó `profesional_verificacion`), su fila sigue VIVA en una BD de
 * larga vida, con permisos que ya no gatean ninguna pantalla. Nada miraba esa
 * divergencia: era INVISIBLE. Este barrido la hace visible en cualquier entorno.
 *
 * OJO — no confundir con el "huérfano" de `scripts/arch/modulos-huerfanos-*`:
 * aquello es análisis ESTÁTICO de imports (archivos de src/ sin importador). Esto
 * es divergencia de DATO: filas en la BD que el catálogo del código no declara.
 *
 * Fuente ÚNICA de "lo que el código conoce": el propio `CATALOGO_MODULOS`
 * importado — NO una lista a mano. Si mañana se retira otra clave del catálogo,
 * este barrido la detecta sin tocar nada acá.
 *
 * Uso (cargar el DATABASE_URL del entorno a auditar):
 *   node --env-file=.env --import tsx scripts/barrer-claves-modulo-desconocidas.ts
 *
 * Exit 0 ⇒ la BD no tiene ninguna clave que el código no declare.
 * Exit 1 ⇒ hay divergencia (lista impresa). NO muta nada.
 *
 * PRODUCCIÓN: solo lectura; lo corre el responsable del despliegue (el CEO).
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { CATALOGO_MODULOS } from "../src/lib/permisos-catalogo";

/** Claves que el catálogo del CÓDIGO declara (fuente única). */
export function clavesConocidasPorCodigo(): Set<string> {
    return new Set(CATALOGO_MODULOS.map((m) => m.clave));
}

/**
 * Claves de `ModuloPermisible` en la BD que el catálogo del código NO conoce,
 * ordenadas. Vacío ⇒ sin divergencia. Solo lectura.
 */
export async function clavesModuloDesconocidas(client: PrismaClient): Promise<string[]> {
    const conocidas = clavesConocidasPorCodigo();
    const filas = await client.moduloPermisible.findMany({ select: { clave: true } });
    return filas
        .map((f) => f.clave)
        .filter((clave) => !conocidas.has(clave))
        .sort();
}

async function main(): Promise<void> {
    const conocidas = clavesConocidasPorCodigo();
    const desconocidas = await clavesModuloDesconocidas(prisma);
    console.log(`[barrido-modulos] catálogo del código: ${conocidas.size} claves conocidas.`);
    if (desconocidas.length === 0) {
        console.log(
            "[barrido-modulos] VERDE: la BD no tiene ninguna clave de módulo que el código no conozca.",
        );
        return;
    }
    console.error(
        `[barrido-modulos] ROJO: ${desconocidas.length} clave(s) de ModuloPermisible que el código NO conoce:`,
    );
    for (const clave of desconocidas) console.error(`  - ${clave}`);
    console.error(
        "[barrido-modulos] Cada una es un módulo de permisos que ningún SPEC del código declara " +
            "(seed aditivo que nunca borró tras un retiro). Retirá la fila con un corrector puntual " +
            "(molde: scripts/retirar-modulos-permiso-huerfanos.ts) o, si DEBE existir, agregala a CATALOGO_MODULOS.",
    );
    process.exitCode = 1;
}

// Solo ejecuta al invocarse como script; importable (candado) sin disparar main().
if (process.argv[1]?.endsWith("barrer-claves-modulo-desconocidas.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[barrido-modulos] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
