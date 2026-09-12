/**
 * PI · Spec 678 (follow-up) · corregir el `sexo` de los hijos demo5 ya sembrados.
 *
 * El sembrador viejo hasheó el `sexo` INDEPENDIENTE del nombre → «Valentina (M)», visible al
 * abrir la ficha del hijo. Este UPDATE in-place corrige SOLO los M/F que no calzan con el
 * nombre (`generoDeNombre`).
 *
 * CONSERVA el ~10% `OTRO` existente TAL CUAL — no lo reasigna ni lo borra: `OTRO` es un valor
 * legítimo del enum, el único que ejercita ese camino del formulario, y en un producto sobre
 * menores borrarlo del demo tiene lectura propia. Uniformar el demo sería el mismo error que
 * el 70/30 evita, en la otra dirección. (La RAÍZ ya quedó arreglada: el sembrador deriva el
 * sexo del nombre + su ~10% OTRO deliberado, así una corrida nueva tampoco produce «Valentina (M)».)
 *
 * No re-siembra (el sembrador salta a quien ya tiene hijo activo). No dispara workers (un
 * update de `Hijo` no encola nada). Un nombre fuera de la lista demo NO se toca (no se adivina).
 *
 * Uso (lo corre el CEO; Datos no escribe prod a mano):
 *   node --import tsx scripts/demo/corregir-sexo-hijos-demo5.ts --dry-run
 *   node --import tsx scripts/demo/corregir-sexo-hijos-demo5.ts
 *
 * Idempotente: salta `OTRO` y salta los M/F que ya calzan con el nombre.
 */
import { PrismaClient } from "@prisma/client";
import { CORRIDA_V5, enLotes } from "./_marcado";
import { generoDeNombre } from "./_sexo-hijo-demo";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
    // Hijos marcados demo_marcado corrida v5 (los que sembró el poblador; un real no está).
    const marcados = await prisma.demoMarcado.findMany({
        where: { entidad: "Hijo" },
        select: { entidadId: true, metadata: true },
    });
    const idsV5 = marcados
        .filter((m) => (m.metadata as { corrida?: string } | null)?.corrida === CORRIDA_V5)
        .map((m) => m.entidadId);

    const hijos = (
        await enLotes(idsV5, (trozo) =>
            prisma.hijo.findMany({ where: { id: { in: trozo } }, select: { id: true, nombre: true, sexo: true } }),
        )
    ).flat();

    let corregidos = 0;
    let yaOk = 0;
    let otroConservado = 0;
    let fueraDeMapa = 0;
    const distribucion: Record<"M" | "F" | "OTRO", number> = { M: 0, F: 0, OTRO: 0 };
    for (const h of hijos) {
        const g = generoDeNombre(h.nombre);
        if (g === null) {
            fueraDeMapa++; // nombre que este script no sembró → no se adivina
            continue;
        }
        if (h.sexo === "OTRO") {
            distribucion.OTRO++;
            otroConservado++; // OTRO se DEJA donde está (valor legítimo, no se churnnea)
            continue;
        }
        distribucion[g]++; // el M/F final es el del nombre
        if (h.sexo === g) {
            yaOk++;
            continue;
        }
        // M/F que no calza con el nombre (o null) → corregir al del nombre.
        if (DRY_RUN) {
            console.log(`  [dry] ${h.nombre}: ${h.sexo ?? "null"} → ${g}`);
        } else {
            await prisma.hijo.update({ where: { id: h.id }, data: { sexo: g } });
        }
        corregidos++;
    }

    console.log(`[corregir-sexo-hijos] hijos v5: ${hijos.length} · ${DRY_RUN ? "corregiría" : "corregidos"}: ${corregidos} · ya OK: ${yaOk} · OTRO conservado: ${otroConservado} · fuera del mapa: ${fueraDeMapa}`);
    console.log(`[corregir-sexo-hijos] distribución final: M=${distribucion.M} · F=${distribucion.F} · OTRO=${distribucion.OTRO}`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("[corregir-sexo-hijos] FALLO:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
});
