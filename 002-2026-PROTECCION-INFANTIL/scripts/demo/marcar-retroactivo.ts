/**
 * SPEC-412 · marcado RETROACTIVO de lo que ya está sembrado.
 *
 *   reporte previo (por defecto — no escribe):
 *     node --env-file=.env.test --import tsx scripts/demo/marcar-retroactivo.ts \
 *       --motivo="inventariar lo sembrado por v1-v4 antes de resembrar"
 *   real:
 *     ... --confirm
 *
 * El BRIEF A-76 §4 lo pide así: *"el marcador retroactivo es barato y no toca
 * llaves"*. Este guion **no borra y no modifica una sola fila de producto** —
 * solo escribe las filas que faltan en `demo_marcado`.
 *
 * ## Cómo reconoce lo sembrado, y por qué no por fecha
 *
 * El brief proponía identificarlo por fecha (posterior al 31-08) y por
 * `ClasificacionIA.modeloUsado LIKE 'demo-seed%'`. Acá se hace **por el prefijo
 * del id**, que es más preciso por dos razones:
 *
 *  · **El prefijo ES la prueba.** Prisma genera `cuid()`, que siempre empieza
 *    por `c` y nunca contiene guiones. Un id que empieza por `demo` solo pudo
 *    ponerlo un poblador a mano. No hay falsos positivos posibles.
 *  · La fecha es un proxy: arrastraría datos REALES creados el mismo día. Y
 *    `modeloUsado` solo alcanza a `ClasificacionIA` — no dice nada de colegios,
 *    alumnos ni de los 254 casos del comité, que es lo que hay que marcar.
 *
 * `modeloUsado LIKE 'demo-seed%'` sí se usa, pero **como contraste**: al final
 * se comparan los dos conteos y se avisa si no cuadran. Si aparecieran
 * clasificaciones `demo-seed-*` con id de `cuid()` real, eso es un hallazgo
 * nuevo y hay que mirarlo antes de borrar nada.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs, requerirMotivo, log, registrarAuditoriaDemo } from "./_common";
import { marcar, ENTIDADES_ORDEN_BORRADO, INTOCABLES } from "./_marcado";

const prisma = new PrismaClient();

/** La corrida con la que quedan marcadas las filas viejas. */
const CORRIDA_RETRO = "retroactivo-v1-v4";

/**
 * Ningún `cuid()` empieza por esto. Los pobladores v1…v4 usaron `demo-`,
 * `demo2-`, `demo3-` y `demo4-`: con este prefijo caen los cuatro de una.
 */
const PREFIJO_SEMBRADO = "demo";

interface Hallazgo {
    entidad: string;
    ids: string[];
}

/** Lee, por tabla, los ids que empiezan por el prefijo de siembra. */
async function inventariar(): Promise<Hallazgo[]> {
    const hallazgos: Hallazgo[] = [];
    for (const entidad of ENTIDADES_ORDEN_BORRADO) {
        const modelo = entidad.charAt(0).toLowerCase() + entidad.slice(1);
        // @ts-expect-error — acceso dinámico al modelo Prisma; la lista de
        // entidades es la misma que usa el borrado, y el test la cruza.
        const delegado = prisma[modelo];
        if (!delegado || typeof delegado.findMany !== "function") {
            throw new Error(`[marcar-retro] No existe el modelo Prisma "${modelo}" para la entidad "${entidad}".`);
        }
        const filas: { id: string }[] = await delegado.findMany({
            where: { id: { startsWith: PREFIJO_SEMBRADO } },
            select: { id: true },
        });
        if (filas.length > 0) hallazgos.push({ entidad, ids: filas.map((f) => f.id) });
    }
    return hallazgos;
}

/**
 * Contraste con la pista que proponía el brief. No decide nada: informa.
 * Si los números no cuadran, hay siembra que el prefijo no ve (o al revés).
 */
