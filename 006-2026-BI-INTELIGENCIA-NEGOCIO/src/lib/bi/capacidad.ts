// src/lib/bi/capacidad.ts · Capacidad operativa: demanda acumulada vs. gestión
// Producto 006 · BI v2 · AGENTE C (vistas de capacidad en Pulso y Operación)
//
// Fuente: tablas replicadas de PI en bi-db (solo lectura):
//   Reporte(estado, eliminado)            — estado es enum PG de PI
//   AlertaColegio(colegioId, estado, asignadoAId)
//     estado: nueva | vista | gestionada | escalada | cerrada (string plano)
//     asignadoAId NULL = alerta SIN operario asignado.
//
// QUÉ MIDE: la brecha entre la DEMANDA acumulada (reportes esperando revisión
// manual + alertas activas sin asignar) y la CAPACIDAD VISIBLE de gestión
// (operarios con al menos un caso asignado × cupo configurable por operario).
//
// Candados:
//   9  — honestidad con el vacío y con la brecha: CERO operarios con casos es
//        un HECHO que se muestra en la cara (mensaje propio), no se disimula;
//        si una consulta falla, su sección degrada a ceros con warn (jamás un
//        dato inventado para rellenar la tarjeta).
//   10 — TODA cifra sale del ResultSet; los únicos números derivados son
//        demanda/cupo (suma y producto documentados) y el semáforo.
//   B3 — el cupo por operario vive en bi_config
//        (`bi.capacidad.casos_max_operario`); el default 25 es el último
//        eslabón del patrón BD → default de src/lib/config.ts.
//   PII — la tabla Usuario NO se replica (Ley 1581): la identidad del
//        operario JAMÁS se resuelve. Lo único visible es un seudónimo
//        determinista: "Operario #" + últimos 4 chars del cuid (mismo estilo
//        que la referencia #XXXXXX del ticker del Pulso).
//
// DIFERENCIAS CON operacion.ts (a propósito, documentadas):
//   · "Activa" aquí = nueva + vista + escalada: una alerta VISTA sigue
//     ocupando capacidad de gestión hasta gestionarse/cerrarse. En el
//     semáforo de colegios (operacion.ts) "activa" = nueva + escalada, que
//     es lo que exige atención del COLEGIO, no del operario.
//   · Capacidad VISIBLE: solo cuentan operarios con ≥1 caso asignado. Un
//     operario sin casos es invisible para la réplica (Usuario no viaja), así
//     que la capacidad real puede ser MAYOR que la visible — el mensaje lo
//     dice como "capacidad visible", nunca como censo de personal.
//
// Semáforo (función pura semaforoCapacidad, la UI no calcula):
//   rubí  — demandaExcede: demanda > cupo visible (con 0 operarios y demanda
//           > 0 siempre se cumple: la brecha es total).
//   ámbar — "cerca": demanda ≥ 80% del cupo visible sin superarlo.
//   pino  — el resto (incluido el vacío total: demanda 0).
// El 80% es una constante de PRESENTACIÓN documentada (mismo criterio que
// los pesos de saludOperativa en pulso.ts), no un umbral de negocio; el
// único umbral de negocio (cupo por operario) sí vive en bi_config (B3).

import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";

// ─── Contrato expuesto a la UI (Pulso y Operación) ───────────────────────────
export interface CapacidadData {
    /** Reportes no eliminados en estado REVISION_MANUAL (cola de revisión) */
    revisionManual: number;
    /** Alertas activas (nueva/vista/escalada) con asignadoAId NULL */
    alertasSinAsignar: number;
    /** Operarios DISTINTOS con al menos una alerta activa asignada */
    operariosConCasos: number;
    /** Alertas activas por operario, id PSEUDONIMIZADO, mayor carga primero */
    casosPorOperario: { id: string; activos: number }[];
    /** Cupo máximo de casos por operario (bi_config → default 25) */
    capacidadMaxPorOperario: number;
    /** demanda (revisionManual + alertasSinAsignar) > cupo visible */
    demandaExcede: boolean;
    /** Frase determinista y honesta del estado de la brecha (ver casos abajo) */
    mensaje: string;
}

