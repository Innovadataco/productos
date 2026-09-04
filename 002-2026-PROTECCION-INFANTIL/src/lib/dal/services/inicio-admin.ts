/**
 * SPEC-378 · Inicio del administrador — agregador de señales de OPERACIÓN.
 *
 * La pantalla es la alarma de la casa: **vacía cuando todo está bien, grita
 * cuando algo se rompe en silencio.** No es un tablero de métricas de vanidad.
 *
 * Este módulo REUSA lo que ya recoge el servicio `pi-monitor` (HealthProbe:
 * worker/ollama_ping/ollama_smoke/tailscale/indices/notif_pendientes_vencidas)
 * y calcula EN VIVO las señales que hoy no tienen sonda propia:
 *   · S1 correos que no salen (Notificacion FALLIDA en 24 h; patrón cuota → dura).
 *   · S2 racha de análisis IA rechazados (AnalisisExpediente FALLIDO).
 *   · S3 reportes huérfanos por antigüedad (Reporte sin operadorId).
 *   · S4 REVISION_MANUAL reales (menos DemoMarcado — la cola no está tapada
 *     por datos de prueba).
 *   · S6 vigencias por vencer (Colegio.finServicio + Usuario.finServicio).
 *   · S7 comité con casos vencidos según SLA (SolicitudComite PENDIENTE).
 *
 * Los umbrales viven en ParametroSistema (seed idempotente en `prisma/seed.ts`,
 * bloque SPEC-378). La regla dura de Jelkin manda: nunca rojo — todo se
 * muestra en ÁMBAR; el consumidor de la UI no debe pintar rojo.
 *
 * ## SPEC-414 (BRIEF A-76 §3.1, I-271) — el corte CARGA / SALUD
 *
 * El 99 % de lo que hay en producción es sembrado. Una señal que cuenta datos
 * de prueba como trabajo pendiente **hace perder el tiempo de alguien**, así que
 * las señales se parten en dos familias y se tratan distinto:
 *
 *  · **CARGA** (S3 huérfanos, S4 revisión manual, S6 vigencias, S7 comité) son
 *    COLAS DE TRABAJO → **descuentan lo sembrado Y los reportes de simulación**
 *    (dos orígenes de dato de prueba, un solo criterio). Nadie debe atender un
 *    caso de mentira. Por defecto el admin ve solo lo real.
 *  · **SALUD** (S1 correos, S1-bis proveedor, S2 racha IA, S5 jurado, infra)
 *    **cuentan todo**, sembrado y simulaciones incluidas: la falla es real
 *    aunque la dispare una prueba. Si el correo se cae sembrando, se cayó — y si
 *    el motor se cae simulando, se cayó. `correos_fallidos` fue justamente la
 *    pista que destapó I-280.
 *
 * Nada queda oculto: `EstadoInicio.sembrados` lleva cuántas filas se
 * descontaron, y `calcularEstadoInicio({ incluirSembrados: true })` las trae de
 * vuelta para el interruptor de la pantalla.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getParametroSistemaValor } from "@/lib/parametros";
import { logger } from "@/lib/logger";

export type PrioridadSenal = "alta" | "media";

export interface SenalAlarma {
    id: string;
    prioridad: PrioridadSenal;
    texto: string;
    ruta: string;
}

/** Cuánto de lo que se descontó era dato de prueba, y de dónde salió. */
export interface ConteoSembrados {
    /**
     * Registros de prueba DISTINTOS en las tablas que alimentan estas colas
     * (`Reporte`, `Colegio`, `Usuario`, `SolicitudComite`).
     *
     * No es la suma de `porSenal`, y no debe serlo: un mismo reporte sembrado
     * puede quedar fuera de dos colas a la vez (huérfano **y** en revisión
     * manual), y sumarlo dos veces le mentiría al administrador sobre cuánto
     * humo hay. Acá se cuenta la fila una vez, apoyándose en el
     * `@@unique([entidad, entidadId])` del marcador.
     */
    total: number;
    /**
     * Descuentos por señal: cuántas filas sembradas quedaron fuera de CADA cola.
     * Es el desglose auditable — puede solaparse entre colas, a propósito.
     */
    porSenal: Array<{ id: string; sembrados: number }>;
}

export interface OpcionesInicio {
    /**
     * `true` = el interruptor está puesto: las colas de trabajo vuelven a contar
     * lo sembrado. Por defecto `false` — se ve SOLO LO REAL, que es el arreglo
     * de I-271, no un efecto colateral.
     */
    incluirSembrados?: boolean;
}

