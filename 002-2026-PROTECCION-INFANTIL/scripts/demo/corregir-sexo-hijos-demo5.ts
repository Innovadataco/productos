/**
 * PI · Spec 678 (follow-up) · corregir el `sexo` de los hijos demo5 ya sembrados.
 *
 * El sembrador hasheó el `sexo` INDEPENDIENTE del nombre → «Valentina (M)», «Daniel (F)»,
 * visible al abrir la ficha del hijo. Arreglo BARATO (no el correcto — el CEO lo pidió así):
 * un UPDATE in-place sobre los `Hijo` ya marcados `demo_marcado` v5, derivando el sexo del
 * NOMBRE. NO se re-siembra: el sembrador es idempotente por «ya tiene hijo activo» y saltaría
 * los 92. Y NO se toca el sembrador (queda su bug de raíz: un reset + re-siembra lo reproduce
 * — decisión del CEO, ver el reporte de carril; si se planea un reset, arreglar `sexoDemo` ahí).
 *
 * El mapa nombre→sexo es INLINE y cubre exactamente los nombres que el sembrador usó (NOMBRES_NINO,
 * de facto partido por género). Es un script de UNA sola corrida: no necesita fuente compartida.
 * Un nombre fuera del mapa NO se toca (no se adivina el sexo de algo que este script no sembró).
 *
 * No dispara nada: actualizar un `Hijo` no encola workers (mismo análisis que la siembra —
 * el motor de señal comunitaria matchea del lado del REPORTE, no del Hijo).
 *
 * Uso (lo corre el CEO; Datos no escribe prod a mano):
 *   node --import tsx scripts/demo/corregir-sexo-hijos-demo5.ts --dry-run
 *   node --import tsx scripts/demo/corregir-sexo-hijos-demo5.ts
 *
 * Idempotente: salta al hijo cuyo `sexo` ya calza con su nombre.
 */
import { PrismaClient } from "@prisma/client";
import { CORRIDA_V5, enLotes } from "./_marcado";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// Los nombres que sembró sembrar-hijos-demo5 (NOMBRES_NINO), mapeados a su género.
const SEXO_POR_NOMBRE: Record<string, "M" | "F"> = {
    Mateo: "M", Samuel: "M", Martín: "M", Tomás: "M", Emiliano: "M", Benjamín: "M", Gabriel: "M", Daniel: "M",
    Emma: "F", Sofía: "F", Valentina: "F", Isabella: "F", Luciana: "F", Antonella: "F", Salomé: "F", Mariana: "F",
};

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
            prisma.hijo.findMany({
                where: { id: { in: trozo } },
                select: { id: true, nombre: true, sexo: true },
            }),
        )
    ).flat();

    let corregidos = 0;
    let yaOk = 0;
    let fueraDeMapa = 0;
    for (const h of hijos) {
        const correcto = SEXO_POR_NOMBRE[h.nombre] ?? null;
        if (correcto === null) {
            fueraDeMapa++; // nombre que este script no sembró → no se adivina
            continue;
        }
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

    console.log(`[corregir-sexo-hijos] hijos v5: ${hijos.length} · ${DRY_RUN ? "corregiría" : "corregidos"}: ${corregidos} · ya OK: ${yaOk} · nombre fuera del mapa (no tocados): ${fueraDeMapa}`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error("[corregir-sexo-hijos] FALLO:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
});
