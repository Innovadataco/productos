/**
 * SPEC-814 · MEDICIÓN (no construye nada) — ¿cuántos candidatos reales tiene una cita típica para
 * REUBICARSE? El cuello medido por el CEO no es área/modalidad (41 virtual, 37 presencial, 25 ambas),
 * sino que el profesional destino tenga una FRANJA PUBLICADA y LIBRE que SOLAPE la franja de la cita.
 *
 * Candidato de una cita CONFIRMADA = profesional ACTIVO, distinto del actual, con una FranjaDisponible
 * `tomada=false`, misma `modalidad`, que solapa `[inicio, fin]` de la franja de la cita
 * (solape medio-abierto: F.inicio < C.fin ∧ F.fin > C.inicio — mismo predicado que `ventanasSolapan`).
 *
 * Es la COTA SUPERIOR de candidatos: área (y rango etario, que hoy NO está cableado en el matcher) la
 * angostarían más. Si el solape ya da 0 en el caso típico, con área da ≤ 0 → el estado vacío de la
 * forma de Diseño es el caso normal (PARÁ).
 *
 * Solo lectura. Correr contra PROD (carril del CEO):
 *   DATABASE_URL="<prod>" node --env-file=.env --import tsx scripts/medir/candidatos-reubicacion-814.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const citas = await prisma.solicitudCita.findMany({
        where: { estado: "CONFIRMADA" },
        select: {
            id: true,
            profesionalId: true,
            franja: { select: { inicio: true, fin: true, modalidad: true } },
        },
    });

    const conCita = citas.filter((c) => c.franja !== null);
    const sinFranja = citas.length - conCita.length;

    const conteos: number[] = [];
    for (const c of conCita) {
        const f = c.franja!;
        const candidatos = await prisma.franjaDisponible.findMany({
            where: {
                tomada: false,
                modalidad: f.modalidad,
                inicio: { lt: f.fin },
                fin: { gt: f.inicio },
                profesionalId: { not: c.profesionalId },
                profesional: { estado: "ACTIVO" },
            },
            select: { profesionalId: true },
            distinct: ["profesionalId"],
        });
        conteos.push(candidatos.length);
    }

    conteos.sort((a, b) => a - b);
    const n = conteos.length;
    const pct = (k: number) => (n ? conteos[Math.min(n - 1, Math.floor((k / 100) * n))] : 0);
    const cero = conteos.filter((x) => x === 0).length;
    const unoOmenos = conteos.filter((x) => x <= 1).length;

    console.log("── SPEC-814 · candidatos de reubicación por solape de franja ──");
    console.log(`citas CONFIRMADA: ${citas.length} (con franja: ${n}; sin franja: ${sinFranja})`);
    if (n) {
        console.log(`candidatos/cita  min=${conteos[0]}  p25=${pct(25)}  MEDIANA=${pct(50)}  p75=${pct(75)}  max=${conteos[n - 1]}`);
        console.log(`citas con 0 candidatos: ${cero} (${Math.round((100 * cero) / n)}%)`);
        console.log(`citas con ≤1 candidato: ${unoOmenos} (${Math.round((100 * unoOmenos) / n)}%)`);
    }
    console.log("Nota: COTA SUPERIOR — área (y rango etario, hoy no cableado) angostan más. Solo estado=ACTIVO (sin el término de vigencia venceEn, que recorta algo).");

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