/** Una señal que NO se pudo calcular. Se muestra; no se esconde (I-294). */
export interface SenalDegradada {
    id: string;
    /** Nombre en cristiano para la pantalla: "cola de revisión manual". */
    etiqueta: string;
}

export interface EstadoInicio {
    alertas: SenalAlarma[];
    /** Señales que reventaron. Vacío = se pudieron mirar todas. */
    degradadas: SenalDegradada[];
    /**
     * Firmas que ya pasaron (verdes) — solo se listan para el modo "tranquilo"
     * con detalle. La pantalla las oculta cuando `alertas.length === 0`.
     */
    ok: Array<{ id: string; texto: string }>;
    /** ISO timestamp de cuándo se agregaron las señales. */
    generadoEn: string;
    /** Milisegundos que tardó agregar todo (para la nota de rendimiento). */
    latenciaMs: number;
    /** Si las colas de trabajo están contando lo sembrado en esta lectura. */
    incluyeSembrados: boolean;
    /** Lo que se descontó (o se habría descontado). Nunca se oculta. */
    sembrados: ConteoSembrados;
}

async function paramInt(clave: string, fallback: number): Promise<number> {
    const raw = await getParametroSistemaValor(clave);
    if (raw === null) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
}

const PATRON_CUOTA = /(quota|rate\s*limit|429|too\s*many\s*requests)/i;

/**
 * **La tabla del marcador se llama `demo_marcado`, no `DemoMarcado`.**
 *
 * El modelo Prisma es `DemoMarcado`, pero lleva `@@map("demo_marcado")`: en SQL
 * crudo va SIEMPRE el nombre físico. Escribirlo con el nombre del modelo fue
 * I-294 — la consulta reventaba en cada lectura y `allSettled` se comía el
 * error, así que la única señal que descontaba datos de prueba **nunca corrió**
 * desde SPEC-378. Hay un test-candado que lee este archivo y falla si vuelve a
 * aparecer `"DemoMarcado"` dentro de una consulta.
 */
const TABLA_MARCADO = Prisma.raw("demo_marcado");

/**
 * SPEC-414 (adenda del CEO 18:2x) · **la simulación del motor también es dato
 * de prueba, y llega por otra puerta.**
 *
 * `simulacion/executor.ts:44` crea `Reporte` **REALES** con `ReporteRepository`
 * y los encola al motor con `sendReporte` — corren los tres modelos de verdad.
 * Solo después los anota en `simulacion_reportes`, que es tabla de enlace. Esos
 * reportes **nunca pasan por `demo_marcado`**, porque no son siembra: son
 * ejercicio del motor y tienen su propia tabla.
 *
 * Sin esto, 200 simulaciones aparecerían como 200 casos "reales" en las colas
 * de trabajo — exactamente el problema que esta spec cierra, entrando por otro
 * lado. Por eso el criterio de CARGA es **«tiene marca de demo O pertenece a
 * una simulación»**: dos orígenes, una sola definición de "no es trabajo real".
 *
 * (Mismo cuidado que con `demo_marcado`: acá va el nombre FÍSICO de la tabla,
 * no el del modelo Prisma — es la lección de I-294.)
 */
const TABLA_SIMULACION = Prisma.raw("simulacion_reportes");

/** Lo que devuelve una cola de trabajo: cuánto hay en total y cuánto es real. */
interface ConteoCarga {
    total: number;
    reales: number;
}

function conteoDesde(fila: { total: bigint; reales: bigint } | undefined): ConteoCarga {
    return { total: Number(fila?.total ?? 0), reales: Number(fila?.reales ?? 0) };
}

/** Cuál de los dos números manda, según esté puesto el interruptor. */
function segunInterruptor(c: ConteoCarga, incluirSembrados: boolean): number {
    return incluirSembrados ? c.total : c.reales;
}

/** Una señal de CARGA: la alarma (si hay) y cuánto de prueba se descontó. */
interface ResultadoCarga {
    senal: SenalAlarma | null;
    sembrados: number;
}

/**
 * Las entidades cuyas filas alimentan las colas de trabajo. Es el universo
 * sobre el que se cuenta el total de datos de prueba que ve el administrador.
 */
const ENTIDADES_DE_CARGA = ["Reporte", "Colegio", "Usuario", "SolicitudComite"] as const;

