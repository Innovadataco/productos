/**
 * SPEC-369 · POBLADOR demo v2 — volumen con variedad real para BI.
 *
 *   dry-run (por defecto — solo cuenta y muestra el reparto):
 *     node --env-file=.env --import tsx scripts/demo/poblar-demo-v2.ts \
 *       --motivo="poblar demo v2 para BI, volumen con variedad"
 *   real:
 *     ... --confirm
 *
 * Qué crea: ~2.000 reportes con su ClasificacionIA, repartidos en 2024, 2025 y
 * 2026 hasta hoy, con países, ciudades y plataformas variados y relatos creíbles
 * DISTINTOS por categoría (para que el clasificador y los tableros no vean
 * siempre lo mismo). Las categorías sensibles pesan más.
 *
 * Candados (los mismos del v1, más los propios del v2):
 *  1) ClasificacionIA se INSERTA DIRECTA — jamás pg-boss ni Ollama (R16).
 *  2) Cero correos: no se encola nada ni se toca ninguna preferencia.
 *  3) Reversible por marca PROPIA: ids `demo2-`. `borrar-demo-v2` limpia solo lo
 *     suyo — no roza el v1 (`demo-`) ni los datos reales.
 *  4) Idempotente: ids deterministas + createMany skipDuplicates.
 *  5) PII ficticia: nicks y relatos inventados; el texto se cifra por el camino
 *     normal (cifrarTextoReporte).
 *  6) Nunca fechas futuras (dato sucio para BI) y hora en punto (G20).
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { cifrarTextoReporte } from "../../src/lib/texto-reporte-cifrado";
import { rng, pick, parseArgs, requerirMotivo, log, registrarAuditoriaDemo } from "./_common";
import {
    DEMO2,
    id2,
    PESOS_CATEGORIA,
    RELATOS,
    NICKS_DEMO2,
    CIUDADES_DEMO2,
    PAISES_DEMO2,
    elegirPonderado,
    fechaRepartida,
    type CategoriaDemo2,
} from "./_common-v2";

const prisma = new PrismaClient();

const LOTE = 250;
/** Capacidad de la cola: 8 operadores × 500 = 4.000 (orden del CEO). */
const CUPO_OPERADOR_DEFAULT = "500";

type Fila = {
    reporte: Prisma.ReporteCreateManyInput;
    clasificacion: Prisma.ClasificacionIACreateManyInput;
    anio: number;
    categoria: CategoriaDemo2;
};

/** Arma las 2.000 filas en memoria (sin tocar BD): así el dry-run es honesto. */
function construirFilas(
    semilla: number,
    ahora: Date,
    plataformas: { id: string; clave: string }[],
    ciudades: Map<string, { id: string; paisId: string; nombre: string }>
): Fila[] {
    const r = rng(semilla);
    const filas: Fila[] = [];

    for (let n = 1; n <= DEMO2.nReportes; n++) {
        const rId = id2.reporte(n);
        const { categoria } = elegirPonderado(r, PESOS_CATEGORIA);
        const fecha = fechaRepartida(r, ahora);

        const cod = pick(r, CIUDADES_DEMO2);
        const [paisCodigo = "CO", nombreCiudad = ""] = cod.split(":");
        const ciudad = ciudades.get(cod);

        const texto = pick(r, RELATOS[categoria]);
        const esSpam = categoria === "SPAM";
        // Un poco de revisión humana para que BI vea el embudo completo.
        const esRevision = !esSpam && r() < 0.07;
        const estado = esSpam ? "POSIBLE_SPAM" : esRevision ? "REVISION_MANUAL" : "CLASIFICADO";

        filas.push({
            anio: fecha.getUTCFullYear(),
            categoria,
            reporte: {
                id: rId,
                identificador: pick(r, NICKS_DEMO2),
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
                id: id2.clasificacion(rId),
                reporteId: rId,
                categoria: categoria as never,
                confianza: esSpam ? 0.6 + r() * 0.35 : 0.55 + r() * 0.44,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "demo-seed-369",
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
    const porCategoria = new Map<string, number>();
    for (const f of filas) {
        porAnio.set(f.anio, (porAnio.get(f.anio) ?? 0) + 1);
        porCategoria.set(f.categoria, (porCategoria.get(f.categoria) ?? 0) + 1);
    }
    return { porAnio, porCategoria };
}

async function ejecutar(motivo: string, confirm: boolean, semilla: number) {
    const ahora = new Date();
    log("poblar-v2", `INICIO — dry-run=${!confirm}, semilla=${semilla}, motivo="${motivo}"`);

    const [plataformas, ciudadesBd] = await Promise.all([
        prisma.plataforma.findMany({ select: { id: true, clave: true } }),
        prisma.ciudad.findMany({
            where: { pais: { codigo: { in: [...PAISES_DEMO2] } } },
            select: { id: true, paisId: true, nombre: true, pais: { select: { codigo: true } } },
        }),
    ]);
    if (plataformas.length === 0) throw new Error("[poblar-v2] Sin plataformas en BD — corre el seed antes.");
    if (ciudadesBd.length === 0) throw new Error("[poblar-v2] Sin ciudades en BD — corre el seed antes.");

    const ciudades = new Map(ciudadesBd.map((c) => [`${c.pais.codigo}:${c.nombre}`, c]));
    const filas = construirFilas(semilla, ahora, plataformas, ciudades);
    const { porAnio, porCategoria } = contar(filas);

    log("poblar-v2", `Reportes a crear: ${filas.length}`);
    log("poblar-v2", "Por año:");
    for (const [anio, n] of [...porAnio].sort((a, b) => a[0] - b[0])) {
        log("poblar-v2", `  ${anio}: ${n}`);
    }
    log("poblar-v2", "Por categoría:");
    for (const [cat, n] of [...porCategoria].sort((a, b) => b[1] - a[1])) {
        log("poblar-v2", `  ${cat}: ${n}`);
    }

    if (!confirm) {
        log("poblar-v2", `También subiría operadores.cupo_maximo_default a ${CUPO_OPERADOR_DEFAULT}.`);
        log("poblar-v2", "Dry-run: no se escribió nada. Pasa --confirm para ejecutar de verdad.");
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
        log("poblar-v2", `lote ${base / LOTE + 1}: ${creados} reportes acumulados`);
    }

    // La cola real ya no se tapa con el volumen demo (orden del CEO).
    await prisma.parametroSistema.updateMany({
        where: { clave: "operadores.cupo_maximo_default" },
        data: { valor: CUPO_OPERADOR_DEFAULT },
    });

    await prisma.$transaction(async (tx) => {
        await registrarAuditoriaDemo(tx, "demo_poblar", motivo, creados, {
            version: "v2",
            prefijo: DEMO2.prefix,
            porAnio: Object.fromEntries(porAnio),
            porCategoria: Object.fromEntries(porCategoria),
            cupoOperadorDefault: CUPO_OPERADOR_DEFAULT,
        });
    });

    log("poblar-v2", `LISTO — ${creados} reportes nuevos (idempotente: los repetidos se omiten).`);
}

async function main() {
    const args = parseArgs(process.argv);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    const semilla = typeof args.semilla === "string" ? Number.parseInt(args.semilla, 10) : 20260902;
    if (!Number.isFinite(semilla)) throw new Error("[poblar-v2] --semilla debe ser entero.");
    await ejecutar(motivo, confirm, semilla);
}

if (process.argv[1]?.endsWith("poblar-demo-v2.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[poblar-v2] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

export { construirFilas, contar };