export type SemaforoCapacidad = "rubi" | "ambar" | "pino";

// ─── Filas crudas de las consultas ───────────────────────────────────────────
interface FilaConteo {
    total: number;
}
interface FilaAlertasCapacidad {
    sin_asignar: number;
    operarios_con_casos: number;
}
interface FilaCasosOperario {
    operario_id: string;
    activos: number;
}
interface FilaSinAsignarColegio {
    colegio_id: string;
    colegio: string;
    sin_asignar: number;
}

// Fallbacks de degradación (consulta rota → ceros con warn, candado 9).
const ALERTAS_VACIAS: FilaAlertasCapacidad = { sin_asignar: 0, operarios_con_casos: 0 };

/** Default documentado del cupo por operario (último eslabón B3). */
const DEFAULT_CUPO_OPERARIO = 25;

/** Constante de presentación del semáforo: demanda ≥ 80% del cupo → "cerca". */
const UMBRAL_CERCANIA = 0.8;

// Estados de AlertaColegio que ocupan capacidad de gestión del operario:
// 'nueva', 'vista', 'escalada'. Van como LITERALES inline en el SQL (strings
// planos de PI, no parámetros de usuario — mismo criterio que los literales
// de estado en pulso.ts/operacion.ts); interpolarlos como ${} los
// convertiría en parámetros enlazados y rompería el IN.

/**
 * Ejecuta un sondeo de capacidad; si falla degrada a vacío con warn y el
 * resto de la vista vive (mismo patrón que `intentar` de pulso.ts).
 */