/**
 * Cuántos registros de prueba DISTINTOS hay en las tablas que alimentan las
 * colas. No suma descuentos, cuenta filas — por eso no se puede inflar
 * contando dos veces el mismo reporte que está en dos colas.
 *
 * Son los dos orígenes: lo sembrado (`demo_marcado`) y los reportes de
 * simulación. Los de simulación se cuentan **descontando** los que además
 * estuvieran marcados, para no sumar la misma fila por dos caminos.
 */
async function contarSembradosDeCarga(): Promise<number> {
    const [marcados, filas] = await Promise.all([
        prisma.demoMarcado.count({ where: { entidad: { in: [...ENTIDADES_DE_CARGA] } } }),
        prisma.$queryRaw<Array<{ n: bigint }>>`
            SELECT COUNT(*)::bigint AS n
            FROM ${TABLA_SIMULACION} sr
            LEFT JOIN ${TABLA_MARCADO} dm
              ON dm."entidad" = 'Reporte' AND dm."entidadId" = sr."reporteId"
            WHERE dm.id IS NULL
        `,
    ]);
    return marcados + Number(filas[0]?.n ?? 0);
}

async function senalCorreosFallidos(): Promise<SenalAlarma | null> {
    const umbral = await paramInt("monitoreo.notif.fallidas_24h_umbral", 5);
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fallidas = await prisma.notificacion.findMany({
        where: { estado: "FALLIDA", createdAt: { gte: desde } },
        select: { ultimoError: true },
        take: 500,
    });
    if (fallidas.length === 0) return null;
    const conCuota = fallidas.some((n) => n.ultimoError && PATRON_CUOTA.test(n.ultimoError));
    // Cuota agotada = alta (bloquea TODO lo que sigue); volumen sobre umbral = media.
    if (conCuota) {
        return {
            id: "correos_no_salen",
            prioridad: "alta",
            texto: `Los correos no están saliendo: cuota del proveedor agotada (${fallidas.length} fallidos en 24 h). Nadie está recibiendo avisos.`,
            ruta: "/dashboard/admin/estadisticas/salud-motor",
        };
    }
    if (fallidas.length >= umbral) {
        return {
            id: "correos_fallidos_volumen",
            prioridad: "media",
            texto: `${fallidas.length} correos fallaron en las últimas 24 h. Revisa el proveedor y los reintentos.`,
            ruta: "/dashboard/admin/estadisticas/salud-motor",
        };
    }
    return null;
}

/**
 * SPEC-401 (I-283) — proveedor de correo caído.
 *
 * `senalCorreosFallidos` mira volumen (5 en 24 h) y patrón de cuota
 * (`PATRON_CUOTA`). Esta señal mira una pregunta distinta: **¿está saliendo
 * ALGÚN correo por razones que NO sean cuota?** — porque cuota ya tiene su
 * propia lectura de alta prioridad (`correos_no_salen`).
 *
 * Tomamos las últimas `ventana` notificaciones EMAIL con estado terminal
 * (ENVIADA o FALLIDA) — `REINTENTANDO` no cuenta porque todavía puede
 * terminar bien en el próximo backoff.
 *
 * Dispara SOLO si:
 *  1. `length >= ventana` (sistema no está idle).
 *  2. Todas son `FALLIDA`.
 *  3. Al menos UNA de esas fallas NO es cuota (`PATRON_CUOTA` no casa) —
 *     si TODAS fueran cuota, `senalCorreosFallidos.correos_no_salen` ya
 *     está gritando eso mismo; no duplicamos ruido (CEO idc-59, 11:13:
 *     "429 daily_quota_exceeded" confirmado en prod hoy).
 *
 * Convive con `senalCorreosFallidos`, no la reemplaza: la de cuota vigila
 * el tope del plan; esta vigila la infraestructura del proveedor.
 */
