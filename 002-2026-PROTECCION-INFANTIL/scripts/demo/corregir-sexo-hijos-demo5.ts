/**
 * PI · Spec 678 (follow-up) · corregir el `sexo` de los hijos demo5 ya sembrados.
 *
 * El sembrador viejo hasheó el `sexo` INDEPENDIENTE del nombre → «Valentina (M)», visible al
 * abrir la ficha del hijo. Este UPDATE in-place recalcula el sexo con la MISMA fuente que el
 * sembrador arreglado (`sexoDemoDeNombre`): M/F derivado del nombre, PERO conservando ~10% en
 * `OTRO` deliberado (valor legítimo del enum; el demo no debe uniformarse — mismo criterio que
 * el 70/30). No re-siembra: el sembrador es idempotente por «ya tiene hijo activo» y saltaría
 * los 92. El ~10% OTRO se ancla al `hijo.id` → estable e idempotente.
 *
 * No dispara nada: actualizar un `Hijo` no encola workers (el motor de señal matchea del lado
 * del REPORTE, no del Hijo). Un nombre fuera de la lista demo NO se toca (no se adivina).
 *
 * Uso (lo corre el CEO; Datos no escribe prod a mano):
 *   node --import tsx scripts/demo/corregir-sexo-hijos-demo5.ts --dry-run
 *   node --import tsx scripts/demo/corregir-sexo-hijos-demo5.ts
 *
 * Idempotente: salta al hijo cuyo `sexo` ya calza con el recalculado.
 */
import { PrismaClient } from "@prisma/client";
import { CORRIDA_V5, enLotes } from "./_marcado";
import { generoDeNombre, sexoDemoDeNombre } from "./_sexo-hijo-demo";

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
    let fueraDeMapa = 0;
    const distribucion: Record<"M" | "F" | "OTRO", number> = { M: 0, F: 0, OTRO: 0 };
    for (const h of hijos) {
        // Solo los que sembró este script (nombre de la lista demo); no adivinar otros.
        if (generoDeNombre(h.nombre) === null) {
            fueraDeMapa++;
            continue;
        }
        const correcto = sexoDemoDeNombre(h.nombre, h.id);
        distribucion[correcto]++;
        if (h.sexo === correcto) {
            yaOk++;
            continue;
        }
        if (DRY_RUN) {
            console.log(`  [dry] ${h.nombre}: ${h.sexo ?? "null"} → ${correcto}`);
        } else {
            await prisma.hijo.update({ where: { id: h.id }, data: { sexo: correcto } });
        }
        corregidos++;
    }

    console.log(`[corregir-sexo-hijos] hijos v5: ${hijos.length} · ${DRY_RUN ? "corregiría" : "corregidos"}: ${corregidos} · ya OK: ${yaOk} · fuera del mapa (no tocados): ${fueraDeMapa}`);
    console.log(`[corregir-sexo-hijos] distribución final: M=${distribucion.M} · F=${distribucion.F} · OTRO=${distribucion.OTRO}`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("[corregir-sexo-hijos] FALLO:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
});
