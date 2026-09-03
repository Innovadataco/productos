/**
 * SPEC-382 · POBLADOR demo v4 — 5.000 reportes con más geografía para BI.
 *
 *   dry-run (por defecto):
 *     node --env-file=.env --import tsx scripts/demo/poblar-demo-v4.ts \
 *       --motivo="poblar demo v4 · 5000 reportes · más países"
 *   real:
 *     ... --confirm
 *
 * Reglas duras (mismas que v2, más las nuevas):
 *  1) ClasificacionIA INSERTA DIRECTA — jamás pg-boss ni Ollama.
 *  2) Cero correos: no toca preferencias ni encola nada.
 *  3) Reversible por marca propia: ids `demo4-`. `borrar-demo-v4` limpia solo lo
 *     suyo — no roza v1 (`demo-`) ni v2 (`demo2-`) ni v3 (`demo3-`).
 *  4) Idempotente: ids deterministas + createMany skipDuplicates.
 *  5) PII ficticia (reusa NICKS/RELATOS del v2 · sin PII real).
 *  6) Nunca fechas futuras; hora en punto (G20).
 *  7) SIN huérfanos en REVISION_MANUAL: el 5-10 % que cae en revisión se genera
 *     con menos peso que en v2 y el resto va directo a CLASIFICADO (candado
 *     Jelkin: "que nazcan asignados o clasificados").
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { cifrarTextoReporte } from "../../src/lib/texto-reporte-cifrado";
import { rng, pick, parseArgs, requerirMotivo, log, registrarAuditoriaDemo } from "./_common";
import {
    DEMO4,
    id4,
    PESOS_CATEGORIA,
    RELATOS,
    NICKS_DEMO4,
    CIUDADES_DEMO4,
    PAISES_DEMO4,
    elegirPonderado,
    fechaRepartidaV4,
    type CategoriaDemo4,
} from "./_common-v4";

const prisma = new PrismaClient();

const LOTE = 250;

type Fila = {
    reporte: Prisma.ReporteCreateManyInput;
    clasificacion: Prisma.ClasificacionIACreateManyInput;
    anio: number;
    pais: string;
    categoria: CategoriaDemo4;
};

/**
 * Arma las 5.000 filas en memoria (dry-run honesto: mismos números que el
 * confirm porque los ids son deterministas por semilla).
 */
function construirFilas(
    semilla: number,
    ahora: Date,
    plataformas: { id: string; clave: string }[],
    ciudades: Map<string, { id: string; paisId: string; nombre: string }>,
): Fila[] {
    const r = rng(semilla);
    const filas: Fila[] = [];

    for (let n = 1; n <= DEMO4.nReportes; n++) {
        const rId = id4.reporte(n);
        const { categoria } = elegirPonderado(r, PESOS_CATEGORIA);
        const fecha = fechaRepartidaV4(r, ahora);

        const cod = pick(r, CIUDADES_DEMO4);
        const [paisCodigo = "CO", nombreCiudad = ""] = cod.split(":");
        const ciudad = ciudades.get(cod);

        const texto = pick(r, RELATOS[categoria]);
        const esSpam = categoria === "SPAM";
        // Reducido vs v2 (0.07 → 0.03): candado "sin huérfanos en REVISION_MANUAL".
        // Los pocos que caen ahí saldrán absorbidos por el cupo default (500).
        const esRevision = !esSpam && r() < 0.03;
        const estado = esSpam ? "POSIBLE_SPAM" : esRevision ? "REVISION_MANUAL" : "CLASIFICADO";

        filas.push({
            anio: fecha.getUTCFullYear(),
            pais: paisCodigo,
            categoria,
            reporte: {
                id: rId,
                identificador: pick(r, NICKS_DEMO4),
                plataformaId: pick(r, plataformas).id,
                texto: cifrarTextoReporte(texto),
                textoOriginal: null,
                fechaIncidente: fecha,
                ciudad: ciudad?.nombre ?? nombreCiudad,
                pais: paisCodigo,
                paisId: ciudad?.paisId ?? null,
                ciudadId: ciudad?.id ?? null,
                estado: estado as never,
                esAnonimo: r() < 0.6,
                edadVictima: 10 + Math.floor(r() * 8),
                usuarioId: null,
                origenRol: null,
                tenantId: null,
                prioridadAlta: !esSpam && r() < 0.06,
                keywordsDetectadas: [],
                esRafaga: false,
                fuenteConfianza: 0.4 + r() * 0.6,
                eliminado: false,
                creadoEn: fecha,
                actualizadoEn: fecha,
            },
            clasificacion: {
                id: id4.clasificacion(rId),
                reporteId: rId,
                categoria: categoria as never,
                confianza: esSpam ? 0.6 + r() * 0.35 : 0.55 + r() * 0.44,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "demo-seed-382",
                latenciaMs: 0,
                usoCascada: false,
                posibleAgresorPar: r() < 0.12,
                creadoEn: fecha,
            },
        });
    }
    return filas;
}