async function senalProveedorEmailCaido(): Promise<SenalAlarma | null> {
    const ventana = await paramInt("monitoreo.notif.proveedor_caido_ventana", 10);
    // ventana <= 0 desactiva la señal (útil si algún colegio la quiere silenciar).
    if (ventana <= 0) return null;
    const ultimas = await prisma.notificacion.findMany({
        where: {
            canal: "EMAIL",
            estado: { in: ["ENVIADA", "FALLIDA"] },
        },
        orderBy: { createdAt: "desc" },
        select: { estado: true, ultimoError: true },
        take: ventana,
    });
    if (ultimas.length < ventana) return null;
    if (!ultimas.every((n) => n.estado === "FALLIDA")) return null;
    // Si TODAS las fallas son por cuota (PATRON_CUOTA), no gritamos: eso lo
    // dice mejor `senalCorreosFallidos.correos_no_salen`. Basta con que UNA
    // sea distinta a cuota para saber que el problema es del proveedor.
    const alMenosUnaNoEsCuota = ultimas.some(
        (n) => !n.ultimoError || !PATRON_CUOTA.test(n.ultimoError)
    );
    if (!alMenosUnaNoEsCuota) return null;
    return {
        id: "proveedor_email_caido",
        prioridad: "alta",
        texto:
            `El proveedor de correo no aceptó ninguna de las últimas ${ventana} notificaciones ` +
            "(por razones distintas a cuota). Está caído — nadie está recibiendo avisos.",
        ruta: "/dashboard/admin/estadisticas/salud-motor",
    };
}

async function senalAnalisisRachaFallida(): Promise<SenalAlarma | null> {
    const umbral = await paramInt("monitoreo.analisis.fallidos_racha_umbral", 5);
    // Racha "en cola": los últimos N análisis TERMINADOS (FALLIDO o PUBLICADO)
    // ordenados por generadoEn desc — si los últimos `umbral` son todos FALLIDO,
    // el motor está rechazando en serie. Un GENERANDO en la ventana no cuenta
    // (todavía no hay veredicto), así que lo excluimos del universo.
    const ultimos = await prisma.analisisExpediente.findMany({
        where: { estado: { in: ["FALLIDO", "PUBLICADO"] } },
        orderBy: { generadoEn: "desc" },
        select: { estado: true },
        take: umbral,
    });
    if (ultimos.length < umbral) return null;
    if (!ultimos.every((a) => a.estado === "FALLIDO")) return null;
    return {
        id: "motor_ia_rechazando",
        prioridad: "alta",
        texto: `El motor rechazó ${umbral} análisis seguidos. Los expedientes se están quedando sin lectura de la IA.`,
        ruta: "/dashboard/admin/estadisticas/salud-motor",
    };
}

/** S3 · CARGA: reportes sin dueño. Cola de trabajo → descuenta lo sembrado. */
async function senalReportesHuerfanos(incluirSembrados: boolean): Promise<ResultadoCarga> {
    const horas = await paramInt("monitoreo.reportes.sin_dueno_horas", 24);
    const umbral = await paramInt("monitoreo.reportes.sin_dueno_umbral", 3);
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000);
    const filas = await prisma.$queryRaw<Array<{ total: bigint; reales: bigint }>>`
        SELECT COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE dm.id IS NULL AND sr.id IS NULL)::bigint AS reales
        FROM "Reporte" r
        LEFT JOIN ${TABLA_MARCADO} dm
          ON dm."entidad" = 'Reporte' AND dm."entidadId" = r.id
        LEFT JOIN ${TABLA_SIMULACION} sr ON sr."reporteId" = r.id
        WHERE r."estado" IN ('REVISION_MANUAL', 'PENDIENTE')
          AND r."operadorId" IS NULL
          AND r."eliminado" = false
          AND r."creadoEn" < ${desde}
    `;
    const conteo = conteoDesde(filas[0]);
    const sembrados = conteo.total - conteo.reales;
    const n = segunInterruptor(conteo, incluirSembrados);
    if (n < umbral) return { senal: null, sembrados };
    return {
        senal: {
            id: "reportes_huerfanos",
            prioridad: "media",
            texto: `${n} reportes llevan más de ${horas} h sin dueño: los operadores están al tope o no hay activos.`,
            ruta: "/dashboard/admin/operadores/asignar",
        },
        sembrados,
    };
}

/**
 * S4 · CARGA: cola de revisión manual.
 *
 * Acá vivía **I-294**: la consulta decía `LEFT JOIN "DemoMarcado"` y esa tabla
 * no existe (`@@map` la baja a `demo_marcado`). Reventaba en cada lectura y
 * `allSettled` se tragaba el error, así que la única señal que descontaba datos
 * de prueba nunca corrió desde SPEC-378.
 */
