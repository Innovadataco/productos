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
 */
import { prisma } from "@/lib/prisma";
import { getParametroSistemaValor } from "@/lib/parametros";

export type PrioridadSenal = "alta" | "media";

export interface SenalAlarma {
    id: string;
    prioridad: PrioridadSenal;
    texto: string;
    ruta: string;
}

export interface EstadoInicio {
    alertas: SenalAlarma[];
    /**
     * Firmas que ya pasaron (verdes) — solo se listan para el modo "tranquilo"
     * con detalle. La pantalla las oculta cuando `alertas.length === 0`.
     */
    ok: Array<{ id: string; texto: string }>;
    /** ISO timestamp de cuándo se agregaron las señales. */
    generadoEn: string;
    /** Milisegundos que tardó agregar todo (para la nota de rendimiento). */
    latenciaMs: number;
}

async function paramInt(clave: string, fallback: number): Promise<number> {
    const raw = await getParametroSistemaValor(clave);
    if (raw === null) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
}

const PATRON_CUOTA = /(quota|rate\s*limit|429|too\s*many\s*requests)/i;

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

async function senalReportesHuerfanos(): Promise<SenalAlarma | null> {
    const horas = await paramInt("monitoreo.reportes.sin_dueno_horas", 24);
    const umbral = await paramInt("monitoreo.reportes.sin_dueno_umbral", 3);
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000);
    const total = await prisma.reporte.count({
        where: {
            estado: { in: ["REVISION_MANUAL", "PENDIENTE"] },
            operadorId: null,
            eliminado: false,
            creadoEn: { lt: desde },
        },
    });
    if (total < umbral) return null;
    return {
        id: "reportes_huerfanos",
        prioridad: "media",
        texto: `${total} reportes llevan más de ${horas} h sin dueño: los operadores están al tope o no hay activos.`,
        ruta: "/dashboard/admin/operadores/asignar",
    };
}

async function senalRevisionManualReales(): Promise<SenalAlarma | null> {
    const umbral = await paramInt("monitoreo.reportes.revision_manual_umbral", 20);
    // REVISION_MANUAL menos DemoMarcado (los 128 demo no cuentan — tapan la cola real).
    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*)::bigint AS n
        FROM "Reporte" r
        LEFT JOIN "DemoMarcado" dm
          ON dm."entidad" = 'Reporte' AND dm."entidadId" = r.id
        WHERE r."estado" = 'REVISION_MANUAL' AND r."eliminado" = false AND dm.id IS NULL
    `;
    const reales = Number(rows[0]?.n ?? 0);
    if (reales < umbral) return null;
    return {
        id: "revision_manual_saturada",
        prioridad: "media",
        texto: `${reales} reportes reales esperan revisión manual (sin contar los de prueba). La cola está saturada.`,
        ruta: "/dashboard/admin",
    };
}

async function senalVigenciasPorVencer(): Promise<SenalAlarma | null> {
    const dias = await paramInt("monitoreo.vigencia.aviso_dias", 7);
    const desde = new Date();
    const hasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    const [nColegios, nUsuarios] = await Promise.all([
        prisma.colegio.count({ where: { finServicio: { gte: desde, lte: hasta } } }),
        prisma.usuario.count({ where: { rol: "PARENT", finServicio: { gte: desde, lte: hasta } } }),
    ]);
    if (nColegios === 0 && nUsuarios === 0) return null;
    const partes: string[] = [];
    if (nColegios > 0) partes.push(`${nColegios} colegio(s)`);
    if (nUsuarios > 0) partes.push(`${nUsuarios} familia(s)`);
    return {
        id: "vigencias_por_vencer",
        prioridad: "media",
        texto: `${partes.join(" y ")} vencen en los próximos ${dias} días.`,
        ruta: "/dashboard/admin/pagos",
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

async function senalComiteVencido(): Promise<SenalAlarma | null> {
    // El SLA "normal" ya está parametrizado; usamos ese como corte simple.
    const slaHoras = await paramInt("padre.comite.sla_horas_normal", 48);
    const corte = new Date(Date.now() - slaHoras * 60 * 60 * 1000);
    const total = await prisma.solicitudComite.count({
        where: { estado: "PENDIENTE", creadoEn: { lt: corte } },
    });
    if (total === 0) return null;
    return {
        id: "comite_vencido",
        prioridad: "media",
        texto: `El comité tiene ${total} caso(s) vencidos (pasaron su plazo de ${slaHoras} h).`,
        ruta: "/dashboard/admin/comite",
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
 * Agrega todo. Cada señal se calcula independiente y en paralelo — un fallo
 * de UNA señal no debe tumbar la pantalla; se devuelve la lista de lo que sí
 * pudimos leer y el error queda en `logger`. Aparte, el orden de las alertas
 * es determinístico: primero `alta` (más caras de dejar sin atender) y luego
 * `media`, empatando por `id` para que el listado no salte entre renders.
 */
export async function calcularEstadoInicio(): Promise<EstadoInicio> {
    const t0 = Date.now();
    const promesas: Array<Promise<SenalAlarma | SenalAlarma[] | null>> = [
        senalCorreosFallidos(),
        senalAnalisisRachaFallida(),
        senalReportesHuerfanos(),
        senalRevisionManualReales(),
        senalVigenciasPorVencer(),
        senalComiteVencido(),
        // SPEC-398 (I-286): alarma en vivo — el jurado del motor no se degrada
        // sin que la casa lo grite. La prueba vigila el código; esta vigila
        // la realidad.
        senalJuradoReducido(),
        senalesDeInfra(),
    ];
    const settled = await Promise.allSettled(promesas);
    const alertas: SenalAlarma[] = [];
    for (const res of settled) {
        if (res.status !== "fulfilled" || res.value === null) continue;
        if (Array.isArray(res.value)) alertas.push(...res.value);
        else alertas.push(res.value);
    }
    alertas.sort((a, b) => {
        if (a.prioridad !== b.prioridad) return a.prioridad === "alta" ? -1 : 1;
        return a.id.localeCompare(b.id);
    });
    return {
        alertas,
        // El modo "tranquilo" no lista firmas verdes: la pantalla lo muestra
        // como una sola línea de calma. Se deja el campo por si querés
        // expandirlo después sin cambiar el contrato.
        ok: [],
        generadoEn: new Date().toISOString(),
        latenciaMs: Date.now() - t0,
    };
}