async function contrastarConModeloUsado(idsClasificacionPorPrefijo: number): Promise<void> {
    const porModelo = await prisma.clasificacionIA.count({
        where: { modeloUsado: { startsWith: "demo-seed" } },
    });
    log("marcar-retro", `Contraste — ClasificacionIA por prefijo de id: ${idsClasificacionPorPrefijo}`);
    log("marcar-retro", `Contraste — ClasificacionIA con modeloUsado 'demo-seed*': ${porModelo}`);
    if (porModelo === idsClasificacionPorPrefijo) {
        log("marcar-retro", "Contraste OK: los dos caminos ven lo mismo.");
        return;
    }
    log("marcar-retro", "AVISO: los dos caminos NO coinciden. Hay que mirarlo ANTES de borrar nada.");
    const sinPrefijo = await prisma.clasificacionIA.count({
        where: { modeloUsado: { startsWith: "demo-seed" }, NOT: { id: { startsWith: PREFIJO_SEMBRADO } } },
    });
    if (sinPrefijo > 0) {
        log("marcar-retro", `  · ${sinPrefijo} clasificaciones 'demo-seed*' tienen id de cuid() real: sembradas por otro camino.`);
        log("marcar-retro", "  · Este guion NO las marca (marcar por modeloUsado tocaría datos que no inventarió).");
    }
}

/** Los INTOCABLES no se marcan: marcarlos los pondría en la lista de borrado. */
function quitarIntocables(hallazgos: Hallazgo[]): { hallazgos: Hallazgo[]; quitados: string[] } {
    const quitados: string[] = [];
    const limpios = hallazgos.map((h) => {
        if (h.entidad !== "Colegio") return h;
        const ids = h.ids.filter((id) => {
            const esIntocable = (INTOCABLES.colegios as readonly string[]).includes(id);
            if (esIntocable) quitados.push(`${h.entidad}:${id}`);
            return !esIntocable;
        });
        return { entidad: h.entidad, ids };
    });
    return { hallazgos: limpios.filter((h) => h.ids.length > 0), quitados };
}

async function ejecutar(motivo: string, confirm: boolean): Promise<void> {
    log("marcar-retro", `INICIO — dry-run=${!confirm}, motivo="${motivo}"`);

    const marcadasAntes = await prisma.demoMarcado.count();
    log("marcar-retro", `demo_marcado tiene ${marcadasAntes} filas antes de empezar.`);

    const crudos = await inventariar();
    const { hallazgos, quitados } = quitarIntocables(crudos);
    const total = hallazgos.reduce((s, h) => s + h.ids.length, 0);

    if (total === 0) {
        log("marcar-retro", `No se encontró ninguna fila con id que empiece por "${PREFIJO_SEMBRADO}". Nada que marcar.`);
        return;
    }

    log("marcar-retro", `Encontrado (por prefijo de id, ${total} filas en total):`);
    for (const h of hallazgos) {
        log("marcar-retro", `  · ${h.entidad}: ${h.ids.length}   ej. ${h.ids[0]}`);
    }
    for (const q of quitados) log("marcar-retro", `  INTOCABLE excluido, no se marca: ${q}`);

    const clasifs = hallazgos.find((h) => h.entidad === "ClasificacionIA")?.ids.length ?? 0;
    await contrastarConModeloUsado(clasifs);

    if (!confirm) {
        log("marcar-retro", "Dry-run: no se escribió nada. Pasa --confirm para marcar de verdad.");
        log("marcar-retro", "Recordá: marcar NO borra. El borrado es otro guion y otra decisión.");
        return;
    }

    let escritas = 0;
    for (const h of hallazgos) {
        const n = await marcar(prisma, h.entidad, h.ids, {
            corrida: CORRIDA_RETRO,
            script: "marcar-retroactivo",
            notas: `sembrado por poblador v1-v4 · id con prefijo "${PREFIJO_SEMBRADO}"`,
        });
        escritas += n;
        log("marcar-retro", `  · ${h.entidad}: ${n} marcas nuevas (${h.ids.length - n} ya estaban)`);
    }

    await prisma.$transaction(async (tx) => {
        await registrarAuditoriaDemo(tx, "demo_poblar", motivo, escritas, {
            spec: "SPEC-412",
            operacion: "marcado_retroactivo",
            corrida: CORRIDA_RETRO,
            porEntidad: Object.fromEntries(hallazgos.map((h) => [h.entidad, h.ids.length])),
        });
    });

    const marcadasDespues = await prisma.demoMarcado.count();
    log("marcar-retro", `LISTO — ${escritas} marcas escritas. demo_marcado: ${marcadasAntes} → ${marcadasDespues}.`);
    log("marcar-retro", "No se borró ni se modificó ninguna fila de producto.");
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["motivo", "confirm"]);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    await ejecutar(motivo, args.confirm === true);
}

if (process.argv[1]?.endsWith("marcar-retroactivo.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[marcar-retro] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

export { PREFIJO_SEMBRADO, CORRIDA_RETRO };