async function senalRevisionManual(incluirSembrados: boolean): Promise<ResultadoCarga> {
    const umbral = await paramInt("monitoreo.reportes.revision_manual_umbral", 20);
    const filas = await prisma.$queryRaw<Array<{ total: bigint; reales: bigint }>>`
        SELECT COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE dm.id IS NULL AND sr.id IS NULL)::bigint AS reales
        FROM "Reporte" r
        LEFT JOIN ${TABLA_MARCADO} dm
          ON dm."entidad" = 'Reporte' AND dm."entidadId" = r.id
        LEFT JOIN ${TABLA_SIMULACION} sr ON sr."reporteId" = r.id
        WHERE r."estado" = 'REVISION_MANUAL' AND r."eliminado" = false
    `;
    const conteo = conteoDesde(filas[0]);
    const sembrados = conteo.total - conteo.reales;
    const n = segunInterruptor(conteo, incluirSembrados);
    if (n < umbral) return { senal: null, sembrados };
    return {
        senal: {
            id: "revision_manual_saturada",
            prioridad: "media",
            texto: incluirSembrados
                ? `${n} reportes esperan revisión manual, contando los de prueba. La cola está saturada.`
                : `${n} reportes reales esperan revisión manual (sin contar los de prueba). La cola está saturada.`,
            ruta: "/dashboard/admin",
        },
        sembrados,
    };
}

/**
 * S6 · CARGA: vigencias por vencer. Son gestión comercial a hacer: un colegio
 * sembrado que "vence" no hay que renovarlo con nadie.
 */
async function senalVigenciasPorVencer(incluirSembrados: boolean): Promise<ResultadoCarga> {
    const dias = await paramInt("monitoreo.vigencia.aviso_dias", 7);
    const desde = new Date();
    const hasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    const [filasColegio, filasUsuario] = await Promise.all([
        prisma.$queryRaw<Array<{ total: bigint; reales: bigint }>>`
            SELECT COUNT(*)::bigint AS total,
                   COUNT(*) FILTER (WHERE dm.id IS NULL)::bigint AS reales
            FROM "Colegio" c
            LEFT JOIN ${TABLA_MARCADO} dm
              ON dm."entidad" = 'Colegio' AND dm."entidadId" = c.id
            WHERE c."finServicio" >= ${desde} AND c."finServicio" <= ${hasta}
        `,
        prisma.$queryRaw<Array<{ total: bigint; reales: bigint }>>`
            SELECT COUNT(*)::bigint AS total,
                   COUNT(*) FILTER (WHERE dm.id IS NULL)::bigint AS reales
            FROM "Usuario" u
            LEFT JOIN ${TABLA_MARCADO} dm
              ON dm."entidad" = 'Usuario' AND dm."entidadId" = u.id
            WHERE u."rol" = 'PARENT' AND u."finServicio" >= ${desde} AND u."finServicio" <= ${hasta}
        `,
    ]);
    const colegios = conteoDesde(filasColegio[0]);
    const familias = conteoDesde(filasUsuario[0]);
    const sembrados = colegios.total - colegios.reales + (familias.total - familias.reales);
    const nColegios = segunInterruptor(colegios, incluirSembrados);
    const nFamilias = segunInterruptor(familias, incluirSembrados);
    if (nColegios === 0 && nFamilias === 0) return { senal: null, sembrados };
    const partes: string[] = [];
    if (nColegios > 0) partes.push(`${nColegios} colegio(s)`);
    if (nFamilias > 0) partes.push(`${nFamilias} familia(s)`);
    return {
        senal: {
            id: "vigencias_por_vencer",
            prioridad: "media",
            texto: `${partes.join(" y ")} vencen en los próximos ${dias} días.`,
            ruta: "/dashboard/admin/pagos",
        },
        sembrados,
    };
}