function contar(filas: Fila[]) {
    const porAnio = new Map<number, number>();
    const porPais = new Map<string, number>();
    const porCategoria = new Map<string, number>();
    for (const f of filas) {
        porAnio.set(f.anio, (porAnio.get(f.anio) ?? 0) + 1);
        porPais.set(f.pais, (porPais.get(f.pais) ?? 0) + 1);
        porCategoria.set(f.categoria, (porCategoria.get(f.categoria) ?? 0) + 1);
    }
    return { porAnio, porPais, porCategoria };
}

async function ejecutar(motivo: string, confirm: boolean, semilla: number) {
    const ahora = new Date();
    log("poblar-v4", `INICIO — dry-run=${!confirm}, semilla=${semilla}, motivo="${motivo}"`);

    const [plataformas, ciudadesBd] = await Promise.all([
        prisma.plataforma.findMany({ select: { id: true, clave: true } }),
        prisma.ciudad.findMany({
            where: { pais: { codigo: { in: [...PAISES_DEMO4] } } },
            select: { id: true, paisId: true, nombre: true, pais: { select: { codigo: true } } },
        }),
    ]);
    if (plataformas.length === 0) throw new Error("[poblar-v4] Sin plataformas en BD — corre el seed antes.");
    if (ciudadesBd.length === 0) throw new Error("[poblar-v4] Sin ciudades en BD — corre el seed antes.");

    const ciudades = new Map(ciudadesBd.map((c) => [`${c.pais.codigo}:${c.nombre}`, c]));

    // Verificar catálogo antes de construir: si alguna ciudad del v4 no existe
    // en BD, el reporte quedaría con paisId=null (dato sucio para BI). El seed
    // ES/US ya está en este mismo PR; si falta, avisamos claro y abortamos el
    // dry-run también, para no confundir a Jelkin con conteos que no van a poder
    // materializarse.
    const faltantes = CIUDADES_DEMO4.filter((c) => !ciudades.has(c));
    if (faltantes.length > 0) {
        log("poblar-v4", `⚠️  Ciudades del catálogo v4 que NO están en la BD (${faltantes.length}):`);
        for (const c of faltantes) log("poblar-v4", `    · ${c}`);
        throw new Error("[poblar-v4] Corre el seed antes (agrega ES/US y sus ciudades) para que ningún reporte quede con paisId=null.");
    }

    const filas = construirFilas(semilla, ahora, plataformas, ciudades);
    const { porAnio, porPais, porCategoria } = contar(filas);

    log("poblar-v4", `Reportes a crear: ${filas.length}`);
    log("poblar-v4", "Por año:");
    for (const [anio, n] of [...porAnio].sort((a, b) => a[0] - b[0])) {
        log("poblar-v4", `  ${anio}: ${n}`);
    }
    log("poblar-v4", `Por país (${porPais.size} países):`);
    for (const [pais, n] of [...porPais].sort((a, b) => b[1] - a[1])) {
        log("poblar-v4", `  ${pais}: ${n}`);
    }
    log("poblar-v4", "Por categoría:");
    for (const [cat, n] of [...porCategoria].sort((a, b) => b[1] - a[1])) {
        log("poblar-v4", `  ${cat}: ${n}`);
    }

    if (!confirm) {
        log("poblar-v4", "Dry-run: no se escribió nada. Pasa --confirm para ejecutar de verdad.");
        return;
    }

    let creados = 0;
    for (let base = 0; base < filas.length; base += LOTE) {
        const lote = filas.slice(base, base + LOTE);
        await prisma.$transaction(async (tx) => {
            const res = await tx.reporte.createMany({
                data: lote.map((f) => f.reporte),
                skipDuplicates: true,
            });
            await tx.clasificacionIA.createMany({
                data: lote.map((f) => f.clasificacion),
                skipDuplicates: true,
            });
            creados += res.count;
        });
        log("poblar-v4", `lote ${base / LOTE + 1}: ${creados} reportes acumulados`);
    }

    await prisma.$transaction(async (tx) => {
        await registrarAuditoriaDemo(tx, "demo_poblar", motivo, creados, {
            version: "v4",
            prefijo: DEMO4.prefix,
            porAnio: Object.fromEntries(porAnio),
            porPais: Object.fromEntries(porPais),
            porCategoria: Object.fromEntries(porCategoria),
        });
    });

    log("poblar-v4", `LISTO — ${creados} reportes nuevos (idempotente: los repetidos se omiten).`);
}

async function main() {
    const args = parseArgs(process.argv);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    const semilla = typeof args.semilla === "string" ? Number.parseInt(args.semilla, 10) : 20260903;
    if (!Number.isFinite(semilla)) throw new Error("[poblar-v4] --semilla debe ser entero.");
    await ejecutar(motivo, confirm, semilla);
}

if (process.argv[1]?.endsWith("poblar-demo-v4.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[poblar-v4] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

export { construirFilas, contar };
