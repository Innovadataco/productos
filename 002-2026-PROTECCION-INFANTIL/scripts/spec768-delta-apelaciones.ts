/**
 * SPEC-768 · Harness del DELTA de apelaciones: compara el cálculo VIEJO (bug de
 * tipos, lunes-viernes sin festivos) contra el NUEVO (fechas/dias-habiles-colombia)
 * sobre las apelaciones vivas. Un veredicto que CAMBIA es HALLAZGO — la decisión
 * de qué hacer con las apelaciones en curso es del CEO.
 *
 * Corre contra la base a la que apunte DATABASE_URL:
 *   - Dev (BD de test): `node --env-file=.env.test --import tsx scripts/spec768-delta-apelaciones.ts`
 *   - Prod (lo corre el CEO): mismo comando con el .env de prod.
 * Solo lee y compara; no escribe nada. No imprime datos personales (solo número + veredictos).
 */
import { addDays, getDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "../src/lib/prisma";
import { getParametroSistemaValor } from "../src/lib/parametros";
import {
    sumarDiasHabilesColombia,
    diasHabilesTranscurridosColombia,
} from "../src/lib/fechas/dias-habiles-colombia";

// ── VIEJO (pre-768, con el bug de tipos) — copiado SOLO para medir el delta ──
const TZ = "America/Bogota";
const isoOLD = (f: Date) => formatInTimeZone(f, TZ, "yyyy-MM-dd");
const inicioOLD = (f: Date) => {
    const [y, m, d] = isoOLD(f).split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
};
const esHabilOLD = (f: Date) => {
    const d = getDay(inicioOLD(f));
    return d >= 1 && d <= 5;
};
function sumarOLD(f: Date, dias: number): Date {
    const base = inicioOLD(f);
    const off = f.getTime() - base.getTime();
    let c = base;
    let r = dias;
    while (r > 0) {
        c = addDays(c, 1);
        if (esHabilOLD(c)) r -= 1;
    }
    return new Date(c.getTime() + off);
}
function transcurridosOLD(desde: Date, hasta: Date): number {
    let c = inicioOLD(desde);
    const fin = inicioOLD(hasta);
    let n = 0;
    while (c.getTime() < fin.getTime()) {
        c = addDays(c, 1);
        if (esHabilOLD(c)) n += 1;
    }
    return n;
}

async function main() {
    const ahora = new Date();
    const aviso = Number((await getParametroSistemaValor("apelacion.aviso_previo_dias")) ?? 10) || 10;
    const plazo = Number((await getParametroSistemaValor("apelacion.plazo_respuesta_dias_habiles")) ?? 15) || 15;
    console.log(`[delta-768] ahora=${ahora.toISOString()} · aviso=${aviso} hábiles · plazo=${plazo} hábiles`);

    // 1) Demostración con anclas sintéticas en la FRONTERA (revela el mecanismo).
    console.log("\n== Demostración (anclas en frontera) ==");
    const anclas = ["2026-01-03T10:00:00Z", "2026-01-05T10:00:00Z", "2026-01-09T18:00:00Z"];
    for (const s of anclas) {
        const a = new Date(s);
        const vOld = isoOLD(sumarOLD(a, plazo));
        const vNew = formatInTimeZone(sumarDiasHabilesColombia(a, plazo), TZ, "yyyy-MM-dd");
        console.log(`  ancla ${s}: plazo VIEJO=${vOld} NUEVO=${vNew} ${vOld !== vNew ? "★ CAMBIA" : "="}`);
    }

    // 2) Apelaciones VIVAS (abiertas): veredicto viejo vs nuevo.
    const abiertas = await prisma.apelacion.findMany({
        where: { estado: { in: ["RECIBIDA", "EN_REVISION"] } },
        select: { numero: true, creadoEn: true },
        orderBy: { creadoEn: "asc" },
    });
    console.log(`\n== Apelaciones vivas: ${abiertas.length} ==`);
    let flips = 0;
    let plazoCambia = 0;
    for (const a of abiertas) {
        const txOld = transcurridosOLD(a.creadoEn, ahora);
        const txNew = diasHabilesTranscurridosColombia(a.creadoEn, ahora);
        const avisoOld = txOld >= aviso;
        const avisoNew = txNew >= aviso;
        const plazoOld = isoOLD(sumarOLD(a.creadoEn, plazo));
        const plazoNew = formatInTimeZone(sumarDiasHabilesColombia(a.creadoEn, plazo), TZ, "yyyy-MM-dd");
        const flip = avisoOld !== avisoNew;
        const pc = plazoOld !== plazoNew;
        if (flip) flips += 1;
        if (pc) plazoCambia += 1;
        if (flip || pc) {
            console.log(
                `  ${a.numero}: tx ${txOld}→${txNew} · aviso ${avisoOld}→${avisoNew}${flip ? " ★" : ""} · plazo ${plazoOld}→${plazoNew}${pc ? " ★" : ""}`,
            );
        }
    }
    console.log(`\n[delta-768] RESUMEN: ${abiertas.length} vivas · avisos que cambian=${flips} · plazos que cambian de día=${plazoCambia}`);
}

main()
    .catch((e: unknown) => {
        console.error("[delta-768] error:", e instanceof Error ? e.message : e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