/**
 * SPEC-398 (I-286) — Alarma en vivo del jurado del motor.
 *
 * SALUD DEL SISTEMA: mira las últimas N clasificaciones del pipeline REAL
 * (sin override intencional) y compara los votantes reales —contados con
 * `ClasificacionRubricaVoto`, no inferidos de una cadena de texto— contra el
 * comité configurado (`ia.rubrica.modelos`). Si más de `umbral` de las
 * últimas N votó con menos modelos de los declarados, el motor está
 * degradando en silencio — la señal grita.
 *
 * Por qué existe: I-286 vivió 6 días en producción con el jurado colapsado
 * a un modelo porque **no había nada mirando**. Un test caza la regresión el
 * día que alguien la escribe; esta señal vigila la realidad después.
 * Complementa el candado del código (`pipeline-jurado.test.ts`) — la prueba
 * vigila el código, la señal vigila la realidad (idea del CEO idc-14 ·
 * 2026-09-03 12:25).
 *
 * ¿Por qué `overrideModeloUsado IS NULL`?
 *   El sandbox A/B del admin corre sobre reportes reales y pide un modelo
 *   puntual — no está marcado como demo. Sin el filtro por override, tres
 *   A/B seguidas cantan un falso positivo alto. La bandera `overrideModelo-
 *   Usado` (poblada en `clasificacion.ts` cuando el caller pide override
 *   explícito) distingue los dos casos y hace la alarma **exacta**, no
 *   aproximada.
 *
 * ¿Por qué contar `ClasificacionRubricaVoto` en vez de parsear `modeloUsado`?
 *   Es la medición directa: las filas del voto reflejan los modelos que
 *   REALMENTE opinaron. Parsear el string es una inferencia, y las
 *   inferencias mienten cuando el formato cambia.
 *
 * Al desplegar por primera vez la alarma va a sonar por las 52 clasifica-
 * ciones históricas de I-286 (todas `overrideModeloUsado = NULL`, todas con
 * un solo voto). Eso es correcto: es la alarma probándose sola en vivo. Va
 * a callarse cuando entren ~ventana clasificaciones nuevas con el jurado
 * completo y las viejas salgan del rango.
 */
async function senalJuradoReducido(): Promise<SenalAlarma | null> {
    const ventana = await paramInt("monitoreo.jurado.ventana_clasificaciones", 20);
    const umbral = await paramInt("monitoreo.jurado.max_reducidas_umbral", 3);

    // Comité configurado (fuente de verdad: `ia.rubrica.modelos`). Si el
    // parámetro no está seteado o es una lista de 1, no hay comparación
    // posible; mejor no gritar que gritar sin sentido.
    const paramComite = await getParametroSistemaValor("ia.rubrica.modelos");
    if (!paramComite) return null;
    let comite: string[];
    try {
        const parsed = JSON.parse(paramComite);
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        comite = parsed.map((m: unknown) => String(m));
    } catch {
        return null;
    }
    const tamanoComite = comite.length;
    if (tamanoComite <= 1) return null;

    // Últimas N clasificaciones del pipeline real (SIN override intencional)
    // con la cuenta de modelos distintos que efectivamente votaron.
    // `COUNT(DISTINCT crv.modelo)` porque un mismo modelo puede tener varias
    // filas (una por categoría) — importa cuántos modelos distintos opinaron.
    const rows = await prisma.$queryRaw<Array<{ votantes: bigint }>>`
        SELECT COALESCE(v.votantes, 0)::bigint AS votantes
        FROM "ClasificacionIA" c
        LEFT JOIN LATERAL (
            SELECT COUNT(DISTINCT crv."modelo") AS votantes
            FROM "clasificacion_rubrica_votos" crv
            WHERE crv."clasificacionIAId" = c.id
        ) v ON true
        WHERE c."overrideModeloUsado" IS NULL
        ORDER BY c."creadoEn" DESC
        LIMIT ${ventana}
    `;
    if (rows.length === 0) return null;

    const reducidas = rows.filter((r) => Number(r.votantes) > 0 && Number(r.votantes) < tamanoComite).length;
    if (reducidas < umbral) return null;

    return {
        id: "jurado_reducido",
        prioridad: "alta",
        texto:
            `El motor votó con menos modelos de los configurados en ${reducidas} de las últimas ${rows.length} clasificaciones ` +
            `(comité: ${tamanoComite} modelos). El jurado está degradando en silencio — revisar el pipeline.`,
        ruta: "/dashboard/admin/estadisticas/salud-motor",
    };
}

/**
 * S7 · CARGA: casos del comité vencidos. Es la cola donde más duele el humo —
 * en producción 254 de 256 casos eran sembrados (I-292) y el admin creía que
 * tenía 254 familias esperando.
 */