async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Capacidad] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/** Entero positivo desde bi_config; cualquier otra cosa cae al default. */
function enteroPositivo(valor: string | null, fallback: number): number {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Seudónimo determinista del operario: "Operario #" + últimos 4 chars del
 * cuid en mayúscula. JAMÁS se resuelve la identidad (Usuario no se replica).
 * Colisiones de 4 chars entre dos operarios son posibles en teoría; con los
 * volúmenes reales de la réplica no se dan y el impacto sería solo visual
 * (dos filas con el mismo seudónimo, ambas con su conteo real).
 */
export function pseudonimoOperario(asignadoAId: string): string {
    return `Operario #${asignadoAId.slice(-4).toUpperCase()}`;
}

/**
 * Mensaje determinista según el caso (candado 9: la brecha se dice en
 * palabras, no solo en color). N = demanda, M = operarios, C = cupo visible.
 */
function construirMensaje(
    demanda: number,
    operarios: number,
    cupo: number,
    excede: boolean,
    cerca: boolean,
): string {
    if (demanda === 0) {
        return "Sin casos activos acumulados: no hay demanda pendiente de gestión.";
    }
    if (operarios === 0) {
        return `No hay operarios asignados: ${demanda} casos activos acumulados sin capacidad de gestión`;
    }
    const cuantos = operarios === 1 ? "1 operario" : `${operarios} operarios`;
    if (excede) {
        return `La demanda (${demanda} casos activos) supera la capacidad visible: ${cuantos} con cupo para ${cupo} casos`;
    }
    if (cerca) {
        return `Capacidad visible al límite: ${demanda} casos activos frente a un cupo de ${cupo} (${cuantos})`;
    }
    return `Capacidad visible suficiente: ${demanda} casos activos frente a un cupo de ${cupo} (${cuantos})`;
}

/**
 * Semáforo de la brecha demanda/capacidad (función pura: la UI no calcula).
 */
export function semaforoCapacidad(c: CapacidadData): SemaforoCapacidad {
    if (c.demandaExcede) return "rubi";
    const demanda = c.revisionManual + c.alertasSinAsignar;
    const cupo = c.operariosConCasos * c.capacidadMaxPorOperario;
    if (demanda > 0 && demanda >= cupo * UMBRAL_CERCANIA) return "ambar";
    return "pino";
}

/**
 * Capacidad operativa en vivo. Tres sondeos independientes en paralelo; cada
 * uno degrada a ceros por su cuenta si falla. Los estados activos van como
 * literales SQL (strings planos de PI, no parámetros de usuario); los
 * identificadores de tabla/columna van SIEMPRE citados.
 */
export async function getCapacidad(): Promise<CapacidadData> {
    const [configCupo, filasRevision, filasAlertas, filasPorOperario] = await Promise.all([
        getConfig("bi.capacidad.casos_max_operario"),
        intentar(
            "revision-manual",
            prisma.$queryRaw<FilaConteo[]>`
                SELECT count(*)::int AS total
                FROM "Reporte"
                WHERE "estado" = 'REVISION_MANUAL' AND "eliminado" = false`,
        ),
        intentar(
            "alertas-capacidad",
            prisma.$queryRaw<FilaAlertasCapacidad[]>`
                SELECT count(*) FILTER (WHERE "asignadoAId" IS NULL)::int AS sin_asignar,
                       count(DISTINCT "asignadoAId")::int                 AS operarios_con_casos
                FROM "AlertaColegio"
                WHERE "estado" IN ('nueva', 'vista', 'escalada')`,
        ),
        intentar(
            "casos-por-operario",
            prisma.$queryRaw<FilaCasosOperario[]>`
                SELECT "asignadoAId" AS operario_id, count(*)::int AS activos
                FROM "AlertaColegio"
                WHERE "estado" IN ('nueva', 'vista', 'escalada') AND "asignadoAId" IS NOT NULL
                GROUP BY "asignadoAId"
                ORDER BY activos DESC, "asignadoAId" ASC`,
        ),
    ]);

    const capacidadMaxPorOperario = enteroPositivo(configCupo, DEFAULT_CUPO_OPERARIO);
    const revisionManual = filasRevision[0]?.total ?? 0;
    const alertas = filasAlertas[0] ?? ALERTAS_VACIAS;
    const alertasSinAsignar = alertas.sin_asignar;
    const operariosConCasos = alertas.operarios_con_casos;

    const demanda = revisionManual + alertasSinAsignar;
    const cupo = operariosConCasos * capacidadMaxPorOperario;
    const demandaExcede = demanda > cupo;
    const cerca = !demandaExcede && demanda > 0 && demanda >= cupo * UMBRAL_CERCANIA;

    return {
        revisionManual,
        alertasSinAsignar,
        operariosConCasos,
        casosPorOperario: filasPorOperario.map((f) => ({
            id: pseudonimoOperario(f.operario_id),
            activos: f.activos,
        })),
        capacidadMaxPorOperario,
        demandaExcede,
        mensaje: construirMensaje(demanda, operariosConCasos, cupo, demandaExcede, cerca),
    };
}

/**
 * Alertas activas SIN asignar por colegio, para la columna "Sin asignar" del
 * tablero de Operación. La agregación es por "colegioId" (exacta); la llave
 * del Map es el NOMBRE del colegio porque la fila del tablero
 * (FilaOperacion) no expone el id por contrato y la UI solo puede unir por
 * nombre. Colegios homónimos consolidarían su conteo en una sola entrada —
 * en la réplica actual los nombres son únicos. Un colegio sin alertas sin
 * asignar NO aparece en el Map: la ausencia ES el conteo real en cero.
 */
export async function alertasSinAsignarPorColegio(): Promise<Map<string, number>> {
    const filas = await intentar(
        "sin-asignar-por-colegio",
        prisma.$queryRaw<FilaSinAsignarColegio[]>`
            SELECT a."colegioId" AS colegio_id,
                   c."nombre"    AS colegio,
                   count(*)::int AS sin_asignar
            FROM "AlertaColegio" a
            JOIN "Colegio" c ON c."id" = a."colegioId"
            WHERE a."estado" IN ('nueva', 'vista', 'escalada') AND a."asignadoAId" IS NULL
            GROUP BY a."colegioId", c."nombre"
            ORDER BY sin_asignar DESC, c."nombre" ASC`,
    );
    return new Map(filas.map((f) => [f.colegio, f.sin_asignar]));
}