async function senalComiteVencido(incluirSembrados: boolean): Promise<ResultadoCarga> {
    // El SLA "normal" ya está parametrizado; usamos ese como corte simple.
    const slaHoras = await paramInt("padre.comite.sla_horas_normal", 48);
    const corte = new Date(Date.now() - slaHoras * 60 * 60 * 1000);
    const filas = await prisma.$queryRaw<Array<{ total: bigint; reales: bigint }>>`
        SELECT COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE dm.id IS NULL)::bigint AS reales
        FROM "SolicitudComite" sc
        LEFT JOIN ${TABLA_MARCADO} dm
          ON dm."entidad" = 'SolicitudComite' AND dm."entidadId" = sc.id
        WHERE sc."estado" = 'PENDIENTE' AND sc."creadoEn" < ${corte}
    `;
    const conteo = conteoDesde(filas[0]);
    const sembrados = conteo.total - conteo.reales;
    const n = segunInterruptor(conteo, incluirSembrados);
    if (n === 0) return { senal: null, sembrados };
    return {
        senal: {
            id: "comite_vencido",
            prioridad: "media",
            texto: `El comité tiene ${n} caso(s) vencidos (pasaron su plazo de ${slaHoras} h).`,
            ruta: "/dashboard/admin/comite",
        },
        sembrados,
    };
}

async function senalesDeInfra(): Promise<SenalAlarma[]> {
    // Última lectura por señal (patrón §1.1 del inventario): usa el índice
    // (senal, creadoEn) y evita traer 7 días de historial.
    const senales = [
        "app",
        "bd",
        "worker",
        "ollama_ping",
        "ollama_smoke",
        "tailscale",
        "indices",
        "notif_pendientes_vencidas",
    ] as const;
    const ultimas = await Promise.all(
        senales.map((senal) =>
            prisma.healthProbe.findFirst({
                where: { senal },
                orderBy: { creadoEn: "desc" },
                select: { senal: true, ok: true, detalle: true, creadoEn: true },
            })
        )
    );
    const alertas: SenalAlarma[] = [];
    for (const probe of ultimas) {
        if (!probe || probe.ok) continue;
        alertas.push({
            id: `infra_${probe.senal}`,
            // Un rojo de infra que ya se convirtió en incidente doble se
            // considera crítico: usamos alta cuando la señal es worker/bd/app/ollama
            // (bloquean operación); media para el resto.
            prioridad: (["worker", "bd", "app", "ollama_ping", "ollama_smoke"] as string[]).includes(
                probe.senal
            )
                ? "alta"
                : "media",
            texto: mensajeInfra(probe.senal, probe.detalle),
            ruta: probe.senal === "worker" ? "/dashboard/admin/monitoreo/worker" : "/dashboard/admin/estadisticas/salud-motor",
        });
    }
    return alertas;
}

function mensajeInfra(senal: string, detalle: string | null): string {
    const cola = detalle ? ` — ${detalle}` : "";
    switch (senal) {
        case "app":
            return `La app no responde a las sondas de salud${cola}.`;
        case "bd":
            return `La base de datos no responde${cola}.`;
        case "worker":
            return `Los workers no dan señales de vida${cola}.`;
        case "ollama_ping":
            return `El cerebro IA no contesta al ping${cola}.`;
        case "ollama_smoke":
            return `El cerebro IA falla la generación mínima de prueba${cola}.`;
        case "tailscale":
            return `El túnel Tailscale al cerebro está caído${cola}.`;
        case "indices":
            return `El guardián de índices detectó un problema${cola}.`;
        case "notif_pendientes_vencidas":
            return `Hay notificaciones vencidas sin salir de la cola${cola}.`;
        default:
            return `Señal ${senal} en rojo${cola}.`;
    }
}

/**
 * Agrega todo. Cada señal se calcula independiente y en paralelo.
 *
 * ## I-294 · una señal que truena NO desaparece
 *
 * Antes esto era un `Promise.allSettled` que **descartaba los rechazos sin
 * registrar nada**, con un comentario que prometía un `logger` que no existía.
 * Consecuencia: las nueve señales podían estar rotas y la pantalla se veía
 * sana. Un tablero de alarmas que apaga sus propias alarmas es peor que no
 * tener tablero, porque produce confianza en vez de duda — y así I-294 vivió
 * desde SPEC-378 sin que nadie lo notara.
 *
 * Ahora cada tarea lleva su nombre, el rechazo va a `logger.error` **y** sale
 * en `degradadas`, que la pantalla pinta como «no pudimos calcular esto». El
 * admin tiene que poder distinguir **«no hay nada»** de **«no pude mirar»**.
 *
 * El orden de las alertas es determinístico: primero `alta` (más caras de dejar
 * sin atender) y luego `media`, empatando por `id` para que el listado no salte
 * entre renders.
 */
export async function calcularEstadoInicio(opciones: OpcionesInicio = {}): Promise<EstadoInicio> {
    const t0 = Date.now();
    const incluirSembrados = opciones.incluirSembrados === true;

    /** Cada tarea con su nombre: sin él, un rechazo no se puede nombrar. */
    const tareas: Array<{
        id: string;
        etiqueta: string;
        ejecutar: () => Promise<SenalAlarma | SenalAlarma[] | ResultadoCarga | null>;
    }> = [
        // ── SALUD · cuentan TODO, sembrado incluido (brief A-76 §3.1) ───────
        { id: "correos_fallidos", etiqueta: "correos que no salen", ejecutar: senalCorreosFallidos },
        // SPEC-401 (I-283): distingue "fallan TODOS" de "falla uno".
        { id: "proveedor_email", etiqueta: "proveedor de correo", ejecutar: senalProveedorEmailCaido },
        { id: "analisis_racha", etiqueta: "racha de análisis IA", ejecutar: senalAnalisisRachaFallida },
        // SPEC-398 (I-286): alarma en vivo — el jurado del motor no se degrada
        // sin que la casa lo grite. La prueba vigila el código; esta vigila
        // la realidad.
        { id: "jurado_reducido", etiqueta: "jurado del motor", ejecutar: senalJuradoReducido },
        { id: "infra", etiqueta: "infraestructura", ejecutar: senalesDeInfra },
        // ── CARGA · colas de trabajo, descuentan lo sembrado ────────────────
        { id: "reportes_huerfanos", etiqueta: "reportes sin dueño", ejecutar: () => senalReportesHuerfanos(incluirSembrados) },
        { id: "revision_manual_saturada", etiqueta: "cola de revisión manual", ejecutar: () => senalRevisionManual(incluirSembrados) },
        { id: "vigencias_por_vencer", etiqueta: "vigencias por vencer", ejecutar: () => senalVigenciasPorVencer(incluirSembrados) },
        { id: "comite_vencido", etiqueta: "casos vencidos del comité", ejecutar: () => senalComiteVencido(incluirSembrados) },
    ];

    const [settled, sembradosDistintos] = await Promise.all([
        Promise.allSettled(tareas.map((t) => t.ejecutar())),
        // Si esta cuenta falla no se tumba la pantalla: se informa 0 y la señal
        // degradada de la cola correspondiente ya avisa que algo no se pudo ver.
        contarSembradosDeCarga().catch((e: unknown) => {
            logger.error("[InicioAdmin] No se pudo contar los datos de prueba", e);
            return 0;
        }),
    ]);

    const alertas: SenalAlarma[] = [];
    const degradadas: SenalDegradada[] = [];
    const porSenal: Array<{ id: string; sembrados: number }> = [];

    settled.forEach((res, i) => {
        const tarea = tareas[i];
        if (res.status === "rejected") {
            // I-294: se registra Y se muestra. Un fallo callado es una mentira.
            logger.error(`[InicioAdmin] Señal "${tarea.id}" falló: no se pudo calcular`, res.reason);
            degradadas.push({ id: tarea.id, etiqueta: tarea.etiqueta });
            return;
        }
        const valor = res.value;
        if (valor === null) return;
        if (Array.isArray(valor)) {
            alertas.push(...valor);
            return;
        }
        if (esResultadoCarga(valor)) {
            if (valor.sembrados > 0) porSenal.push({ id: tarea.id, sembrados: valor.sembrados });
            if (valor.senal) alertas.push(valor.senal);
            return;
        }
        alertas.push(valor);
    });

    alertas.sort((a, b) => {
        if (a.prioridad !== b.prioridad) return a.prioridad === "alta" ? -1 : 1;
        return a.id.localeCompare(b.id);
    });

    return {
        alertas,
        degradadas,
        // El modo "tranquilo" no lista firmas verdes: la pantalla lo muestra
        // como una sola línea de calma. Se deja el campo por si querés
        // expandirlo después sin cambiar el contrato.
        ok: [],
        generadoEn: new Date().toISOString(),
        latenciaMs: Date.now() - t0,
        incluyeSembrados: incluirSembrados,
        sembrados: {
            total: sembradosDistintos,
            porSenal,
        },
    };
}

/** Distingue una señal de CARGA (que trae su conteo) de una de SALUD. */
function esResultadoCarga(valor: SenalAlarma | ResultadoCarga): valor is ResultadoCarga {
    return "sembrados" in valor;
}
